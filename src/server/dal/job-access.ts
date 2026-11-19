// Which bookings a staff member may work on as jobs (task 31), shared by the
// job functions (jobs.ts) and the job photo functions (photos.ts).
//
// The rule, from the permission table, never from a role:
// - "bookings.manage" (manager, owner): any booking, completed ones included
//   (the job functions then answer "job-closed");
// - otherwise ("jobs.update" alone: a mechanic): only bookings assigned to
//   them that aren't completed. Reassigning or completing a job ends a
//   mechanic's access at once, because every call checks again.
//
// Callers check "jobs.update" first (authorize), then filter their query
// with jobRowFilter, so the rule is in the query and not after it: a booking
// that isn't yours and one that isn't there give the same "not found".

import "server-only";

import { and, eq, type SQL, sql } from "drizzle-orm";

import { can } from "@/domain/permissions";
import type { CurrentUser } from "@/server/auth/session";
import { bookings } from "@/server/db/schema";

/** Whether `user` may work on any job, not only the ones assigned to them. */
export function mayWorkOnAnyJob(user: CurrentUser): boolean {
  return can(user.role, "bookings.manage");
}

/** A job that isn't completed: not started (null) counts too. */
export const notCompleted: SQL = sql`${bookings.jobStatus} is distinct from 'completed'`;

/** The bookings `user` may work on as jobs (see above), as a WHERE condition. */
export function jobsOf(user: CurrentUser): SQL | undefined {
  if (mayWorkOnAnyJob(user)) return undefined;
  return and(eq(bookings.assignedMechanicId, user.id), notCompleted);
}

/** One booking, if `user` may work on it, as a WHERE condition. */
export function jobRowFilter(user: CurrentUser, bookingId: string): SQL {
  return and(eq(bookings.id, bookingId), jobsOf(user))!;
}
