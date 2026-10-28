// Booking slots: which times a customer can book, and whether one time is
// bookable right now.
//
// A slot is the hour (or other slot length) in which one vehicle reaches the
// garage, dropped off or picked up. Each slot takes up to `capacity` vehicles,
// cars and two-wheelers together. How long the work takes isn't modelled.
//
// Pure logic: no Next.js, React or database imports. Functions take `now` as
// a Date; the data-access layer (src/server/dal/slots.ts) reads the clock,
// the schedule and the reserved counts, and holds the counters themselves.
//
// The contract later booking tasks rely on (task 22's plan, KTD3, KTD7, KTD8):
// - Places are taken and given back only through reserveSlot, releaseSlot and
//   moveSlot in src/server/dal/slots.ts, inside the transaction that writes
//   the booking.
// - Reserve before writing the booking; return a non-ok answer at once.
// - "Full" and the problems below are answers, never thrown errors.

import { addDays, type IndiaDate, indiaDateOf, indiaInstantOn, weekdayIndexOf } from "./india-time";
import { openMinutes, type Weekday, WEEKDAYS, type WeeklyHours } from "./opening-hours";

/**
 * The slot rules: one row in the database (slot_rules), edited by the owner
 * from task 28 on. The owner's values are in src/server/db/seed-data.ts.
 */
export type SlotRules = {
  /** How long a slot is, in minutes (60). */
  slotMinutes: number;
  /** Vehicles per slot, cars and two-wheelers together. */
  capacity: number;
  /** The first bookable day, counted from today in India (1 = tomorrow). */
  minDaysAhead: number;
  /** The last bookable day, counted from today in India (7 = a week ahead). */
  maxDaysAhead: number;
};

/**
 * The range each rule must stay in, both ends included. The CHECKs on
 * slot_rules in src/server/db/schema.ts type the same numbers
 * (database.test.ts checks they match).
 */
export const SLOT_RULE_LIMITS = {
  slotMinutes: { min: 15, max: 480 },
  capacity: { min: 1, max: 50 },
  minDaysAhead: { min: 0, max: 60 },
  // Also never before minDaysAhead.
  maxDaysAhead: { min: 0, max: 60 },
} as const satisfies Record<keyof SlotRules, { min: number; max: number }>;

/** A rule that is out of its range (or, for maxDaysAhead, before minDaysAhead). */
export type SlotRulesProblem = { field: keyof SlotRules };

/** What's wrong with `rules`; an empty list means they're fine. */
export function checkSlotRules(rules: SlotRules): SlotRulesProblem[] {
  const problems: SlotRulesProblem[] = [];
  for (const field of Object.keys(SLOT_RULE_LIMITS) as (keyof SlotRules)[]) {
    const value = rules[field];
    const { min, max } = SLOT_RULE_LIMITS[field];
    const outOfRange = !Number.isInteger(value) || value < min || value > max;
    const beforeMin = field === "maxDaysAhead" && value < rules.minDaysAhead;
    if (outOfRange || beforeMin) problems.push({ field });
  }
  return problems;
}

/** Everything the calculator needs to know about the garage's schedule. */
export type Schedule = {
  hours: WeeklyHours;
  rules: SlotRules;
  /** India dates the garage is closed although their weekday has hours (festivals). */
  closedDates: ReadonlySet<IndiaDate>;
};

/** One bookable time. */
export type Slot = {
  startsAt: Date;
  endsAt: Date;
  /** Places left: 0 when full, never below 0 (even after the owner lowers capacity). */
  remaining: number;
};

/** One date in the booking window: closed, or open with its slots. */
export type SlotDay = { date: IndiaDate; weekday: Weekday } & (
  | { status: "open"; slots: Slot[] }
  // closed-weekday: its weekday has no hours (Monday). closed-date: a closed date.
  | { status: "closed-weekday" | "closed-date" }
);

/** Why a time can't be booked. A full slot is the database's answer ("full"), not one of these. */
export type SlotRequestProblem = "not-a-slot" | "closed-date" | "outside-window";

/**
 * The minutes after midnight at which `date`'s slots start, from its weekly
 * hours only (closed dates are checked separately).
 *
 * Slots start on whole multiples of the slot length after India midnight
 * (10:00, 11:00 ... for 1-hour slots), no earlier than opening, and end by
 * closing: with hours 10:30 to 18:30 the slots run 11:00 to 17:00. Anchoring
 * at midnight, not at opening, means an hours change only adds or removes
 * slots at the ends; the times of the others (and their reservations) stay.
 */
function slotStarts(schedule: Schedule, date: IndiaDate): number[] {
  const day = openMinutes(schedule.hours[weekdayOf(date)]);
  if (!day) return [];
  const length = schedule.rules.slotMinutes;
  const starts: number[] = [];
  for (let start = Math.ceil(day.opens / length) * length; start + length <= day.closes; start += length) {
    starts.push(start);
  }
  return starts;
}

function weekdayOf(date: IndiaDate): Weekday {
  return WEEKDAYS[weekdayIndexOf(date)];
}

/** The first and last bookable India dates when it's `now`, both included. */
export function bookingWindow(rules: SlotRules, now: Date): { first: IndiaDate; last: IndiaDate } {
  // India's date, never UTC's: from 00:00 to 05:30 in India, UTC still says
  // yesterday, and "tomorrow" in UTC would be today.
  const today = indiaDateOf(now);
  return { first: addDays(today, rules.minDaysAhead), last: addDays(today, rules.maxDaysAhead) };
}

/**
 * The booking window's dates (today + minDaysAhead to today + maxDaysAhead,
 * both included, India time), each closed or open with its slots and the
 * places left. Slots that have started are left out.
 *
 * `reservedByStart` holds the places taken, keyed by each slot's start in
 * epoch milliseconds (`startsAt.getTime()`): a Map keyed by Date objects
 * would never find anything. Invalid rules give an empty list.
 */
export function availableSlots(
  schedule: Schedule,
  reservedByStart: ReadonlyMap<number, number>,
  now: Date,
): SlotDay[] {
  const { rules } = schedule;
  if (checkSlotRules(rules).length > 0) return [];

  const { first } = bookingWindow(rules, now);
  const days: SlotDay[] = [];
  for (let offset = 0; offset <= rules.maxDaysAhead - rules.minDaysAhead; offset++) {
    const date = addDays(first, offset);
    const weekday = weekdayOf(date);
    if (!openMinutes(schedule.hours[weekday])) {
      days.push({ date, weekday, status: "closed-weekday" });
    } else if (schedule.closedDates.has(date)) {
      days.push({ date, weekday, status: "closed-date" });
    } else {
      const slots = slotStarts(schedule, date)
        .map((minutes) => indiaInstantOn(date, minutes))
        .filter((startsAt) => startsAt.getTime() > now.getTime())
        .map((startsAt) => ({
          startsAt,
          endsAt: new Date(startsAt.getTime() + rules.slotMinutes * 60_000),
          remaining: Math.max(0, rules.capacity - (reservedByStart.get(startsAt.getTime()) ?? 0)),
        }));
      days.push({ date, weekday, status: "open", slots });
    }
  }
  return days;
}

/**
 * Why a customer can't book the slot starting at `startsAt` now, or null when
 * they can (if a place is left: the database checks that). Uses the same
 * window and slot times as availableSlots, so the two never disagree.
 * Checked in this order: an Invalid Date or invalid rules ("not-a-slot"),
 * outside the booking window, including a slot that has started
 * ("outside-window"), not a slot time on that date ("not-a-slot"), on a
 * closed date ("closed-date"). So 10:30 on a day past the window is
 * "outside-window", not "not-a-slot".
 */
export function checkSlotRequest(schedule: Schedule, startsAt: Date, now: Date): SlotRequestProblem | null {
  // An Invalid Date (from a bad form value) or invalid rules: nothing to book.
  if (Number.isNaN(startsAt.getTime()) || checkSlotRules(schedule.rules).length > 0) return "not-a-slot";

  const date = indiaDateOf(startsAt);
  const { first, last } = bookingWindow(schedule.rules, now);
  // "YYYY-MM-DD" strings sort like the dates they name.
  if (date < first || date > last || startsAt.getTime() <= now.getTime()) return "outside-window";

  // Comparing exact instants also refuses a stray second or millisecond.
  const isSlotTime = slotStarts(schedule, date).some(
    (minutes) => indiaInstantOn(date, minutes).getTime() === startsAt.getTime(),
  );
  if (!isSlotTime) return "not-a-slot";

  if (schedule.closedDates.has(date)) return "closed-date";
  return null;
}
