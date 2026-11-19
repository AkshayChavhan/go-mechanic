import { io } from "next/cache";

import { BookingsBoard } from "@/components/admin/bookings-board";
import { pickBoardDate } from "@/domain/board-dates";
import { indiaDateOf } from "@/domain/india-time";
import type { Locale } from "@/i18n/config";
import { systemClock } from "@/lib/clock";
import { requirePermission } from "@/server/auth/access";
import { listBookingsOn } from "@/server/dal/staff-bookings";

type BookingsGateProps = {
  locale: Locale;
  /** The page's searchParams, still a promise: only this part waits for the request. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The part of /admin/bookings that waits for the request (task 26). The
 * page puts it inside <Suspense>. In this order:
 *
 * 1. The access check (bookings.manage: manager, owner), before anything
 *    else, so a customer gets the 404 page and the board's words never
 *    reach them.
 * 2. `await io()`, then today's India date: the clock must be read fresh
 *    for each request, never frozen into the page built ahead of time
 *    (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/io.md).
 * 3. The day asked for in `?date=`, checked by pickBoardDate, then its bookings.
 */
export async function BookingsGate({ locale, searchParams }: BookingsGateProps) {
  await requirePermission(locale, "bookings.manage");
  await io();
  const today = indiaDateOf(systemClock.now());
  const { date, note } = pickBoardDate((await searchParams).date, today);

  const result = await listBookingsOn(date);
  // pickBoardDate only returns dates the read accepts, so this means a bug.
  if (!result.ok) throw new Error(`listBookingsOn refused a date pickBoardDate chose: ${result.problem}`);

  return <BookingsBoard locale={locale} date={date} today={today} note={note} bookings={result.bookings} />;
}
