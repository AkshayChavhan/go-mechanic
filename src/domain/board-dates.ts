// What the staff bookings board shows: which India day (task 26), whether
// cancelled bookings are listed, and the notice after a board action (task 27).
// Everything here reads the page's query string, so it trusts nothing in it.

import { BOOKING_CODE_ALPHABET } from "./bookings";
import { addDays, type IndiaDate, parseIndiaDate } from "./india-time";

/**
 * How far the board reaches from today, either way. A year and a day, so
 * the same date next year (and a leap day) is still in range; it also keeps
 * every previous and next link a date the calendar can read.
 */
export const BOARD_RANGE_DAYS = 366;

/** The first and last day the board shows, BOARD_RANGE_DAYS either side of `today`. */
export function boardRange(today: IndiaDate): { first: IndiaDate; last: IndiaDate } {
  return { first: addDays(today, -BOARD_RANGE_DAYS), last: addDays(today, BOARD_RANGE_DAYS) };
}

/**
 * Whether `date` is within the board's range, both ends included.
 * The dates are "YYYY-MM-DD", so comparing them as text compares them as days.
 */
export function isOnBoard(date: IndiaDate, today: IndiaDate): boolean {
  const { first, last } = boardRange(today);
  return date >= first && date <= last;
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

// --- The cancelled filter (task 27) --------------------------------------------

/** The query value that lists cancelled bookings: /admin/bookings?cancelled=show. */
export const SHOW_CANCELLED = "show";

/** Whether `?cancelled=` asks for cancelled bookings. Anything but "show" (or no value) hides them. */
export function parseShowCancelled(value: string | string[] | undefined): boolean {
  return value === SHOW_CANCELLED;
}

/** What the board shows besides its bookings: the day and the cancelled filter. */
export type BoardView = {
  /** Null for "today" (the board's address without a date). */
  date: IndiaDate | null;
  showCancelled: boolean;
};

/**
 * A board view a Server Action was bound to, checked again on the server: a
 * hand-made call can send anything. A date that can't be read becomes null
 * (the board then shows today), and only `true` turns the filter on.
 */
export function checkBoardView(value: unknown): BoardView {
  if (typeof value !== "object" || value === null) return { date: null, showCancelled: false };
  const { date, showCancelled } = value as Record<string, unknown>;
  return {
    date: typeof date === "string" ? parseIndiaDate(date) : null,
    showCancelled: showCancelled === true,
  };
}

/**
 * The board's query for a view: `{ date, cancelled: "show" }`, leaving out
 * what isn't set. Every day link, the date form and every action's redirect
 * go through it, so they all keep the filter (the plan's R12).
 */
export function boardQuery(view: BoardView): { date?: IndiaDate; cancelled?: typeof SHOW_CANCELLED } {
  return {
    ...(view.date !== null && { date: view.date }),
    ...(view.showCancelled && { cancelled: SHOW_CANCELLED }),
  };
}

// --- The notice after an action (task 27) ---------------------------------------

/** Notices that say a change was saved (or that nothing needed saving). */
export const BOARD_SUCCESS_NOTICES = [
  "confirmed",
  "cancelled",
  "no-show",
  "arrived",
  "assigned",
  "unchanged",
  /** The job moved to a new step from the Job step control (task 33). */
  "job-moved",
] as const;

/** Notices that say a change was refused, and what to do next. */
export const BOARD_REFUSAL_NOTICES = [
  /** The booking changed since the page was shown (not-allowed, stale). */
  "changed",
  "job-started",
  "too-early",
  "job-closed",
  "not-a-mechanic",
  "reason-too-short",
  "reason-too-long",
  /** The job's step changed since the page was shown, so that move no longer fits (task 33). */
  "job-step-changed",
  /** "Vehicle received" before the booking's India day: updateJob refuses it (owner, 2026-11-22). */
  "before-booking-day",
  /** A form that was tampered with or broken: nothing saved. */
  "not-saved",
] as const;

export const BOARD_NOTICES = [...BOARD_SUCCESS_NOTICES, ...BOARD_REFUSAL_NOTICES] as const;
export type BoardNotice = (typeof BOARD_NOTICES)[number];

export function isRefusalNotice(notice: BoardNotice): boolean {
  return (BOARD_REFUSAL_NOTICES as readonly string[]).includes(notice);
}

const BOOKING_CODE = new RegExp(`^[${BOOKING_CODE_ALPHABET}]{6}$`);

/**
 * The `?notice=` and `?code=` an action redirected with, or null. Both come
 * from the address bar, so only a known notice and a well-formed code (six
 * characters from the code alphabet, stored form, no dash) get through. The
 * board then shows the notice only when the code is one of the day's
 * bookings, and prints that booking's own code, never this value.
 */
export function parseBoardNotice(
  notice: string | string[] | undefined,
  code: string | string[] | undefined,
): { notice: BoardNotice; code: string } | null {
  if (typeof notice !== "string" || typeof code !== "string") return null;
  if (!(BOARD_NOTICES as readonly string[]).includes(notice) || !BOOKING_CODE.test(code)) return null;
  return { notice: notice as BoardNotice, code };
}
