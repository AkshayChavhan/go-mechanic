// The work on booked vehicles (task 31): staff update a job (a move to a new
// step, a note for the customer, photos, or a mix), and staff and the
// customer read it. The pages come later: task 26 (the mechanic's jobs and
// the update form) and task 25 (the customer's booking page).
//
// The rules of this folder are in garage.ts:
// - staff functions call authorize("jobs.update") on their first line and
//   filter their query with job-access.ts: a mechanic works only on the jobs
//   assigned to them, until they're completed; "bookings.manage" (manager,
//   owner) works on any;
// - the customer's read calls authorizeUser() and filters by their user id;
// - a booking you may not see and a missing one give the same "not-found";
// - staff reads select a customer's phone number only for
//   "customers.contact", which mechanics don't hold.

import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { isActiveStatus } from "@/domain/bookings";
import { isUuid } from "@/domain/ids";
import { bookingDayReached, canMoveJob, checkJobUpdateInput, type JobStatus, type JobUpdateInput, type JobUpdateInputProblem } from "@/domain/jobs";
import { can } from "@/domain/permissions";
import type { Fuel, VehicleKind } from "@/domain/vehicles";
import type { LocalizedText } from "@/i18n/localized-text";
import { type Clock, systemClock } from "@/lib/clock";
import { authorize, authorizeUser } from "@/server/auth/access";
import { type Database, getDatabase } from "@/server/db";
import { bookingEvents, bookingItems, bookings, photoSets, photos, users, vehicleMakes, vehicleModels } from "@/server/db/schema";
import { photoStorage, type PhotoStorage } from "@/server/providers/photos";

import { jobRowFilter, jobsOf, notCompleted } from "./job-access";
import { viewLinksFor } from "./photos";
import type { SlotTransaction } from "./slots";

/** What can be wrong with an update: the input's problems, or what only the locked booking shows. */
export type JobUpdateProblem =
  | JobUpdateInputProblem
  | { field: "status"; problem: "move-not-allowed" }
  /** "vehicle-received" before the booking's India day (bookingDayReached; owner, 2026-11-22). */
  | { field: "status"; problem: "before-booking-day" }
  | { field: "photos"; problem: "photos-not-found" };

/** One saved update, as updateJob answers with it. */
export type SavedJobUpdate = { id: string; movedTo: JobStatus | null; note: string | null; hadPhotos: boolean; createdAt: Date };

export type UpdateJobResult =
  | { status: "updated"; update: SavedJobUpdate }
  /** The same form sent again (a double tap, a retry): the first update stands. */
  | { status: "duplicate"; update: SavedJobUpdate }
  | { status: "problems"; problems: JobUpdateProblem[] }
  /** Not a booking the caller may work on (or no such booking). */
  | { status: "not-found" }
  /** Completed: a job takes no more updates. Only staff who may see completed jobs get this. */
  | { status: "job-closed" }
  /**
   * The booking is cancelled or a no-show (task 27): no updates, for any
   * role. Only managers and the owner get this; a mechanic's filter already
   * answers "not-found".
   */
  | { status: "booking-closed" };

const savedUpdateColumns = {
  id: bookingEvents.id,
  movedTo: bookingEvents.jobStatus,
  note: bookingEvents.note,
  hadPhotos: bookingEvents.hadPhotos,
  createdAt: bookingEvents.createdAt,
};

/**
 * Adds one update to a job, for staff with "jobs.update" on a booking they
 * may work on. Expected answers come back as a result; only an unexpected
 * database error throws (and rolls back).
 *
 * The order inside the transaction is fixed (the idempotent-save lesson in
 * document/solutions/conventions/): the booking row is locked first, filtered
 * by who may work on it; then a second send of the same form answers
 * "duplicate" before any refusal that the first send itself changed (the
 * step has moved, the photo set is used); then the refusals; then the writes.
 * The token is looked up on this booking only, so a token first used on
 * another booking never answers with that booking's update.
 *
 * The lock's filter is itself a refusal the first send can change: a
 * mechanic's update to "completed" ends their access to the job. So when no
 * row comes back, the caller's own earlier update with this token still
 * answers "duplicate" (task 31 review): it's what they wrote, so it shows
 * them nothing new. The same holds after the job was reassigned.
 */
export async function updateJob(input: JobUpdateInput, clock: Clock = systemClock): Promise<UpdateJobResult> {
  const user = await authorize("jobs.update");
  const checked = checkJobUpdateInput(input);
  if (!checked.ok) return { status: "problems", problems: checked.problems };
  const update = checked.update;

  const db = await getDatabase();
  return db.transaction(async (tx): Promise<UpdateJobResult> => {
    // Locked, so two updates of one job (or an update and task 27's cancel)
    // can't both read the same step and both move it.
    const [job] = await tx
      .select({ id: bookings.id, jobStatus: bookings.jobStatus, status: bookings.status, startsAt: bookings.startsAt })
      .from(bookings)
      .where(jobRowFilter(user, update.bookingId))
      .for("update");

    // Looked up after the lock, so a second send waiting on it sees the first one's update.
    const [earlier] = await tx
      .select(savedUpdateColumns)
      .from(bookingEvents)
      .where(
        and(
          eq(bookingEvents.bookingId, update.bookingId),
          eq(bookingEvents.actorUserId, user.id),
          eq(bookingEvents.requestToken, update.requestToken),
        ),
      );
    if (earlier) return { status: "duplicate", update: earlier };
    if (!job) return { status: "not-found" };

    // After the token lookup: a retry of an update sent before a cancel or a
    // no-show still answers "duplicate".
    if (!isActiveStatus(job.status)) return { status: "booking-closed" };
    if (job.jobStatus === "completed") return { status: "job-closed" };
    const now = clock.now();
    const problems: JobUpdateProblem[] = [];
    if (update.toStatus !== null && !canMoveJob(job.jobStatus, update.toStatus)) {
      problems.push({ field: "status", problem: "move-not-allowed" });
    } else if (update.toStatus === "vehicle-received" && !bookingDayReached(job.startsAt, now)) {
      // A started job can't be cancelled or marked a no-show, so a mis-tap on
      // a future booking would have no way back.
      problems.push({ field: "status", problem: "before-booking-day" });
    }
    if (update.photoSetId !== null && !(await jobSetIsFree(tx, job.id, update.photoSetId))) {
      problems.push({ field: "photos", problem: "photos-not-found" });
    }
    if (problems.length > 0) return { status: "problems", problems };

    const [saved] = await tx
      .insert(bookingEvents)
      .values({
        bookingId: job.id,
        kind: "job-update",
        actorUserId: user.id,
        jobStatus: update.toStatus,
        note: update.note,
        photoSetId: update.photoSetId,
        hadPhotos: update.photoSetId !== null,
        requestToken: update.requestToken,
        createdAt: now,
      })
      .returning(savedUpdateColumns);
    if (update.toStatus !== null) {
      await tx.update(bookings).set({ jobStatus: update.toStatus }).where(eq(bookings.id, job.id));
    }
    if (update.photoSetId !== null) {
      // Closing the set starts its one-year clock (PHOTO_RULES.keepClosedDays)
      // and stops it taking more photos.
      await tx.update(photoSets).set({ closedAt: now }).where(eq(photoSets.id, update.photoSetId));
    }
    // Task 35: queue the customer's notification here, in this transaction
    // (the notification outbox), so it's sent if and only if the update is saved.
    return { status: "updated", update: saved! };
  });
}

/**
 * Whether `setId` is an open set of job `bookingId` that no update uses yet
 * and that holds at least one stored photo. A set whose uploads all failed
 * would otherwise be saved as "had photos" with none to show, and the
 * customer's timeline would say they're no longer kept (task 31 review).
 * Locks the set.
 */
async function jobSetIsFree(tx: SlotTransaction, bookingId: string, setId: string): Promise<boolean> {
  const [set] = await tx
    .select({ closedAt: photoSets.closedAt })
    .from(photoSets)
    .where(and(eq(photoSets.id, setId), eq(photoSets.bookingId, bookingId)))
    .for("update");
  if (!set || set.closedAt !== null) return false;
  const [used] = await tx.select({ id: bookingEvents.id }).from(bookingEvents).where(eq(bookingEvents.photoSetId, setId));
  if (used) return false;
  const [stored] = await tx
    .select({ id: photos.id })
    .from(photos)
    .where(and(eq(photos.setId, setId), eq(photos.status, "stored")))
    .limit(1);
  return stored !== undefined;
}

// --- Reads ---------------------------------------------------------------------

/** The vehicle as the booking keeps it: a copy. */
export type JobVehicle = {
  kind: VehicleKind;
  makeName: LocalizedText;
  modelName: LocalizedText;
  fuel: Fuel;
  /** The compact form: show it with formatRegistration. */
  registrationNumber: string;
};

/** One job update on a timeline. Who made it isn't included: customers see "the garage". */
export type JobUpdateEntry = {
  id: string;
  createdAt: Date;
  /** The step this update moved the job to; null when it didn't move it. */
  movedTo: JobStatus | null;
  /** The job's step once this update was applied; null while not started (Booked). */
  stepAfter: JobStatus | null;
  note: string | null;
  /** True when the update had photos, even after the cleanup deleted them. */
  hadPhotos: boolean;
  /** View links (5 minutes) for the photos still kept, oldest first. */
  photos: { photoId: string; url: string }[];
};

/** A job as its customer follows it (task 25's page shows it with JobTimeline). */
export type MyJobTimeline = {
  bookingId: string;
  code: string;
  /** The slot: when the vehicle reaches the garage. */
  startsAt: Date;
  vehicle: JobVehicle;
  /** Null while not started (Booked). */
  jobStatus: JobStatus | null;
  /** Oldest first. The "booked" entry isn't one: Booked is the first step. */
  updates: JobUpdateEntry[];
};

/** A job as staff see it (task 26's job page). */
export type StaffJob = MyJobTimeline & {
  customerName: string;
  /** Only for staff with "customers.contact"; null for anyone else (never selected for them). */
  phoneNumber: string | null;
  /** The booked services' names, in the order the customer chose them. */
  lines: { name: LocalizedText }[];
};

/** One row of a mechanic's jobs list. */
export type AssignedJobRow = Omit<MyJobTimeline, "updates">;

export type ReadDependencies = { storage?: PhotoStorage };

const jobColumns = {
  bookingId: bookings.id,
  code: bookings.code,
  startsAt: bookings.startsAt,
  jobStatus: bookings.jobStatus,
  kind: bookings.vehicleKind,
  makeName: vehicleMakes.name,
  modelName: vehicleModels.name,
  fuel: bookings.fuel,
  registrationNumber: bookings.registrationNumber,
};

function toAssignedJob(row: Omit<AssignedJobRow, "vehicle"> & JobVehicle): AssignedJobRow {
  const { kind, makeName, modelName, fuel, registrationNumber, ...job } = row;
  return { ...job, vehicle: { kind, makeName, modelName, fuel, registrationNumber } };
}

/**
 * A booking's job updates, oldest first, each with the step it left the job
 * at and its photo links. The step is carried forward from the updates that
 * moved it: every move of job_status writes one (updateJob here, the
 * estimate's move in task 33), so the last one matches the booking's step.
 */
async function readUpdates(db: Database, bookingId: string, storage: PhotoStorage): Promise<JobUpdateEntry[]> {
  const rows = await db
    .select({ ...savedUpdateColumns, photoSetId: bookingEvents.photoSetId })
    .from(bookingEvents)
    .where(and(eq(bookingEvents.bookingId, bookingId), eq(bookingEvents.kind, "job-update")))
    .orderBy(asc(bookingEvents.createdAt), asc(bookingEvents.id));
  const links = await viewLinksFor(
    rows.flatMap((row) => (row.photoSetId ? [row.photoSetId] : [])),
    storage,
  );
  let step: JobStatus | null = null;
  return rows.map(({ photoSetId, ...row }) => {
    step = row.movedTo ?? step;
    return { ...row, stepAfter: step, photos: photoSetId ? (links.get(photoSetId) ?? []) : [] };
  });
}

/**
 * The timeline of one of the logged-in customer's bookings. Another
 * customer's booking, a missing one and a malformed id are all null.
 */
export async function readMyJobTimeline(
  bookingId: string,
  { storage = photoStorage() }: ReadDependencies = {},
): Promise<MyJobTimeline | null> {
  const user = await authorizeUser();
  if (!isUuid(bookingId)) return null;
  const db = await getDatabase();
  const [row] = await db
    .select(jobColumns)
    .from(bookings)
    .innerJoin(vehicleModels, eq(bookings.modelId, vehicleModels.id))
    .innerJoin(vehicleMakes, eq(vehicleModels.makeId, vehicleMakes.id))
    .where(and(eq(bookings.id, bookingId), eq(bookings.userId, user.id)));
  if (!row) return null;
  return { ...toAssignedJob(row), updates: await readUpdates(db, row.bookingId, storage) };
}

/**
 * One job, for staff with "jobs.update" who may work on it (job-access.ts):
 * the assigned mechanic until it's completed (and while the booking is
 * active), or a manager or the owner.
 * Anything else, and a malformed id, is null.
 */
export async function readJob(bookingId: string, { storage = photoStorage() }: ReadDependencies = {}): Promise<StaffJob | null> {
  const user = await authorize("jobs.update");
  if (!isUuid(bookingId)) return null;
  const showPhone = can(user.role, "customers.contact");
  const db = await getDatabase();
  // The phone number is only selected for staff who may contact customers.
  const [row] = await db
    .select({ ...jobColumns, customerName: users.name, phoneNumber: showPhone ? users.phoneNumber : sql<null>`null` })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .innerJoin(vehicleModels, eq(bookings.modelId, vehicleModels.id))
    .innerJoin(vehicleMakes, eq(vehicleModels.makeId, vehicleMakes.id))
    .where(jobRowFilter(user, bookingId));
  if (!row) return null;
  const { customerName, phoneNumber, ...job } = row;
  const lines = await db
    .select({ name: bookingItems.name })
    .from(bookingItems)
    .where(eq(bookingItems.bookingId, row.bookingId))
    .orderBy(asc(bookingItems.position));
  return {
    ...toAssignedJob(job),
    customerName,
    phoneNumber: phoneNumber ?? null,
    lines,
    updates: await readUpdates(db, row.bookingId, storage),
  };
}

/**
 * The jobs assigned to the logged-in staff member that aren't completed,
 * soonest slot first: a mechanic's list for the day (task 26). Managers and
 * the owner see their own assigned jobs here too; task 26's board lists
 * everyone's.
 */
export async function listMyAssignedJobs(): Promise<AssignedJobRow[]> {
  const user = await authorize("jobs.update");
  const db = await getDatabase();
  const rows = await db
    .select(jobColumns)
    .from(bookings)
    .innerJoin(vehicleModels, eq(bookings.modelId, vehicleModels.id))
    .innerJoin(vehicleMakes, eq(vehicleModels.makeId, vehicleMakes.id))
    .where(
      and(eq(bookings.assignedMechanicId, user.id), notCompleted, jobsOf(user)),
    )
    .orderBy(asc(bookings.startsAt), asc(bookings.id));
  return rows.map(toAssignedJob);
}
