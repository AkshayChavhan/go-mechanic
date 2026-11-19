// Which India day the staff bookings board shows (task 26).

import { addDays, type IndiaDate, parseIndiaDate } from "./india-time";

/**
 * How far the board reaches from today, either way. A year and a day, so
 * the same date next year (and a leap day) is still in range; it also keeps
 * every previous and next link a date the calendar can read.
 */
export const BOARD_RANGE_DAYS = 366;

/**
 * Whether `date` is within BOARD_RANGE_DAYS of `today`, both ends included.
 * The dates are "YYYY-MM-DD", so comparing them as text compares them as days.
 */
export function isOnBoard(date: IndiaDate, today: IndiaDate): boolean {
  return date >= addDays(today, -BOARD_RANGE_DAYS) && date <= addDays(today, BOARD_RANGE_DAYS);
}

/**
 * The day to show for the `?date=` value: the value itself when it's a real
 * date on the board, otherwise today. `note` is true when a value was given
 * but couldn't be used (several values, a date that can't be read, or one
 * too far away), so the page can say why it shows today. No value at all is
 * the normal first visit: today, without a note.
 */
export function pickBoardDate(
  value: string | string[] | undefined,
  today: IndiaDate,
): { date: IndiaDate; note: boolean } {
  if (value === undefined) return { date: today, note: false };
  const date = typeof value === "string" ? parseIndiaDate(value) : null;
  if (date === null || !isOnBoard(date, today)) return { date: today, note: true };
  return { date, note: false };
}
