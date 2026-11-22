// The staff reports' reads (task 41): four live reads, one per report, for
// staff with "reports.view" (manager, owner).
//
// The rules of this folder are in garage.ts. Each read calls
// authorize("reports.view") on its first line, then checks its period, then
// calls getDatabase(). Live, never cached: the reports must count today's
// bookings. The rows go to the table builders in src/domain/reports.ts,
// which the page and the CSV share.
//
// Which bookings count (plan KTD3): the bookings report counts every status.
// Top services and workload count only active bookings (booked, confirmed):
// a cancelled or no-show booking wasn't serviced, and cancelling doesn't
// clear the assigned mechanic. Everything counts on its slot's India day.

import "server-only";

import { and, countDistinct, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { ACTIVE_STATUSES } from "@/domain/bookings";
import { checkReportRange, periodWindow } from "@/domain/report-period";
import type { BookingReportRow, RatingReportRow, WorkloadReportRow } from "@/domain/reports";
import type { IndiaDate } from "@/domain/india-time";
import type { LocalizedText } from "@/i18n/localized-text";
import { authorize } from "@/server/auth/access";
import { getDatabase } from "@/server/db";
import { bookingItems, bookings, reviews, services, users } from "@/server/db/schema";

export type ReportPeriodInput = { from: IndiaDate; to: IndiaDate };
export type ReportRead<Row> = { ok: true; rows: Row[] } | { ok: false; problem: "invalid-period" };

/** A service with how many bookings include it; its name is the service's current one. */
export type TopServiceDbRow = { serviceId: string; name: LocalizedText; bookings: number };

/** The window to query, or null for a period the reports can't use. */
function windowOf(period: ReportPeriodInput): { start: Date; end: Date } | null {
  const range = checkReportRange(period?.from, period?.to);
  return range.ok ? periodWindow(range) : null;
}

/** Every booking whose slot falls in the period: when it starts, and its status. */
export async function readBookingsReport(period: ReportPeriodInput): Promise<ReportRead<BookingReportRow>> {
  await authorize("reports.view");
  const window = windowOf(period);
  if (window === null) return { ok: false, problem: "invalid-period" };

  const db = await getDatabase();
  const rows = await db
    .select({ startsAt: bookings.startsAt, status: bookings.status })
    .from(bookings)
    .where(and(gte(bookings.startsAt, window.start), lt(bookings.startsAt, window.end)));
  return { ok: true, rows };
}

/**
 * Each service or package in the period's active bookings, with how many
 * bookings include it. The name is the service's current one (a booking line
 * keeps its own copy, which may be older): the foreign key keeps every
 * service row, listed or not.
 */
export async function readTopServicesReport(period: ReportPeriodInput): Promise<ReportRead<TopServiceDbRow>> {
  await authorize("reports.view");
  const window = windowOf(period);
  if (window === null) return { ok: false, problem: "invalid-period" };

  const db = await getDatabase();
  const rows = await db
    .select({ serviceId: services.id, name: services.name, bookings: countDistinct(bookings.id) })
    .from(bookingItems)
    .innerJoin(bookings, eq(bookingItems.bookingId, bookings.id))
    .innerJoin(services, eq(bookingItems.serviceId, services.id))
    .where(
      and(
        gte(bookings.startsAt, window.start),
        lt(bookings.startsAt, window.end),
        inArray(bookings.status, [...ACTIVE_STATUSES]),
      ),
    )
    .groupBy(services.id, services.name);
  return { ok: true, rows };
}

/** How many published reviews written in the period gave each rating. Hidden reviews are left out. */
export async function readRatingReport(period: ReportPeriodInput): Promise<ReportRead<RatingReportRow>> {
  await authorize("reports.view");
  const window = windowOf(period);
  if (window === null) return { ok: false, problem: "invalid-period" };

  const db = await getDatabase();
  const rows = await db
    .select({ rating: reviews.rating, count: sql<number>`count(*)::int` })
    .from(reviews)
    .where(and(isNull(reviews.hiddenAt), gte(reviews.createdAt, window.start), lt(reviews.createdAt, window.end)))
    .groupBy(reviews.rating);
  return { ok: true, rows };
}

// The assigned person is another users row: joined under its own name.
const mechanics = alias(users, "mechanics");

/**
 * The period's active bookings per assigned person (null: nobody), with how
 * many of their jobs are completed. Grouped by the stored assignee, whatever
 * their role is today: someone who stopped being a mechanic still did those
 * jobs (plan KTD4). Names only, never a phone number.
 */
export async function readWorkloadReport(period: ReportPeriodInput): Promise<ReportRead<WorkloadReportRow>> {
  await authorize("reports.view");
  const window = windowOf(period);
  if (window === null) return { ok: false, problem: "invalid-period" };

  const db = await getDatabase();
  const rows = await db
    .select({
      mechanicId: mechanics.id,
      name: mechanics.name,
      bookings: sql<number>`count(*)::int`,
      completed: sql<number>`(count(*) filter (where ${bookings.jobStatus} = 'completed'))::int`,
    })
    .from(bookings)
    .leftJoin(mechanics, eq(bookings.assignedMechanicId, mechanics.id))
    .where(
      and(
        gte(bookings.startsAt, window.start),
        lt(bookings.startsAt, window.end),
        inArray(bookings.status, [...ACTIVE_STATUSES]),
      ),
    )
    .groupBy(mechanics.id, mechanics.name);
  return { ok: true, rows };
}
