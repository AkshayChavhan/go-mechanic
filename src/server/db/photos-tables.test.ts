import { eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { PHOTO_STATUSES } from "@/domain/photos";

import { closeDatabase, createDatabase, type Database } from "./index";
import { photoSets, photos, photoStatus, users } from "./schema";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14 saw the 10-second hook limit time out under load). Database test
// files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});
afterAll(async () => {
  await closeDatabase(db);
});

beforeEach(async () => {
  await db.delete(photoSets);
  await db.delete(users).where(eq(users.id, "asha"));
  await db.insert(users).values({ id: "asha", name: "", email: "919876500001@phone.invalid", phoneNumber: "+919876500001" });
});

/** The Postgres error behind a failed query: its code and the constraint it broke. */
async function violation(query: Promise<unknown>): Promise<{ code?: string; constraint?: string }> {
  const error = await query.then(
    () => {
      throw new Error("expected the query to fail");
    },
    (failure: unknown) => failure,
  );
  if (!(error instanceof DrizzleQueryError)) throw error;
  const { code, constraint } = error.cause as { code?: string; constraint?: string };
  return { code, constraint };
}

async function newSet() {
  const [set] = await db.insert(photoSets).values({ userId: "asha" }).returning();
  return set!;
}

describe("the photo tables", () => {
  test("list the photo statuses exactly as the app does", () => {
    expect(photoStatus.enumValues).toEqual([...PHOTO_STATUSES]);
  });

  test("a new photo starts pending, with no size", async () => {
    const set = await newSet();
    const [photo] = await db.insert(photos).values({ setId: set.id, storageKey: "k1" }).returning();
    expect(photo).toMatchObject({ status: "pending", bytes: null, storedAt: null });
  });

  test("refuse a stored photo without its size or time, and a size over 2 MB", async () => {
    const set = await newSet();
    expect(await violation(db.insert(photos).values({ setId: set.id, storageKey: "k2", status: "stored" }))).toEqual({
      code: "23514",
      constraint: "photos_stored_complete",
    });
    expect(await violation(db.insert(photos).values({ setId: set.id, storageKey: "k3", bytes: 2_097_153 }))).toEqual({
      code: "23514",
      constraint: "photos_bytes_limit",
    });
  });

  test("refuse two photos with one storage key", async () => {
    const set = await newSet();
    await db.insert(photos).values({ setId: set.id, storageKey: "same" });
    expect(await violation(db.insert(photos).values({ setId: set.id, storageKey: "same" }))).toEqual({
      code: "23505",
      constraint: "photos_storage_key_unique",
    });
  });

  test("deleting a user deletes their sets and photos", async () => {
    const set = await newSet();
    await db.insert(photos).values({ setId: set.id, storageKey: "k4" });
    await db.delete(users).where(eq(users.id, "asha"));
    expect(await db.$count(photoSets)).toBe(0);
    expect(await db.$count(photos)).toBe(0);
  });
});
