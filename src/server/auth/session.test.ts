import { inspect } from "node:util";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { closeDatabase, createDatabase, type Database } from "@/server/db";
import { sessions, users, verifications } from "@/server/db/schema";
import { ServerEnvError } from "@/server/env";

import { type Auth, createAuth } from "./auth";
import { LoginServiceError } from "./errors";
import { getAuth } from "./instance";
import { getCurrentUser } from "./session";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14). Only the database test files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("./instance", () => ({ getAuth: vi.fn() }));
// The settings: an owner's number a test can change, or an error to throw.
const settings = vi.hoisted(() => ({ ownerPhoneNumber: "+919764750567", error: null as Error | null }));
vi.mock("@/server/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/env")>();
  return {
    ...actual,
    serverEnv: () => {
      if (settings.error) throw settings.error;
      return { ...actual.parseServerEnv({}), ownerPhoneNumber: settings.ownerPhoneNumber };
    },
  };
});

const number = "+919876543210";
let db: Database;
let auth: Auth;
let lastCode = "";

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
  auth = createAuth({
    db,
    secret: "test-secret-that-is-at-least-32-characters-long",
    secureCookies: false,
    sendCode: async (_number, code) => {
      lastCode = code;
    },
    onVerified: async () => {},
  });
});
afterAll(async () => {
  await closeDatabase(db);
});
beforeEach(async () => {
  settings.ownerPhoneNumber = "+919764750567";
  settings.error = null;
  vi.mocked(getAuth).mockResolvedValue(auth);
  await db.delete(sessions);
  await db.delete(users);
  await db.delete(verifications);
});

/** Logs `number` in and returns the Cookie header a browser would then send. */
async function logIn(): Promise<string> {
  await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: number } });
  const { headers: answer } = await auth.api.verifyPhoneNumber({
    body: { phoneNumber: number, code: lastCode },
    headers: new Headers(),
    returnHeaders: true,
  });
  const cookies = answer.getSetCookie().map((cookie) => cookie.split(";")[0]);
  expect(cookies.some((cookie) => cookie.startsWith("better-auth.session_token="))).toBe(true);
  return cookies.join("; ");
}

describe("getCurrentUser (who is logged in, for pages)", () => {
  test("with the session cookie: the user's id, number and role, nothing else", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie: await logIn() }));
    const [user] = await db.select().from(users);

    expect(await getCurrentUser()).toEqual({ id: user.id, phoneNumber: number, role: "customer" });
  });

  test("without a cookie: null", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers());
    expect(await getCurrentUser()).toBeNull();
  });

  test("never moves the session's expiry", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie: await logIn() }));
    const [before] = await db.select().from(sessions);
    // Pretend the session is old enough for Better Auth to want to extend it.
    const older = new Date(before.expiresAt.getTime() - 20 * 86_400_000);
    await db.update(sessions).set({ expiresAt: older }).where(eq(sessions.id, before.id));

    await getCurrentUser();
    const [after] = await db.select().from(sessions);
    expect(after.expiresAt).toEqual(older);
  });

  test("a session past its 30 days reads as logged out", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie: await logIn() }));
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await getCurrentUser()).toBeNull();
  });

  test("a deleted session (logged out elsewhere) reads as logged out", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie: await logIn() }));
    await db.delete(sessions);
    expect(await getCurrentUser()).toBeNull();
  });
});

describe("getCurrentUser: the owner rule on every read", () => {
  test("a stored customer on the owner's number reads as the owner, with no new login (once the setting is live)", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie: await logIn() }));
    expect((await getCurrentUser())?.role).toBe("customer");
    settings.ownerPhoneNumber = number;
    expect((await getCurrentUser())?.role).toBe("owner");
  });

  test("a stored owner on any other number reads as a customer (the owner's number moved)", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie: await logIn() }));
    await db.update(users).set({ role: "owner" });
    expect((await getCurrentUser())?.role).toBe("customer");
  });

  test("a stored manager stays a manager", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie: await logIn() }));
    await db.update(users).set({ role: "manager" });
    expect((await getCurrentUser())?.role).toBe("manager");
  });

  test("a wrong setting surfaces as itself (ServerEnvError), not as a LoginServiceError", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers());
    settings.error = new ServerEnvError([{ variable: "OWNER_PHONE_NUMBER", problem: "not-mobile" }]);
    await expect(getCurrentUser()).rejects.toBeInstanceOf(ServerEnvError);
  });
});

describe("getCurrentUser when the database fails", () => {
  test("throws a LoginServiceError that holds no session token", async () => {
    const cookie = await logIn();
    const token = /better-auth\.session_token=([^.;]+)/.exec(cookie)?.[1];
    expect(token).toBeTruthy();
    const broken = await createDatabase({ driver: "pglite", dataDir: null });
    await closeDatabase(broken);
    vi.mocked(getAuth).mockResolvedValue(
      createAuth({ db: broken, secret: "test-secret-that-is-at-least-32-characters-long", secureCookies: false, sendCode: async () => {}, onVerified: async () => {} }),
    );
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie }));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});

    const failure = await getCurrentUser().then(
      () => "no error",
      (error: unknown) => error,
    );
    quiet.mockRestore();
    // Better Auth answers the failed read with its own APIError; what
    // reaches the page (and Next.js's log) is only the step and that name.
    expect(failure).toBeInstanceOf(LoginServiceError);
    expect((failure as Error).message).toBe("getCurrentUser failed (APIError)");
    expect(inspect(failure, { depth: 10 })).not.toContain(token);
  });
});
