import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { verifications } from "@/server/db/schema";

import { findLoginAttempt, readLiveCode } from "./login-codes";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14). Only the database test files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  getDatabase: vi.fn(),
}));

// The service tests (src/server/auth/login.test.ts) cover deciding and
// recording attempts. These check the two reads on their own.

let db: Database;
const number = "+919876543210";
const expiresAt = new Date("2026-10-28T06:35:00Z");

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});
afterAll(async () => {
  await closeDatabase(db);
});
beforeEach(async () => {
  vi.mocked(getDatabase).mockResolvedValue(db);
  await db.delete(verifications);
});

describe("readLiveCode", () => {
  test("no stored code: null", async () => {
    expect(await readLiveCode(number)).toBeNull();
  });

  test.each([
    ["123456:0", 3],
    ["123456:2", 1],
    ["123456:3", 0],
    ["123456:7", 0],
    ["123456", 3],
  ])("value %s leaves %i tries", async (value, triesLeft) => {
    await db.insert(verifications).values({ id: "v1", identifier: number, value, expiresAt });
    expect(await readLiveCode(number)).toEqual({ expiresAt, triesLeft });
  });

  test("reads the newest code for the number only", async () => {
    await db.insert(verifications).values([
      { id: "old", identifier: number, value: "111111:2", expiresAt, createdAt: new Date("2026-10-28T06:30:00Z") },
      { id: "new", identifier: number, value: "222222:0", expiresAt, createdAt: new Date("2026-10-28T06:31:00Z") },
      { id: "other", identifier: "+919000000000", value: "333333:3", expiresAt },
    ]);
    expect(await readLiveCode(number)).toEqual({ expiresAt, triesLeft: 3 });
  });
});

describe("findLoginAttempt", () => {
  test("an id that isn't a UUID finds nothing, without asking the database", async () => {
    vi.mocked(getDatabase).mockClear();
    expect(await findLoginAttempt("1; drop table users")).toBeNull();
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("an unknown UUID finds nothing", async () => {
    expect(await findLoginAttempt("00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});
