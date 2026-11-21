// Staff changes to a booking (task 27): Confirm, Cancel, No-show, "Arrived
// after all" (a status change) and Assign mechanic. The board's Server
// Actions (task 27, U5) call these; the customer's save stays alone in
// bookings.ts.
//
// The rules of this folder are in garage.ts, and every save here keeps one
// order (the plan's KTD4, and the idempotent-save lesson in
// document/solutions/conventions/):
// 1. authorize("bookings.manage") on the first line, then the input check
//    (pure: the same answer on every retry), then getDatabase();
// 2. one transaction that locks the booking row (`for update`) and reads its
//    status, slot and job step only from that row, so two changes at once run
//    one after the other and the second sees the first's result;
// 3. the request token, looked up on this booking and this staff member:
//    the same form again answers "duplicate" (with the booking as it now is)
//    before any refusal the first send itself changed; a token whose saved
//    change was a different choice (a form resent from an old page) answers
//    "stale" and writes nothing;
// 4. the refusals; 5. releaseSlot (a cancel); 6. the booking and its event.
//
// Nothing here may call getDatabase(), readGarage() or readAvailableSlots()
// inside the transaction (PGlite has one connection: CLAUDE.md "Booking
// slots"). The chosen mechanic's user row is read through the transaction.

import "server-only";

import { and, eq } from "drizzle-orm";

import { type BookingStatus, canChangeStatus, checkCancelInput, isActiveStatus, type StatusChangeProblem } from "@/domain/bookings";
import { isUuid } from "@/domain/ids";
import { type Clock, systemClock } from "@/lib/clock";
import { authorize } from "@/server/auth/access";
import { getDatabase } from "@/server/db";
import { bookingEvents, bookings, users } from "@/server/db/schema";

import { releaseSlot, type SlotTransaction } from "./slots";
import { isMechanic } from "./staff-users";

/** The statuses staff set from the board. "booked" is only ever the customer's. */
export const STAFF_STATUS_TARGETS = ["confirmed", "cancelled", "no-show"] as const satisfies readonly BookingStatus[];
export type StaffStatusTarget = (typeof STAFF_STATUS_TARGETS)[number];

function isStaffStatusTarget(value: string): value is StaffStatusTarget {
  return (STAFF_STATUS_TARGETS as readonly string[]).includes(value);
}

export type ChangeBookingStatusInput = {
  bookingId: string;
  /** One of STAFF_STATUS_TARGETS, as the form posts it. */
  to: string;
  /** Required for a cancel (checkCancelInput); ignored for any other status. */
  reason?: string;
  /** A random uuid per render of the form: a second send changes nothing twice. */
  requestToken: string;
};

export type StaffChangeProblem =
  | { field: "status"; problem: "bad-status" }
  | { field: "reason"; problem: "reason-too-short" | "reason-too-long" }
  | { field: "token"; problem: "bad-token" };

export type ChangeBookingStatusResult =
  | { status: "changed"; code: string; bookingStatus: BookingStatus }
  /** The same form sent again: the first change stands; the booking's status as it now is. */
  | { status: "duplicate"; code: string; bookingStatus: BookingStatus }
  /** The token was used for a different choice (a form from an old page): nothing written. */
  | { status: "stale"; code: string }
  | { status: StatusChangeProblem; code: string }
  | { status: "not-found" }
  | { status: "problems"; problems: StaffChangeProblem[] };

/**
 * Changes a booking's status, for staff with "bookings.manage" (manager,
 * owner). A cancel frees the booking's place in its slot; every other change
 * leaves it taken (a no-show never gave it back). Expected answers come back
 * as a result; only an unexpected database error throws (and rolls back).
 */
export async function changeBookingStatus(
  input: ChangeBookingStatusInput,
  clock: Clock = systemClock,
): Promise<ChangeBookingStatusResult> {
  const user = await authorize("bookings.manage");

  const problems: StaffChangeProblem[] = [];
  const to = isStaffStatusTarget(input.to) ? input.to : null;
  if (to === null) problems.push({ field: "status", problem: "bad-status" });
  let reason: string | null = null;
  if (to === "cancelled") {
    const checked = checkCancelInput(input.reason ?? "");
    if (checked.ok) reason = checked.reason;
    else problems.push({ field: "reason", problem: checked.problem });
  }
  if (!isUuid(input.requestToken)) problems.push({ field: "token", problem: "bad-token" });
  if (problems.length > 0 || to === null) return { status: "problems", problems };
  // Postgres would throw on a malformed uuid (22P02): no such booking, without a query.
  if (!isUuid(input.bookingId)) return { status: "not-found" };
  const requestToken = input.requestToken.toLowerCase();

  const db = await getDatabase();
  return db.transaction(async (tx): Promise<ChangeBookingStatusResult> => {
    const booking = await lockBooking(tx, input.bookingId);
    // After the lock, so a second send waiting on it sees the first one's event.
    const earlier = await earlierChange(tx, input.bookingId, user.id, requestToken);
    // Events go with their booking (cascade): no row, no earlier change either.
    if (!booking) return { status: "not-found" };
    if (earlier) {
      if (earlier.kind === "status-change" && earlier.newStatus === to) {
        return { status: "duplicate", code: booking.code, bookingStatus: booking.status };
      }
      return { status: "stale", code: booking.code };
    }

    const now = clock.now();
    const allowed = canChangeStatus(booking.status, to, {
      jobStarted: booking.jobStatus !== null,
      slotStarted: booking.startsAt.getTime() <= now.getTime(),
    });
    if (!allowed.ok) return { status: allowed.problem, code: booking.code };

    // Cancelling is the only change that gives the place back. Released
    // before the writes (CLAUDE.md "Booking slots"); the lock above makes sure
    // it's released once.
    if (to === "cancelled") await releaseSlot(tx, booking.startsAt);

    await tx.update(bookings).set({ status: to }).where(eq(bookings.id, booking.id));
    await tx.insert(bookingEvents).values({
      bookingId: booking.id,
      kind: "status-change",
      actorUserId: user.id,
      newStatus: to,
      reason,
      requestToken,
      createdAt: now,
    });
    // Task 35: queue the customer's message here, in this transaction (the
    // notification outbox), so it's sent if and only if the change is saved.
    return { status: "changed", code: booking.code, bookingStatus: to };
  });
}

export type AssignMechanicInput = {
  bookingId: string;
  /** The mechanic's user id, or null to leave the job with nobody. */
  mechanicId: string | null;
  /** A random uuid per render of the form. */
  requestToken: string;
};

export type AssignMechanicResult =
  | { status: "changed"; code: string; mechanicId: string | null }
  /** The same form sent again: the first change stands; the mechanic as it now is. */
  | { status: "duplicate"; code: string; mechanicId: string | null }
  | { status: "stale"; code: string }
  /** The booking isn't booked or confirmed. */
  | { status: "not-allowed"; code: string }
  /** Completed: a job takes no more changes. */
  | { status: "job-closed"; code: string }
  /** The chosen user isn't a mechanic (or doesn't exist). */
  | { status: "not-a-mechanic"; code: string }
  /** That mechanic (or nobody) already has the job: nothing written. */
  | { status: "unchanged"; code: string }
  | { status: "not-found" }
  | { status: "problems"; problems: StaffChangeProblem[] };

/**
 * Gives a booking's job to a mechanic, to another one, or to nobody, for
 * staff with "bookings.manage". Allowed while the booking is booked or
 * confirmed and its job isn't completed, a started job included (handing a
 * job over mid-way). The mechanic's own access follows at once: job-access.ts
 * reads assigned_mechanic_id on every call.
 */
export async function assignMechanic(input: AssignMechanicInput): Promise<AssignMechanicResult> {
  const user = await authorize("bookings.manage");
  if (!isUuid(input.requestToken)) return { status: "problems", problems: [{ field: "token", problem: "bad-token" }] };
  if (!isUuid(input.bookingId)) return { status: "not-found" };
  const requestToken = input.requestToken.toLowerCase();
  const mechanicId = input.mechanicId;

  const db = await getDatabase();
  return db.transaction(async (tx): Promise<AssignMechanicResult> => {
    const booking = await lockBooking(tx, input.bookingId);
    const earlier = await earlierChange(tx, input.bookingId, user.id, requestToken);
    if (!booking) return { status: "not-found" };
    if (earlier) {
      if (earlier.kind === "assigned" && earlier.mechanicId === mechanicId) {
        return { status: "duplicate", code: booking.code, mechanicId: booking.assignedMechanicId };
      }
      return { status: "stale", code: booking.code };
    }

    if (!isActiveStatus(booking.status)) return { status: "not-allowed", code: booking.code };
    if (booking.jobStatus === "completed") return { status: "job-closed", code: booking.code };
    if (mechanicId !== null) {
      // Checked again here: the form's list is no guarantee (a role may have
      // changed since, or the post was edited).
      const [chosen] = await tx
        .select({ role: users.role, phoneNumber: users.phoneNumber })
        .from(users)
        .where(eq(users.id, mechanicId));
      if (!chosen || !isMechanic(chosen.role, chosen.phoneNumber)) return { status: "not-a-mechanic", code: booking.code };
    }
    if (booking.assignedMechanicId === mechanicId) return { status: "unchanged", code: booking.code };

    await tx.update(bookings).set({ assignedMechanicId: mechanicId }).where(eq(bookings.id, booking.id));
    await tx.insert(bookingEvents).values({
      bookingId: booking.id,
      kind: "assigned",
      actorUserId: user.id,
      mechanicId,
      requestToken,
    });
    // Task 35: queue the customer's message here, in this transaction, if the
    // owner wants customers told who works on their vehicle.
    return { status: "changed", code: booking.code, mechanicId };
  });
}

/** Locks one booking row and reads what the saves decide on, only from it. */
async function lockBooking(tx: SlotTransaction, bookingId: string) {
  const [row] = await tx
    .select({
      id: bookings.id,
      code: bookings.code,
      status: bookings.status,
      startsAt: bookings.startsAt,
      jobStatus: bookings.jobStatus,
      assignedMechanicId: bookings.assignedMechanicId,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .for("update");
  return row;
}

/** This staff member's earlier change of this booking with this token, if any. */
async function earlierChange(tx: SlotTransaction, bookingId: string, actorUserId: string, requestToken: string) {
  const [row] = await tx
    .select({ kind: bookingEvents.kind, newStatus: bookingEvents.newStatus, mechanicId: bookingEvents.mechanicId })
    .from(bookingEvents)
    .where(
      and(
        eq(bookingEvents.bookingId, bookingId),
        eq(bookingEvents.actorUserId, actorUserId),
        eq(bookingEvents.requestToken, requestToken),
      ),
    );
  return row;
}
