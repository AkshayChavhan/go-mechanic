import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { devMessages } from "@/server/db/schema";

import { listDevMessages, saveDevMessage } from "./dev-messages";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14). Only the database test files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  getDatabase: vi.fn(),
}));

let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});
afterAll(async () => {
  await closeDatabase(db);
});
beforeEach(async () => {
  vi.mocked(getDatabase).mockResolvedValue(db);
  await db.delete(devMessages);
});

const sms = (body: string) => ({ channel: "sms" as const, recipient: "+919876543210", body });

describe("dev messages (what the fake providers sent)", () => {
  test("saveDevMessage stores the message with the time", async () => {
    await saveDevMessage(sms("first"));
    const [row] = await db.select().from(devMessages);
    expect(row).toMatchObject(sms("first"));
    expect(Math.abs(row.createdAt.getTime() - Date.now())).toBeLessThan(60_000);
  });

  test("listDevMessages returns the newest first, at most `limit`", async () => {
    await db.insert(devMessages).values([
      { ...sms("oldest"), createdAt: new Date(Date.now() - 3000) },
      { ...sms("middle"), createdAt: new Date(Date.now() - 2000) },
      { ...sms("newest"), createdAt: new Date(Date.now() - 1000) },
    ]);
    expect((await listDevMessages()).map((message) => message.body)).toEqual(["newest", "middle", "oldest"]);
    expect((await listDevMessages(2)).map((message) => message.body)).toEqual(["newest", "middle"]);
  });

  test("saving deletes messages older than 48 hours, and keeps younger ones", async () => {
    await db.insert(devMessages).values([
      { ...sms("49 hours old"), createdAt: new Date(Date.now() - 49 * 3_600_000) },
      { ...sms("47 hours old"), createdAt: new Date(Date.now() - 47 * 3_600_000) },
    ]);
    await saveDevMessage(sms("new"));
    expect((await listDevMessages()).map((message) => message.body)).toEqual(["new", "47 hours old"]);
  });
});
