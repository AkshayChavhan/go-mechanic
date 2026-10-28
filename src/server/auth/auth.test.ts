import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { closeDatabase, createDatabase, type Database } from "@/server/db";
import { sessions, users, verifications } from "@/server/db/schema";

import { type Auth, createAuth } from "./auth";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14). Only the database test files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// Better Auth's phone login against a real (in-memory) copy of our database,
// migrated as `npm run dev` does it: the proof that our hand-written tables
// are the ones Better Auth expects.

const number = "+919876543210";
const secret = "test-secret-that-is-at-least-32-characters-long";

let db: Database;
let auth: Auth;
const sendCode = vi.fn<(phoneNumber: string, code: string) => Promise<void>>();
const onVerified = vi.fn<(userId: string, phoneNumber: string) => Promise<void>>();

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
  auth = createAuth({ db, secret, secureCookies: false, sendCode, onVerified });
});
afterAll(async () => {
  await closeDatabase(db);
});

beforeEach(async () => {
  vi.clearAllMocks();
  sendCode.mockResolvedValue(undefined);
  onVerified.mockResolvedValue(undefined);
  await db.delete(sessions);
  await db.delete(users);
  await db.delete(verifications);
});

/** Asks Better Auth for a code and returns the code it handed to the SMS sender. */
async function sendAndCatchCode(phoneNumber = number): Promise<string> {
  await auth.api.sendPhoneNumberOTP({ body: { phoneNumber } });
  const code = sendCode.mock.lastCall?.[1];
  if (!code) throw new Error("no code was sent");
  return code;
}

function verify(code: string, extra: Record<string, unknown> = {}) {
  return auth.api.verifyPhoneNumber({ body: { phoneNumber: number, code, ...extra }, headers: new Headers() });
}

/** The error code Better Auth answered with ("INVALID_OTP"), or the error itself. */
async function errorCode(attempt: Promise<unknown>): Promise<unknown> {
  return attempt.then(
    () => "no error",
    (error: unknown) => (error as { body?: { code?: string } }).body?.code ?? error,
  );
}

describe("sending a code", () => {
  test("hands a 6-digit code to the SMS sender and stores it for 5 minutes", async () => {
    const before = Date.now();
    const code = await sendAndCatchCode();
    const after = Date.now();

    expect(sendCode).toHaveBeenCalledTimes(1);
    expect(sendCode).toHaveBeenCalledWith(number, code);
    expect(code).toMatch(/^\d{6}$/);
    const rows = await db.select().from(verifications);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ identifier: number, value: `${code}:0` });
    // 5 minutes from the moment of sending, measured on both sides of the
    // call: a busy machine can take seconds, so no fixed slack.
    expect(rows[0].expiresAt.getTime()).toBeGreaterThanOrEqual(before + 300_000);
    expect(rows[0].expiresAt.getTime()).toBeLessThanOrEqual(after + 300_000);
  });

  test("refuses a number that isn't an Indian mobile, and sends nothing", async () => {
    expect(await errorCode(auth.api.sendPhoneNumberOTP({ body: { phoneNumber: "+912012345678" } }))).toBe(
      "INVALID_PHONE_NUMBER",
    );
    expect(sendCode).not.toHaveBeenCalled();
  });

  test("a failing SMS sender fails the send, and leaves the code stored", async () => {
    // Why the login service deletes the code itself when the SMS fails
    // (plan C6): otherwise the number would wait 5 minutes for a code that
    // never arrived.
    sendCode.mockRejectedValueOnce(new Error("SMS down"));
    await expect(auth.api.sendPhoneNumberOTP({ body: { phoneNumber: number } })).rejects.toThrow("SMS down");
    expect(await db.$count(verifications)).toBe(1);
  });
});

describe("checking a code", () => {
  test("the right code creates a customer, a session and a token", async () => {
    const code = await sendAndCatchCode();
    const result = await verify(code);

    expect(result.status).toBe(true);
    expect(result.token).toEqual(expect.any(String));
    const [user] = await db.select().from(users);
    expect(user).toMatchObject({
      phoneNumber: number,
      phoneNumberVerified: true,
      email: "919876543210@phone.invalid",
      name: "",
      role: "customer",
    });
    const [session] = await db.select().from(sessions);
    expect(session).toMatchObject({ userId: user.id, token: result.token });
    // 30 days, not Better Auth's default 7.
    const days = (session.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
    // The code is used up.
    expect(await db.$count(verifications)).toBe(0);
    expect(onVerified).toHaveBeenCalledWith(user.id, number);
  });

  test("a second login with the same number reuses the user", async () => {
    await verify(await sendAndCatchCode());
    await verify(await sendAndCatchCode());

    expect(await db.$count(users)).toBe(1);
    expect(await db.$count(sessions)).toBe(2);
  });

  test("a role sent with the code is ignored: everyone starts as a customer", async () => {
    await verify(await sendAndCatchCode(), { role: "owner" });
    const [user] = await db.select().from(users);
    expect(user.role).toBe("customer");
  });

  test("when onVerified throws, no session is created", async () => {
    onVerified.mockRejectedValueOnce(new Error("no consent"));
    const code = await sendAndCatchCode();

    await expect(verify(code)).rejects.toThrow("no consent");
    expect(await db.$count(sessions)).toBe(0);
    // The user was already created, and the code is used up.
    expect(await db.$count(users)).toBe(1);
    expect(await db.$count(verifications)).toBe(0);
  });

  test('stores wrong tries in the code row as "<code>:<tries>", and the 4th try kills it', async () => {
    // readLiveCode (src/server/dal/login-codes.ts) reads this format: this
    // test fails if a Better Auth upgrade changes it.
    const code = await sendAndCatchCode();
    const wrong = code === "000000" ? "111111" : "000000";

    for (const tries of [1, 2, 3]) {
      expect(await errorCode(verify(wrong))).toBe("INVALID_OTP");
      const [row] = await db.select().from(verifications).where(eq(verifications.identifier, number));
      expect(row.value).toBe(`${code}:${tries}`);
    }
    // After 3 wrong tries even the right code fails, and the row goes.
    expect(await errorCode(verify(code))).toBe("TOO_MANY_ATTEMPTS");
    expect(await db.$count(verifications)).toBe(0);
    expect(await db.$count(sessions)).toBe(0);
  });

  test("a new code kills the old one", async () => {
    const first = await sendAndCatchCode();
    let second = await sendAndCatchCode();
    while (second === first) second = await sendAndCatchCode();

    expect(await errorCode(verify(first))).toBe("INVALID_OTP");
    await expect(verify(second)).resolves.toMatchObject({ status: true });
  });

  test("a code for a number that never asked for one is not found", async () => {
    expect(await errorCode(verify("123456"))).toBe("OTP_NOT_FOUND");
  });
});
