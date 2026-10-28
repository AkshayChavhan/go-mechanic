// India's clock and calendar: what time and date it is in India at a given
// moment, and the moment India's clock shows a given time on a given date.
//
// The garage runs on India time, but servers usually run in UTC and a visitor
// may be abroad. So everything here reads India's wall clock through Intl
// with GARAGE_TIME_ZONE: never the computer's own clock (date.getHours())
// and never a typed "+05:30".
//
// Pure logic, used by the open badge (opening-hours.ts) and the slot engine
// (slots.ts). Moved here from opening-hours.ts in task 22, so there's one copy.

import { GARAGE_TIME_ZONE } from "@/i18n/config";

/**
 * A date on India's calendar, written "YYYY-MM-DD" ("2026-10-29"): the form a
 * Postgres `date` column returns. Not a moment in time: 29 Oct in India starts
 * at 18:30 UTC on 28 Oct.
 */
export type IndiaDate = string;

/** The date and time shown on a clock in India. Months count from 1. */
export type IndiaWallClock = { year: number; month: number; day: number; hour: number; minute: number; second: number };

// Reads the date and time shown on a clock in India. "en-US" only so the
// parts come back as plain digits; it doesn't change the time zone.
// hourCycle "h23" writes midnight as 00, not 24.
const indiaClock = new Intl.DateTimeFormat("en-US", {
  timeZone: GARAGE_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

/** What a clock in India shows at `instant`. */
export function indiaWallClockAt(instant: Date | number): IndiaWallClock {
  // formatToParts gives [{ type: "month", value: "10" }, { type: "literal", value: "/" }, ...]
  const parts: Record<string, number> = {};
  for (const { type, value } of indiaClock.formatToParts(instant)) parts[type] = Number(value);
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/**
 * How far India's clock is ahead of UTC at `instant`, in milliseconds
 * (5 h 30 min). Measured with Intl, not typed in.
 */
function indiaOffsetAt(instant: number): number {
  const clock = indiaWallClockAt(instant);
  const clockAsUtc = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, clock.second);
  // Intl drops milliseconds, so drop them from the instant too.
  return clockAsUtc - Math.floor(instant / 1000) * 1000;
}

/** A day on India's calendar: the date parts of an IndiaWallClock. */
type CalendarDay = Pick<IndiaWallClock, "year" | "month" | "day">;

/**
 * The moment India's clock shows `minutes` after midnight, `daysAhead` days
 * after the India date in `today`. Date.UTC handles month and year ends
 * (31 Oct + 1 day = 1 Nov).
 */
export function indiaInstant(today: CalendarDay, daysAhead: number, minutes: number): Date {
  const clockAsUtc = Date.UTC(today.year, today.month - 1, today.day + daysAhead, 0, minutes);
  // Subtract India's offset to get the real moment. The offset is measured
  // twice: first near the answer (at clockAsUtc), then at that first guess.
  // India has no daylight saving time, so both give 5 h 30 min; the second
  // step only matters if the garage's time zone ever changed its clocks.
  const guess = clockAsUtc - indiaOffsetAt(clockAsUtc);
  return new Date(clockAsUtc - indiaOffsetAt(guess));
}

/** Monday = 0 ... Sunday = 6, for a date on India's calendar. */
export function weekdayIndex(day: CalendarDay): number {
  // getUTCDay counts from Sunday = 0; shift it so Monday comes first.
  return (new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay() + 6) % 7;
}

// --- "YYYY-MM-DD" dates ------------------------------------------------------
//
// Calendar sums below use Date.UTC and getUTC... only as a calendar: no time
// zone is involved, so they give the same answer on any computer.

const pad = (value: number) => String(value).padStart(2, "0");

function calendarDay(date: IndiaDate): CalendarDay {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function formatDay({ year, month, day }: CalendarDay): IndiaDate {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** The India date at `instant`: "2026-10-29" from 18:30 UTC on 28 Oct onwards. */
export function indiaDateOf(instant: Date): IndiaDate {
  return formatDay(indiaWallClockAt(instant));
}

/** `date` plus `days` (which may be negative): "2026-10-31" + 1 = "2026-11-01". */
export function addDays(date: IndiaDate, days: number): IndiaDate {
  const { year, month, day } = calendarDay(date);
  const sum = new Date(Date.UTC(year, month - 1, day + days));
  return formatDay({ year: sum.getUTCFullYear(), month: sum.getUTCMonth() + 1, day: sum.getUTCDate() });
}

/** Monday = 0 ... Sunday = 6, for an India date. */
export function weekdayIndexOf(date: IndiaDate): number {
  return weekdayIndex(calendarDay(date));
}

/** The moment India's clock shows `minutes` after midnight on `date`. */
export function indiaInstantOn(date: IndiaDate, minutes: number): Date {
  return indiaInstant(calendarDay(date), 0, minutes);
}
