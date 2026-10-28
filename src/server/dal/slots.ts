// Booking slots in the database: the schedule, the places left, and taking
// or giving back a place.
//
// The rules for callers (task 22's plan, KTD2, KTD3, KTD7, KTD8):
// 1. Only booking code calls reserveSlot, releaseSlot and moveSlot, inside
//    the transaction that writes the booking: pass that transaction as `db`.
//    Then the booking and its place are saved or rolled back together.
// 2. Reserve (or move) before the transaction's other writes, and return a
//    non-ok answer at once. Write the booking row, or change its slot, only
//    after an ok; otherwise returning "full" would commit a booking with no
//    place.
// 3. Any change to an existing booking's place (cancel, reschedule, deleting
//    a customer's data) first locks the booking row with
//    `select ... for update` and reads its slot and status from that locked
//    row, never from a form. Only then call releaseSlot or moveSlot, then
//    write the booking. Two such changes at once (a double click, a customer
//    and staff together) then run one after the other, and the second sees
//    the first's result: without the lock both read the old slot and give
//    its place back twice, and that slot can be overbooked.
// 4. Never call getDatabase(), readGarage() or readAvailableSlots() while a
//    transaction is open: each queries the database on its own, PGlite has
//    one connection, and that query would wait forever. Every read below
//    goes through the `db` it's given.
//
// Each change to a counter is one SQL statement whose WHERE re-checks the
// limit: Postgres locks the row and re-reads it before it writes, so two
// reservations at the same moment can never both take the last place.
// Nothing here is cached: the places left change with every booking.
//
// Nothing calls these yet: task 23 (booking), 25 and 27 (cancel and
// reschedule) do, after their own checks on who is asking.

import "server-only";

import { and, eq, gt, gte, lt, lte, sql } from "drizzle-orm";

import { addDays, indiaInstantOn } from "@/domain/india-time";
import {
  availableSlots,
  bookingWindow,
  checkSlotRequest,
  type Schedule,
  type SlotDay,
  type SlotRequestProblem,
} from "@/domain/slots";
import { type Clock, systemClock } from "@/lib/clock";
import { type Database, getDatabase } from "@/server/db";
import { calendarExceptions, openingHours, slotCounters, slotRules } from "@/server/db/schema";

import { weeklyHours } from "./garage";

/**
 * What the slot functions run their queries through: the database itself
 * or, for reserve and release, the caller's transaction on it.
 */
export type SlotDatabase = Pick<Database, "select" | "insert" | "update">;

/**
 * A transaction on the database: what moveSlot requires. A move is two
 * statements (take the new place, give back the old one), so it must never
 * run on the bare database, where a failed release would leave the new place
 * taken for good. (A transaction has `rollback()`; the database doesn't, so
 * passing the database fails `npm run typecheck`.)
 */
export type SlotTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** The answer to a reservation or a move. */
export type ReserveResult = { ok: true } | { ok: false; problem: SlotRequestProblem | "full" };

/**
 * The schedule for a booking made at `now`: the opening hours, the slot
 * rules, and the closed dates inside the booking window (none outside it
 * matter). Throws when the slot rules row is missing.
 */
export async function readSchedule(db: SlotDatabase, now: Date): Promise<Schedule> {
  // One query after another, not Promise.all: inside a transaction, some
  // drivers don't take two queries at once.
  const [rules] = await db.select().from(slotRules).where(eq(slotRules.id, 1));
  if (!rules) {
    throw new Error(
      "The slot rules are missing: the slot_rules table has no row. " +
        "Locally, restart `npm run dev` (the seed adds it); on Postgres, task 20's seed writes it.",
    );
  }
  const hoursRows = await db.select().from(openingHours);

  const schedule = {
    hours: weeklyHours(hoursRows),
    rules: {
      slotMinutes: rules.slotMinutes,
      capacity: rules.capacity,
      minDaysAhead: rules.minDaysAhead,
      maxDaysAhead: rules.maxDaysAhead,
    },
  };
  const { first, last } = bookingWindow(schedule.rules, now);
  const closedRows = await db
    .select({ date: calendarExceptions.date })
    .from(calendarExceptions)
    .where(and(gte(calendarExceptions.date, first), lte(calendarExceptions.date, last)));

  return { ...schedule, closedDates: new Set(closedRows.map((row) => row.date)) };
}

/**
 * The booking window's days with their slots and places left, as of now.
 *
 * Reads the time and live counts: call it at request time, inside a
 * <Suspense> boundary (task 23), never while a page is prerendered. It reads
 * the clock before its first query, so with Cache Components the caller runs
 * `await io()` from "next/cache" first (node_modules/next/dist/docs/01-app/
 * 03-api-reference/04-functions/io.md).
 */
export async function readAvailableSlots(clock: Clock = systemClock): Promise<SlotDay[]> {
  const now = clock.now();
  const db = await getDatabase();
  const schedule = await readSchedule(db, now);

  // Every counter from midnight (India time) on the first day to midnight
  // after the last.
  const { first, last } = bookingWindow(schedule.rules, now);
  const counters = await db
    .select()
    .from(slotCounters)
    .where(
      and(
        gte(slotCounters.startsAt, indiaInstantOn(first, 0)),
        lt(slotCounters.startsAt, indiaInstantOn(addDays(last, 1), 0)),
      ),
    );
  // Keyed by milliseconds: two Dates for the same moment are different keys.
  const reservedByStart = new Map(counters.map((row) => [row.startsAt.getTime(), row.reserved]));

  return availableSlots(schedule, reservedByStart, now);
}

/**
 * Takes one place in the slot starting at `startsAt`, if a customer may book
 * it now and a place is left. "Full" and the schedule problems come back as
 * answers; database errors are thrown as they are.
 */
export async function reserveSlot(db: SlotDatabase, startsAt: Date, clock: Clock = systemClock): Promise<ReserveResult> {
  const now = clock.now();
  const schedule = await readSchedule(db, now);
  const problem = checkSlotRequest(schedule, startsAt, now);
  if (problem) return { ok: false, problem };

  // One statement: insert the slot's counter with 1 place taken or, if it
  // exists, add 1 only while fewer than `capacity` are taken. No row back
  // means the slot was full. (Capacity is at least 1, a CHECK on slot_rules,
  // so the insert never passes it.)
  const taken = await db
    .insert(slotCounters)
    .values({ startsAt, reserved: 1 })
    .onConflictDoUpdate({
      target: slotCounters.startsAt,
      set: { reserved: sql`${slotCounters.reserved} + 1` },
      setWhere: lt(slotCounters.reserved, schedule.rules.capacity),
    })
    .returning({ reserved: slotCounters.reserved });
  return taken.length > 0 ? { ok: true } : { ok: false, problem: "full" };
}

/**
 * Gives back one place in the slot starting at `startsAt`. Throws when no
 * place is taken there: that means the counters and the bookings disagree,
 * and throwing rolls back the caller's transaction.
 */
export async function releaseSlot(db: SlotDatabase, startsAt: Date): Promise<void> {
  if (Number.isNaN(startsAt.getTime())) throw new Error("Can't release a slot: its start isn't a valid date.");

  // One statement: subtract 1 only while a place is taken.
  const released = await db
    .update(slotCounters)
    .set({ reserved: sql`${slotCounters.reserved} - 1` })
    .where(and(eq(slotCounters.startsAt, startsAt), gt(slotCounters.reserved, 0)))
    .returning({ reserved: slotCounters.reserved });
  if (released.length === 0) {
    throw new Error(
      `Can't release the slot at ${startsAt.toISOString()}: no place is taken there, so the slot counters and the bookings disagree.`,
    );
  }
}

/**
 * Moves one place from the slot at `from` to the slot at `to` (a
 * reschedule). Reserves the new slot first: if it's full or can't be booked,
 * that answer comes back before anything has changed. Moving to the same slot
 * changes nothing and succeeds, even when that slot is full.
 */
export async function moveSlot(
  db: SlotTransaction,
  from: Date,
  to: Date,
  clock: Clock = systemClock,
): Promise<ReserveResult> {
  if (from.getTime() === to.getTime()) return { ok: true };

  const reserved = await reserveSlot(db, to, clock);
  if (!reserved.ok) return reserved;
  // If this throws, the caller's transaction rolls back the reservation too.
  await releaseSlot(db, from);
  return { ok: true };
}
