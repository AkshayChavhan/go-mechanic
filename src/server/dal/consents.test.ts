import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { LOGIN_NOTICE_VERSION } from "@/domain/consent";
import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { consents, users } from "@/server/db/schema";

import { recordLoginConsents } from "./consents";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14). Only the database test files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  getDatabase: vi.fn(),
}));

let db: Database;
const givenAt = new Date("2026-10-28T06:30:00Z");
const attempt = { locale: "en", noticeVersion: LOGIN_NOTICE_VERSION, consentGivenAt: givenAt };

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});
afterAll(async () => {
  await closeDatabase(db);
});
beforeEach(async () => {
  vi.mocked(getDatabase).mockResolvedValue(db);
  await db.delete(consents);
  await db.delete(users);
  await db.insert(users).values({ id: "user-1", name: "", email: "1@phone.invalid", phoneNumber: "+919876543210" });
});

describe("recordLoginConsents", () => {
  test("writes one row per purpose, at the attempt's version, language and time", async () => {
    await recordLoginConsents("user-1", attempt);
    const rows = await db.select().from(consents).orderBy(consents.purpose);
    expect(rows.map(({ purpose, noticeVersion, locale, givenAt: given }) => ({ purpose, noticeVersion, locale, given }))).toEqual([
      { purpose: "age_18_plus", noticeVersion: LOGIN_NOTICE_VERSION, locale: "en", given: givenAt },
      { purpose: "account_and_booking_contact", noticeVersion: LOGIN_NOTICE_VERSION, locale: "en", given: givenAt },
    ]);
  });

  test("the same purpose and version again keeps the first record", async () => {
    await recordLoginConsents("user-1", attempt);
    await recordLoginConsents("user-1", { ...attempt, consentGivenAt: new Date("2026-11-01T00:00:00Z") });
    const rows = await db.select().from(consents);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.givenAt.getTime() === givenAt.getTime())).toBe(true);
  });

  test("a user with consent records can't be deleted (task 43 decides what deletion does)", async () => {
    await recordLoginConsents("user-1", attempt);
    const failure = await db.delete(users).then(
      () => "deleted",
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(DrizzleQueryError);
    // 23001: restrict_violation, Postgres's code for an ON DELETE RESTRICT refusal.
    expect(((failure as DrizzleQueryError).cause as { code?: string }).code).toBe("23001");
  });
});
