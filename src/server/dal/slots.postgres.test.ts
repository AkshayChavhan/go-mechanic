// The real row race, on staging's Postgres (task 20, KTD11).
//
// slots.test.ts runs on PGlite, which runs one query at a time, so it can't
// show two reservations racing for the last place. This file does, against
// the staging database, with ten connections firing at once. It runs only
// with `npm run staging:race-test` (vitest.staging.config.mts); `npm run
// check` leaves it out.
//
// It never touches real data: the slots it uses are in June 2099, under a
// fixed clock, and it deletes only their counter rows, before and after. It
// never touches slot_rules (slots.test.ts's beforeEach would: never copy it
// here). The negative control, a reservation written the naive way (read the
// count, then write it), must overbook under the same load: that proves the
// calls really overlapped, so the real reserveSlot passing means something.

import { and, eq, gte, lt, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { fixedClock } from "@/lib/clock";
import { closeDatabase, type Database, postgresClient, postgresDatabase } from "@/server/db";
import { garageSettings, slotCounters, slotRules } from "@/server/db/schema";

import { readStagingDatabaseUrl, STAGING_URL_VARIABLE } from "../../../scripts/staging/settings";
import { reserveSlot } from "./slots";

// Each statement crosses the internet to Mumbai.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

/** Simultaneous calls. Supabase's session pooler gives each client its own server connection, and Free's pool holds about 15. */
const CALLS = 10;

// Wednesday 3 June 2099, 10:00 and 11:00 India time; the clock reads Tuesday noon.
const freshSlot = new Date("2099-06-03T04:30:00Z");
const halfTakenSlot = new Date("2099-06-03T05:30:00Z");
const controlSlot = new Date("2099-06-03T06:30:00Z");
const clock = fixedClock(new Date("2099-06-02T06:30:00Z"));
const testDay = and(gte(slotCounters.startsAt, new Date("2099-06-03T00:00:00Z")), lt(slotCounters.startsAt, new Date("2099-06-04T00:00:00Z")));

let db: Database;
let capacity: number;

beforeAll(async () => {
  const url = readStagingDatabaseUrl();
  db = postgresDatabase(postgresClient(url, { max: CALLS, ssl: "require", onnotice: () => {} }, STAGING_URL_VARIABLE));

  const garages = await db.select({ id: garageSettings.id }).from(garageSettings);
  const [rules] = await db.select({ capacity: slotRules.capacity }).from(slotRules);
  if (garages.length !== 1 || !rules) {
    throw new Error(`${STAGING_URL_VARIABLE} doesn't point at a seeded staging database: run staging:seed first.`);
  }
  capacity = rules.capacity;
  if (capacity >= CALLS - 1) throw new Error(`Slot capacity is ${capacity}: the test needs it below ${CALLS - 1} to prove anything.`);

  await db.delete(slotCounters).where(testDay);
  // Warm every connection at once, and prove they are separate server connections.
  const pids = await Promise.all(
    Array.from({ length: CALLS }, () =>
      db.execute(sql`select pg_backend_pid() as pid, pg_sleep(0.3)`).then((rows) => (rows as unknown as { pid: number }[])[0]!.pid),
    ),
  );
  expect(new Set(pids).size).toBe(CALLS);
});

afterAll(async () => {
  if (!db) return;
  await db.delete(slotCounters).where(testDay);
  await closeDatabase(db);
});

/** How many places are taken in the slot at `startsAt`. */
async function taken(startsAt: Date): Promise<number> {
  const [row] = await db.select({ reserved: slotCounters.reserved }).from(slotCounters).where(eq(slotCounters.startsAt, startsAt));
  return row?.reserved ?? 0;
}

/** The bug reserveSlot avoids: read the count, wait a moment, then write it. */
async function naiveReserve(startsAt: Date): Promise<boolean> {
  const reserved = await taken(startsAt);
  await db.execute(sql`select pg_sleep(0.2)`);
  if (reserved >= capacity) return false;
  await db
    .insert(slotCounters)
    .values({ startsAt, reserved: reserved + 1 })
    .onConflictDoUpdate({ target: slotCounters.startsAt, set: { reserved: reserved + 1 } });
  return true;
}

describe("on staging's Postgres", () => {
  test("negative control: the naive read-then-write reservation overbooks under the same load", async () => {
    const results = await Promise.all(Array.from({ length: CALLS }, () => naiveReserve(controlSlot)));
    expect(results.filter(Boolean).length).toBeGreaterThan(capacity);
  });

  test(`${CALLS} reservations at once on a free slot: exactly capacity succeed, the rest are full`, async () => {
    const results = await Promise.all(Array.from({ length: CALLS }, () => reserveSlot(db, freshSlot, clock)));
    expect(results.filter((result) => result.ok)).toHaveLength(capacity);
    expect(results.filter((result) => !result.ok)).toEqual(Array(CALLS - capacity).fill({ ok: false, problem: "full" }));
    expect(await taken(freshSlot)).toBe(capacity);
  });

  test("on a slot with one place already taken, exactly the remaining places go", async () => {
    expect(await reserveSlot(db, halfTakenSlot, clock)).toEqual({ ok: true });
    const results = await Promise.all(Array.from({ length: CALLS }, () => reserveSlot(db, halfTakenSlot, clock)));
    expect(results.filter((result) => result.ok)).toHaveLength(capacity - 1);
    expect(await taken(halfTakenSlot)).toBe(capacity);
  });
});
