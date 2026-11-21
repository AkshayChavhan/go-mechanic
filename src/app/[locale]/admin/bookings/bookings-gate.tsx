import { randomUUID } from "node:crypto";

import { io } from "next/cache";

import { BookingsBoard } from "@/components/admin/bookings-board";
import { parseBoardNotice, parseShowCancelled, pickBoardDate } from "@/domain/board-dates";
import { indiaDateOf } from "@/domain/india-time";
import { can } from "@/domain/permissions";
import type { Locale } from "@/i18n/config";
import { systemClock } from "@/lib/clock";
import { requirePermission } from "@/server/auth/access";
import { listBookingsOn } from "@/server/dal/staff-bookings";
import { listMechanics } from "@/server/dal/staff-users";

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
 * 3. The query, each part checked by a pure reader in board-dates.ts: the
 *    day (`?date=`), the cancelled filter (`?cancelled=show`) and the notice
 *    an action redirected with (`?notice=` and `?code=`). The board shows
 *    the notice only for a code among that day's bookings.
 * 4. The day's bookings and the mechanics (task 27).
 *
 * Each form on the board gets a fresh random request token (`newToken`), made
 * here after io(): a token must differ on every page load, so a double tap
 * saves once but the next visit's tap is a new change.
 */
export async function BookingsGate({ locale, searchParams }: BookingsGateProps) {
  const user = await requirePermission(locale, "bookings.manage");
  await io();
  const now = systemClock.now();
  const today = indiaDateOf(now);
  const query = await searchParams;
  const { date, note } = pickBoardDate(query.date, today);

  const result = await listBookingsOn(date);
  if (!result.ok) throw new Error(`listBookingsOn refused a date pickBoardDate chose: ${result.problem}`);
  const mechanics = await listMechanics();

  return (
    <BookingsBoard
      locale={locale}
      date={date}
      today={today}
      note={note}
      bookings={result.bookings}
      showCancelled={parseShowCancelled(query.cancelled)}
      notice={parseBoardNotice(query.notice, query.code)}
      mechanics={mechanics}
      canContact={can(user.role, "customers.contact")}
      now={now}
      newToken={() => randomUUID()}
    />
  );
}
