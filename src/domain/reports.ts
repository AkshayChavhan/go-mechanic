// The staff reports' tables (task 41), built once from the data-access rows
// and shown two ways: as a table on /admin/reports and as a CSV download.
// Both go through the same builders, so the screen and the file can't
// disagree. Cells hold plain values; the page formats them, the CSV writes
// them as they are. Words (column headings, "Total", "Unassigned") are keys
// that the caller turns into text with its messages.

import { BOOKING_STATUSES, type BookingStatus } from "./bookings";
import { type IndiaDate, indiaDateOf } from "./india-time";
import { averageRating, RATINGS } from "./reviews";

/** The four reports, in the order the page shows them (bookings, the long one, last). */
export const REPORT_NAMES = ["rating", "top-services", "workload", "bookings"] as const;
export type ReportName = (typeof REPORT_NAMES)[number];

export function isReportName(value: unknown): value is ReportName {
  return (REPORT_NAMES as readonly unknown[]).includes(value);
}

/** A word the caller translates: a table's row label. */
export type ReportLabel = "total" | "average" | "unassigned" | "unnamed";

export type ReportCell =
  | { kind: "date"; value: IndiaDate }
  | { kind: "number"; value: number }
  /** A one-decimal average, or null with nothing to average. */
  | { kind: "average"; value: number | null }
  | { kind: "text"; value: string }
  | { kind: "label"; value: ReportLabel };

/** The columns each report has, as message keys. The first column names its rows. */
export const REPORT_COLUMNS = {
  bookings: ["day", ...BOOKING_STATUSES, "total"],
  "top-services": ["service", "bookings"],
  rating: ["stars", "reviews"],
  workload: ["mechanic", "bookings", "completed"],
} as const satisfies Record<ReportName, readonly string[]>;

export type ReportColumn = (typeof REPORT_COLUMNS)[ReportName][number];

export type ReportTable = {
  report: ReportName;
  columns: readonly ReportColumn[];
  /** One row per day, service, star or mechanic. Empty when the period has nothing to show. */
  rows: ReportCell[][];
  /** Rows under the table: the totals (and the rating's average). Empty when `rows` is. */
  footer: ReportCell[][];
};

const num = (value: number): ReportCell => ({ kind: "number", value });
const label = (value: ReportLabel): ReportCell => ({ kind: "label", value });

// --- Bookings ---------------------------------------------------------------------

/** One booking as the bookings report needs it: when its slot starts, and its status. */
export type BookingReportRow = { startsAt: Date; status: BookingStatus };

/**
 * Bookings per India day of their slot, by status, oldest day first. Days
 * without bookings are left out; the footer adds up each status.
 */
export function bookingsTable(rows: readonly BookingReportRow[]): ReportTable {
  const noBookings = () =>
    Object.fromEntries(BOOKING_STATUSES.map((status) => [status, 0])) as Record<BookingStatus, number>;
  const byDay = new Map<IndiaDate, Record<BookingStatus, number>>();
  const totals = noBookings();
  for (const { startsAt, status } of rows) {
    const day = indiaDateOf(startsAt);
    const counts = byDay.get(day) ?? noBookings();
    counts[status] += 1;
    totals[status] += 1;
    byDay.set(day, counts);
  }
  const line = (first: ReportCell, counts: Record<BookingStatus, number>): ReportCell[] => [
    first,
    ...BOOKING_STATUSES.map((status) => num(counts[status])),
    num(BOOKING_STATUSES.reduce((sum, status) => sum + counts[status], 0)),
  ];
  const days = [...byDay.keys()].sort();
  return {
    report: "bookings",
    columns: REPORT_COLUMNS.bookings,
    rows: days.map((day) => line({ kind: "date", value: day }, byDay.get(day)!)),
    footer: days.length === 0 ? [] : [line(label("total"), totals)],
  };
}

// --- Top services -----------------------------------------------------------------

/** A service or package, already in the reader's language, with how many bookings include it. */
export type TopServiceRow = { name: string; bookings: number };

/** Services by how many bookings include them, most first; a tie goes by name. */
export function topServicesTable(rows: readonly TopServiceRow[]): ReportTable {
  const sorted = [...rows].sort((a, b) => b.bookings - a.bookings || a.name.localeCompare(b.name));
  return {
    report: "top-services",
    columns: REPORT_COLUMNS["top-services"],
    rows: sorted.map(({ name, bookings }) => [{ kind: "text", value: name }, num(bookings)]),
    footer: [],
  };
}

// --- Rating -----------------------------------------------------------------------

/** How many published reviews gave `rating` stars. Ratings with none may be left out. */
export type RatingReportRow = { rating: number; count: number };

/**
 * Reviews per star, 5 down to 1, with the total and the average under them.
 * No reviews at all is an empty report.
 */
export function ratingTable(rows: readonly RatingReportRow[]): ReportTable {
  const count = rows.reduce((sum, row) => sum + row.count, 0);
  if (count === 0) return { report: "rating", columns: REPORT_COLUMNS.rating, rows: [], footer: [] };
  const sum = rows.reduce((total, row) => total + row.rating * row.count, 0);
  const countOf = (stars: number) => rows.filter((row) => row.rating === stars).reduce((n, row) => n + row.count, 0);
  return {
    report: "rating",
    columns: REPORT_COLUMNS.rating,
    rows: [...RATINGS].reverse().map((stars) => [num(stars), num(countOf(stars))]),
    footer: [
      [label("total"), num(count)],
      [label("average"), { kind: "average", value: averageRating(sum, count) }],
    ],
  };
}

// --- Mechanic workload ------------------------------------------------------------

/**
 * Bookings given to one person, or to nobody (`mechanicId` null). The name is
 * whoever the booking is assigned to now, whatever their role is today.
 */
export type WorkloadReportRow = { mechanicId: string | null; name: string | null; bookings: number; completed: number };

/** Bookings per assigned person, most first (a tie goes by name); "Unassigned" last. */
export function workloadTable(rows: readonly WorkloadReportRow[]): ReportTable {
  const assigned = rows
    .filter((row) => row.mechanicId !== null)
    .sort((a, b) => b.bookings - a.bookings || (a.name ?? "").localeCompare(b.name ?? ""));
  const unassigned = rows.filter((row) => row.mechanicId === null);
  const line = (first: ReportCell, row: WorkloadReportRow): ReportCell[] => [first, num(row.bookings), num(row.completed)];
  return {
    report: "workload",
    columns: REPORT_COLUMNS.workload,
    rows: [
      ...assigned.map((row) =>
        line(row.name?.trim() ? { kind: "text", value: row.name.trim() } : label("unnamed"), row),
      ),
      ...unassigned.map((row) => line(label("unassigned"), row)),
    ],
    footer: [],
  };
}

// --- For the CSV --------------------------------------------------------------------

/**
 * The table as CSV rows: the headings, the rows and the footer, every cell a
 * plain string or number. `heading` and `labelText` turn the keys into words.
 */
export function tableToCsvRows(
  table: ReportTable,
  heading: (column: ReportColumn) => string,
  labelText: (label: ReportLabel) => string,
): (string | number)[][] {
  const cell = (value: ReportCell): string | number => {
    switch (value.kind) {
      case "label":
        return labelText(value.value);
      case "average":
        return value.value ?? "";
      default:
        return value.value;
    }
  };
  return [table.columns.map(heading), ...[...table.rows, ...table.footer].map((row) => row.map(cell))];
}
