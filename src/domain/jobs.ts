// The work on a booked vehicle (task 31): the steps it goes through, which
// moves between them are allowed, and what a job update may contain.
//
// Pure logic: no Next.js, React or database imports. The data-access save
// (src/server/dal/jobs.ts) checks what staff send with checkJobUpdateInput(),
// then, with the booking row locked, checks the move with canMoveJob().
// The estimate send (task 33) checks its move with canSendEstimateFrom().
//
// A job's step is its own column (bookings.job_status), apart from the
// booking's status (booked, and later confirmed or cancelled: tasks 25, 27).
// It's null until the vehicle reaches the garage: the timeline shows that as
// "Booked".

import { isUuid } from "./ids";
import { indiaDateOf } from "./india-time";
import { normalizeTypedText, typedLength } from "./typed-text";

/**
 * Every step after "Booked", in order. The order is stored in the database
 * enum, so a new step goes in its place here and in a new migration.
 * Only sending an estimate (task 33) reaches "awaiting-approval".
 */
export const JOB_STATUSES = [
  "vehicle-received",
  "inspection",
  "awaiting-approval",
  "in-service",
  "ready",
  "completed",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** The steps a customer sees, "Booked" (not started: job_status null) first. */
export const JOB_STEPS = ["booked", ...JOB_STATUSES] as const;
export type JobStep = (typeof JOB_STEPS)[number];

export const JOB_UPDATE_RULES = {
  /** Characters, after trimming. The note is shown to the customer. */
  noteMaxLength: 1000,
} as const;

export function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}

/** The step shown for a job_status: null (not started) is "booked". */
export function jobStep(status: JobStatus | null): JobStep {
  return status ?? "booked";
}

/**
 * How a move happens. "by-hand": staff choose the next step (a job update,
 * the board's Job step control). "by-estimate": only sending an estimate
 * (task 33) makes the move, so no hand-made update can skip the customer's
 * approval.
 */
export type JobMoveHow = "by-hand" | "by-estimate";

/**
 * The allowed moves, from a step (null: not started) to the next.
 * Owner's defaults (2026-11-19, see the plan): one step at a time, straight
 * from inspection to ready when no work is needed, and back from ready to
 * in service when a problem turns up. Sending an estimate moves the job to
 * "awaiting-approval" from inspection or in service; task 34 adds the moves
 * out of it. Each is a row here.
 */
const JOB_MOVES: readonly { from: JobStatus | null; to: JobStatus; how: JobMoveHow }[] = [
  { from: null, to: "vehicle-received", how: "by-hand" },
  { from: "vehicle-received", to: "inspection", how: "by-hand" },
  { from: "inspection", to: "in-service", how: "by-hand" },
  { from: "inspection", to: "ready", how: "by-hand" },
  { from: "in-service", to: "ready", how: "by-hand" },
  { from: "ready", to: "in-service", how: "by-hand" },
  { from: "ready", to: "completed", how: "by-hand" },
  { from: "inspection", to: "awaiting-approval", how: "by-estimate" },
  { from: "in-service", to: "awaiting-approval", how: "by-estimate" },
];

/**
 * Whether staff may move a job by hand from `from` (null: not started) to
 * `to`. Never true for "awaiting-approval": only sending an estimate gets there.
 */
export function canMoveJob(from: JobStatus | null, to: JobStatus): boolean {
  return JOB_MOVES.some((move) => move.how === "by-hand" && move.from === from && move.to === to);
}

/**
 * Whether a booking's India day has come (owner, 2026-11-22): a job may move
 * to "vehicle-received" only on or after the day of its slot, in India time.
 * One mis-tap on a future booking would otherwise start the job, and a
 * started job can no longer be cancelled or marked a no-show. updateJob
 * refuses the move earlier ("before-booking-day"); the board hides its button.
 * The dates are "YYYY-MM-DD", so comparing them as text compares them as days.
 */
export function bookingDayReached(startsAt: Date, now: Date): boolean {
  return indiaDateOf(startsAt) <= indiaDateOf(now);
}

/**
 * Whether the board's Job step control may offer a move to `to` at all,
 * whatever the job's step: never "completed" (the plan's KD5: Completed
 * waits for the staff reviews page, since nothing else could take a review
 * down), and "vehicle-received" only once the booking's day has come
 * (bookingDayReached). The board's action checks this before updateJob,
 * which checks the move against the job's step with the booking locked.
 */
export function isBoardJobTarget(to: JobStatus, facts: { slotDayReached: boolean }): boolean {
  return to !== "completed" && (to !== "vehicle-received" || facts.slotDayReached);
}

/** Whether the board's Job step control offers a move from `from` to `to`: a by-hand move it may offer. */
export function canMoveJobFromBoard(from: JobStatus | null, to: JobStatus, facts: { slotDayReached: boolean }): boolean {
  return isBoardJobTarget(to, facts) && canMoveJob(from, to);
}

/**
 * Whether sending an estimate from this step moves the job to
 * "awaiting-approval" (inspection, in service). A send while the job is
 * already awaiting approval moves nothing, so this is false there.
 */
export function canSendEstimateFrom(step: JobStatus | null): boolean {
  return JOB_MOVES.some((move) => move.how === "by-estimate" && move.from === step && move.to === "awaiting-approval");
}

/** What staff send for one update, as strings. Blank means "not this part". */
export type JobUpdateInput = {
  bookingId: string;
  /** The step to move to; blank to stay on the current one. */
  toStatus: string;
  note: string;
  /** The job photo set's id from the uploader's hidden field; blank for no photos. */
  photoSetId: string;
  /** A random uuid per visit of the update form, so a second send makes no second update. */
  requestToken: string;
};

export type JobUpdateInputProblem =
  | { field: "update"; problem: "nothing-to-update" }
  | { field: "status"; problem: "status-unknown" }
  | { field: "note"; problem: "note-too-long" }
  | { field: "form"; problem: "bad-request" };

export type CheckedJobUpdate = {
  bookingId: string;
  /** Null: no move. */
  toStatus: JobStatus | null;
  /** Null: no note. */
  note: string | null;
  /** Null: no photos. */
  photoSetId: string | null;
  requestToken: string;
};

/**
 * The update to store, or every problem with it. Whether the move is
 * allowed, and whether the photo set is the job's and unused, the save
 * checks with the booking locked: both depend on rows that can change.
 */
export function checkJobUpdateInput(
  input: JobUpdateInput,
): { ok: true; update: CheckedJobUpdate } | { ok: false; problems: JobUpdateInputProblem[] } {
  const problems: JobUpdateInputProblem[] = [];
  const bookingId = input.bookingId.trim();
  const toStatus = input.toStatus.trim();
  const note = normalizeTypedText(input.note);
  const photoSetId = input.photoSetId.trim();
  const requestToken = input.requestToken.trim();

  if (toStatus === "" && note === "" && photoSetId === "") problems.push({ field: "update", problem: "nothing-to-update" });
  if (toStatus !== "" && !isJobStatus(toStatus)) problems.push({ field: "status", problem: "status-unknown" });
  if (typedLength(note) > JOB_UPDATE_RULES.noteMaxLength) problems.push({ field: "note", problem: "note-too-long" });
  // Ids are made by the server and the page; a bad one is a hand-made post.
  if (!isUuid(bookingId) || !isUuid(requestToken) || (photoSetId !== "" && !isUuid(photoSetId))) {
    problems.push({ field: "form", problem: "bad-request" });
  }

  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    update: {
      bookingId: bookingId.toLowerCase(),
      toStatus: toStatus === "" ? null : (toStatus as JobStatus),
      note: note === "" ? null : note,
      photoSetId: photoSetId === "" ? null : photoSetId.toLowerCase(),
      requestToken: requestToken.toLowerCase(),
    },
  };
}
