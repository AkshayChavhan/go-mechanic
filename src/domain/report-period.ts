// Which India days the staff reports cover (task 41): the last 7, 30 or 90
// days ending today, or a custom from/to range. Everything here reads the
// page's (or the CSV link's) query string, so it trusts nothing in it.

import { addDays, type IndiaDate, indiaInstantOn, parseIndiaDate } from "./india-time";

/** The quick choices, in days ending today. */
export const REPORT_PRESETS = [7, 30, 90] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];

/** What the reports show without a choice. */
export const REPORT_DEFAULT_DAYS: ReportPreset = 30;

/** The longest custom range, in days, both ends included: a year and a day (leap years). */
export const REPORT_MAX_DAYS = 366;

/** Why a range in the address couldn't be used, so the page can say so. */
export type ReportPeriodNote = "unreadable" | "reversed" | "too-long";

export type ReportPeriod = {
  /** The first day, included. */
  from: IndiaDate;
  /** The last day, included. It may be in the future: bookings sit up to 60 days ahead. */
  to: IndiaDate;
  /** The preset this is, or null for a custom range. */
  preset: ReportPreset | null;
  /** Set when the address asked for something else and the default is shown instead. */
  note: ReportPeriodNote | null;
};

/** How many days `from` to `to` covers, both included ("2026-11-01" to "2026-11-07" is 7). */
export function daysInPeriod(from: IndiaDate, to: IndiaDate): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
}

/** The last `days` India days, ending today. */
export function presetPeriod(days: ReportPreset, today: IndiaDate): ReportPeriod {
  return { from: addDays(today, -(days - 1)), to: today, preset: days, note: null };
}

/** A from/to pair that reports may use: both real dates, in order, at most REPORT_MAX_DAYS. */
export function checkReportRange(
  from: unknown,
  to: unknown,
): { ok: true; from: IndiaDate; to: IndiaDate } | { ok: false; problem: ReportPeriodNote } {
  const first = typeof from === "string" ? parseIndiaDate(from) : null;
  const last = typeof to === "string" ? parseIndiaDate(to) : null;
  if (first === null || last === null) return { ok: false, problem: "unreadable" };
  if (first > last) return { ok: false, problem: "reversed" };
  if (daysInPeriod(first, last) > REPORT_MAX_DAYS) return { ok: false, problem: "too-long" };
  return { ok: true, from: first, to: last };
}

type QueryValue = string | string[] | undefined;

/**
 * The period for `?days=` or `?from=&to=`. A `from` or a `to` makes it a
 * custom range (and `days` is ignored). Anything that can't be used shows
 * the default 30 days with a note saying why; nothing at all is the normal
 * first visit: 30 days, no note.
 */
export function pickReportPeriod(
  query: { days?: QueryValue; from?: QueryValue; to?: QueryValue },
  today: IndiaDate,
): ReportPeriod {
  const fallback = (note: ReportPeriodNote): ReportPeriod => ({
    ...presetPeriod(REPORT_DEFAULT_DAYS, today),
    note,
  });

  if (query.from !== undefined || query.to !== undefined) {
    const range = checkReportRange(query.from, query.to);
    if (!range.ok) return fallback(range.problem);
    return { from: range.from, to: range.to, preset: null, note: null };
  }
  if (query.days === undefined) return presetPeriod(REPORT_DEFAULT_DAYS, today);
  const preset = REPORT_PRESETS.find((days) => query.days === String(days));
  return preset === undefined ? fallback("unreadable") : presetPeriod(preset, today);
}

/**
 * The query a CSV link carries: always the resolved dates, never `days`, so
 * a download just after India midnight (or after a fallback) covers exactly
 * the days the page showed.
 */
export function reportQuery(period: ReportPeriod): { from: IndiaDate; to: IndiaDate } {
  return { from: period.from, to: period.to };
}

/** The moments a period covers: from India midnight on `from` up to (not including) India midnight after `to`. */
export function periodWindow(period: { from: IndiaDate; to: IndiaDate }): { start: Date; end: Date } {
  return { start: indiaInstantOn(period.from, 0), end: indiaInstantOn(addDays(period.to, 1), 0) };
}
