import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { fixedClock } from "@/lib/clock";
import { AccessDeniedError } from "@/server/auth/access";
import { getCurrentUser } from "@/server/auth/session";
import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { users } from "@/server/db/schema";

import { readMyProfile, saveMyName } from "./profile";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14 saw the 10-second hook limit time out under load). Database test
// files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// getDatabase is swapped for an in-memory PGlite, and the session for a mock:
// Asha is logged in unless a test says otherwise.
vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  getDatabase: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));

const asha = { id: "asha", phoneNumber: "+919876500001", role: "customer" as const };
const ravi = { id: "ravi", phoneNumber: "+919876500002", role: "customer" as const };

let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});
afterAll(async () => {
  await closeDatabase(db);
});

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getDatabase).mockResolvedValue(db);
  vi.mocked(getCurrentUser).mockResolvedValue(asha);
  await db.delete(users);
  await db.insert(users).values(
    [asha, ravi].map(({ id, phoneNumber }) => ({ id, name: "", email: `${phoneNumber.slice(1)}@phone.invalid`, phoneNumber })),
  );
});

const clock = fixedClock(new Date("2026-10-29T10:00:00Z"));

async function nameOf(id: string) {
  const [row] = await db.select({ name: users.name, updatedAt: users.updatedAt }).from(users).where(eq(users.id, id));
  return row;
}

describe("nobody logged in", () => {
  test.each([
    ["readMyProfile", () => readMyProfile()],
    ["saveMyName", () => saveMyName("Asha Patil", clock)],
  ])("%s throws AccessDeniedError before touching the database", async (_name, call) => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const error = await call().catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(AccessDeniedError);
    expect((error as AccessDeniedError).reason).toBe("signedOut");
    expect(getDatabase).not.toHaveBeenCalled();
  });
});

describe("readMyProfile", () => {
  test("a new customer has an empty name and their number", async () => {
    expect(await readMyProfile()).toEqual({ name: "", phoneNumber: "+919876500001" });
  });

  test("reads the logged-in customer's row, never another's", async () => {
    await db.update(users).set({ name: "Ravi Kumar" }).where(eq(users.id, "ravi"));
    expect(await readMyProfile()).toEqual({ name: "", phoneNumber: "+919876500001" });
  });
});

describe("saveMyName", () => {
  test("saves the cleaned name on the logged-in customer's row only", async () => {
    expect(await saveMyName("  Asha   Patil ", clock)).toEqual({ ok: true });
    expect(await nameOf("asha")).toEqual({ name: "Asha Patil", updatedAt: clock.now() });
    expect((await nameOf("ravi")).name).toBe("");
    expect(await readMyProfile()).toEqual({ name: "Asha Patil", phoneNumber: "+919876500001" });
  });

  test("a name that breaks the rules returns its problem and writes nothing", async () => {
    expect(await saveMyName("A", clock)).toEqual({ ok: false, problem: "name-too-short" });
    expect(await saveMyName("   ", clock)).toEqual({ ok: false, problem: "name-missing" });
    expect(await saveMyName("Asha2", clock)).toEqual({ ok: false, problem: "name-invalid" });
    expect((await nameOf("asha")).name).toBe("");
  });
});
