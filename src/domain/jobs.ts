// The work on a booked vehicle (task 31): the steps it goes through, which
// moves between them are allowed, and what a job update may contain.
//
// Pure logic: no Next.js, React or database imports. The data-access save
// (src/server/dal/jobs.ts) checks what staff send with checkJobUpdateInput(),
// then, with the booking row locked, checks the move with canMoveJob().
//
// A job's step is its own column (bookings.job_status), apart from the
// booking's status (booked, and later confirmed or cancelled: tasks 25, 27).
// It's null until the vehicle reaches the garage: the timeline shows that as
// "Booked".

import { isUuid } from "./ids";
import { normalizeTypedText, typedLength } from "./typed-text";

/**
 * Every step after "Booked", in order. The order is stored in the database
 * enum, so a new step goes in its place here and in a new migration.
 * Nothing reaches "awaiting-approval" yet: sending an estimate (task 33) does.
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
 * The moves staff may make, from a step (null: not started) to the next.
 * Owner's defaults (2026-11-19, see the plan): one step at a time, straight
 * from inspection to ready when no work is needed, and back from ready to
 * in service when a problem turns up. Task 33 adds the estimate's moves into
 * "awaiting-approval" and task 34 the moves out of it: each is a row here.
 */
const JOB_MOVES: readonly (readonly [JobStatus | null, JobStatus])[] = [
  [null, "vehicle-received"],
  ["vehicle-received", "inspection"],
  ["inspection", "in-service"],
  ["inspection", "ready"],
  ["in-service", "ready"],
  ["ready", "in-service"],
  ["ready", "completed"],
];

/** Whether staff may move a job from `from` (null: not started) to `to`. */
export function canMoveJob(from: JobStatus | null, to: JobStatus): boolean {
  return JOB_MOVES.some(([a, b]) => a === from && b === to);
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
