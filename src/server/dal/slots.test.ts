import { eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { fixedClock } from "@/lib/clock";
import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { calendarExceptions, slotCounters, slotRules } from "@/server/db/schema";
import { seedSlotRules } from "@/server/db/seed";

import { moveSlot, readAvailableSlots, releaseSlot, reserveSlot } from "./slots";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine:
// in task 14 the 10-second hook limit timed out under load (load average
// ~14) while the same tests took ~16 s alone. Only these database test files
// get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// getDatabase is swapped for an in-memory PGlite (migrated and seeded, like
// the real one: the owner's hours and slot rules). next/cache is swapped for
// spies because slots.ts imports garage.ts, whose cached read uses it.
vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  getDatabase: vi.fn(),
}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn(), updateTag: vi.fn() }));

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
  // Back to no places taken, no closed dates and the owner's rules.
  await db.delete(slotCounters);
  await db.delete(calendarExceptions);
  await db.delete(slotRules);
  await seedSlotRules(db);
});

// Every instant below is written in UTC, with the India time in a comment.
// Now is Wednesday 28 Oct 2026, 17:54 in India; the window is 29 Oct to 4 Nov.
const clock = fixedClock(new Date("2026-10-28T12:24:00Z"));
/** 10:00 on Thursday 29 Oct. */
const thursday10 = new Date("2026-10-29T04:30:00Z");
/** 11:00 on Thursday 29 Oct. */
const thursday11 = new Date("2026-10-29T05:30:00Z");

/** Places taken in the slot starting at `startsAt`, or null when it has no counter yet. */
async function taken(startsAt: Date): Promise<number | null> {
  const [row] = await db.select().from(slotCounters).where(eq(slotCounters.startsAt, startsAt));
  return row ? row.reserved : null;
}

function slotsOf(days: Awaited<ReturnType<typeof readAvailableSlots>>) {
  return days.flatMap((day) => (day.status === "open" ? day.slots : []));
}

describe("readAvailableSlots", () => {
  test("on the seed: the week's 54 slots, 2 places each", async () => {
    const days = await readAvailableSlots(clock);
    expect(days.map((day) => day.date)).toEqual([
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
    ]);
    const slots = slotsOf(days);
    expect(slots).toHaveLength(54);
    expect(slots.every((slot) => slot.remaining === 2)).toBe(true);
  });

  test("shows the places taken", async () => {
    expect(await reserveSlot(db, thursday10, clock)).toEqual({ ok: true });
    const [first, second] = slotsOf(await readAvailableSlots(clock));
    expect(first).toMatchObject({ startsAt: thursday10, remaining: 1 });
    expect(second).toMatchObject({ startsAt: thursday11, remaining: 2 });
  });

  test("shows a closed date as closed", async () => {
    await db.insert(calendarExceptions).values({ date: "2026-10-31" });
    const days = await readAvailableSlots(clock);
    expect(days[2]).toEqual({ date: "2026-10-31", weekday: "saturday", status: "closed-date" });
  });

  test("throws a clear error when the slot rules row is missing", async () => {
    await db.delete(slotRules);
    await expect(readAvailableSlots(clock)).rejects.toThrow("slot_rules table has no row");
  });
});

describe("reserveSlot", () => {
  test("takes places up to capacity, then answers full", async () => {
    expect(await reserveSlot(db, thursday10, clock)).toEqual({ ok: true });
    expect(await reserveSlot(db, thursday10, clock)).toEqual({ ok: true });
    expect(await taken(thursday10)).toBe(2);

    expect(await reserveSlot(db, thursday10, clock)).toEqual({ ok: false, problem: "full" });
    expect(await taken(thursday10)).toBe(2);
    // The next slot is untouched.
    expect(await taken(thursday11)).toBeNull();
  });

  test("five reservations at once never take more than capacity", async () => {
    // Each call gets the bare test database, not a transaction of its own.
    // PGlite runs one query, or one whole transaction, at a time: bare calls
    // interleave query by query, so a reservation that read the count and
    // then wrote it in a second query would overbook here (checked once by
    // breaking reserveSlot that way). A transaction per call would run them
    // one after another and hide that. The real row race needs a real
    // Postgres: task 20 runs it on staging.
    const results = await Promise.all(Array.from({ length: 5 }, () => reserveSlot(db, thursday10, clock)));

    expect(results.filter((result) => result.ok)).toHaveLength(2);
    expect(results.filter((result) => !result.ok)).toEqual(Array(3).fill({ ok: false, problem: "full" }));
    expect(await taken(thursday10)).toBe(2);
  });

  test.each([
    ["10:30 on Thursday, between two slots", new Date("2026-10-29T05:00:00Z"), "not-a-slot"],
    ["18:00 today (no same-day booking)", new Date("2026-10-28T12:30:00Z"), "outside-window"],
    ["10:00 on Thursday 5 Nov, 8 days ahead", new Date("2026-11-05T04:30:00Z"), "outside-window"],
    ["an Invalid Date", new Date("not a date"), "not-a-slot"],
  ] as const)("refuses %s and writes nothing", async (_, startsAt, problem) => {
    expect(await reserveSlot(db, startsAt, clock)).toEqual({ ok: false, problem });
    expect(await db.$count(slotCounters)).toBe(0);
  });

  test("refuses a slot on a closed date and writes nothing", async () => {
    await db.insert(calendarExceptions).values({ date: "2026-10-31" });
    // 10:00 on Saturday 31 Oct.
    expect(await reserveSlot(db, new Date("2026-10-31T04:30:00Z"), clock)).toEqual({
      ok: false,
      problem: "closed-date",
    });
    expect(await db.$count(slotCounters)).toBe(0);
  });

  test("after the owner lowers capacity below the places taken, answers full and shows 0 left", async () => {
    await reserveSlot(db, thursday10, clock);
    await reserveSlot(db, thursday10, clock);
    await db.update(slotRules).set({ capacity: 1 });

    expect(await reserveSlot(db, thursday10, clock)).toEqual({ ok: false, problem: "full" });
    expect(slotsOf(await readAvailableSlots(clock))[0]).toMatchObject({ startsAt: thursday10, remaining: 0 });
  });

  test("inside a transaction, the place is saved with the booking", async () => {
    await db.transaction(async (tx) => {
      expect(await reserveSlot(tx, thursday10, clock)).toEqual({ ok: true });
    });
    expect(await taken(thursday10)).toBe(1);
  });

  test("inside a transaction that fails, the place rolls back with it", async () => {
    const bookingFailed = new Error("the booking insert failed");
    await expect(
      db.transaction(async (tx) => {
        expect(await reserveSlot(tx, thursday10, clock)).toEqual({ ok: true });
        throw bookingFailed;
      }),
    ).rejects.toBe(bookingFailed);
    expect(await taken(thursday10)).toBeNull();
  });

  test("passes a database error on, as Drizzle reports it", async () => {
    const closed = await createDatabase({ driver: "pglite", dataDir: null });
    await closeDatabase(closed);
    const failure = await reserveSlot(closed, thursday10, clock).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(DrizzleQueryError);
    expect((failure as DrizzleQueryError).cause).toMatchObject({ message: expect.stringContaining("PGlite is closed") });
  });

  test("throws a clear error when the slot rules row is missing", async () => {
    await db.delete(slotRules);
    await expect(reserveSlot(db, thursday10, clock)).rejects.toThrow("slot_rules table has no row");
  });
});

describe("releaseSlot", () => {
  test("gives one place back", async () => {
    await reserveSlot(db, thursday10, clock);
    await reserveSlot(db, thursday10, clock);
    await releaseSlot(db, thursday10);
    expect(await taken(thursday10)).toBe(1);
  });

  test("throws when the slot has no counter, and writes nothing", async () => {
    await expect(releaseSlot(db, thursday10)).rejects.toThrow("no place is taken there");
    expect(await taken(thursday10)).toBeNull();
  });

  test("throws when no place is taken, and never goes below 0", async () => {
    await reserveSlot(db, thursday10, clock);
    await releaseSlot(db, thursday10);
    await expect(releaseSlot(db, thursday10)).rejects.toThrow("no place is taken there");
    expect(await taken(thursday10)).toBe(0);
  });

  test("throws for an Invalid Date", async () => {
    await expect(releaseSlot(db, new Date("not a date"))).rejects.toThrow("isn't a valid date");
  });
});

describe("moveSlot", () => {
  test("moves a place from one slot to another", async () => {
    await reserveSlot(db, thursday10, clock);
    expect(await moveSlot(db, thursday10, thursday11, clock)).toEqual({ ok: true });
    expect(await taken(thursday10)).toBe(0);
    expect(await taken(thursday11)).toBe(1);
  });

  test("into a full slot: answers full and changes neither slot", async () => {
    await reserveSlot(db, thursday10, clock);
    await reserveSlot(db, thursday11, clock);
    await reserveSlot(db, thursday11, clock);

    expect(await moveSlot(db, thursday10, thursday11, clock)).toEqual({ ok: false, problem: "full" });
    expect(await taken(thursday10)).toBe(1);
    expect(await taken(thursday11)).toBe(2);
  });

  test("into a slot that can't be booked: answers why and changes nothing", async () => {
    await reserveSlot(db, thursday10, clock);
    // 10:00 on Monday 2 Nov, the closed day.
    expect(await moveSlot(db, thursday10, new Date("2026-11-02T04:30:00Z"), clock)).toEqual({
      ok: false,
      problem: "not-a-slot",
    });
    expect(await taken(thursday10)).toBe(1);
  });

  test("to the same slot: succeeds and changes nothing, even when it's full", async () => {
    await reserveSlot(db, thursday10, clock);
    await reserveSlot(db, thursday10, clock);
    expect(await moveSlot(db, thursday10, new Date(thursday10.getTime()), clock)).toEqual({ ok: true });
    expect(await taken(thursday10)).toBe(2);
  });

  test("from a slot with no place taken: throws, and the transaction rolls back the new place", async () => {
    await expect(db.transaction((tx) => moveSlot(tx, thursday10, thursday11, clock))).rejects.toThrow(
      "no place is taken there",
    );
    expect(await taken(thursday11)).toBeNull();
  });
});
