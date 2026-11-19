// Customers' reviews of completed jobs (task 37): the save, the customer's
// reads, the public read, and staff hiding and replying.
//
// The rules of this folder are in garage.ts:
// - the customer functions call authorizeUser() on their first line and
//   filter by the returned user's id: another customer's booking and a
//   missing one give the same "not-found";
// - the staff functions call authorize("content.edit") first;
// - readPublishedReviews() is a public cached read ('use cache', the
//   "reviews" tag). Every write calls updateTag("reviews") after it commits,
//   which only works inside a Server Action: call the writes from one.

import "server-only";

import { and, count, desc, eq, isNull, max, sql } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";

import { isUuid } from "@/domain/ids";
import { needsName } from "@/domain/profile";
import { averageRating, checkReviewInput, firstName, type Rating, REVIEW_RULES, type ReviewInput, type ReviewInputProblem } from "@/domain/reviews";
import { normalizeTypedText, typedLength } from "@/domain/typed-text";
import type { Fuel, VehicleKind } from "@/domain/vehicles";
import type { LocalizedText } from "@/i18n/localized-text";
import { type Clock, systemClock } from "@/lib/clock";
import { authorize, authorizeUser } from "@/server/auth/access";
import { getDatabase } from "@/server/db";
import { bookingEvents, bookings, reviews, vehicleMakes, vehicleModels } from "@/server/db/schema";

import { readMyProfile } from "./profile";

export const REVIEWS_TAG = "reviews";

export type CreateReviewResult =
  | { status: "sent"; id: string }
  /** The same form sent again (a double tap, a retry): the first review stands. */
  | { status: "duplicate"; id: string }
  | { status: "problems"; problems: ReviewInputProblem[] }
  /** Not the customer's booking, its job isn't completed, or there's no such booking. */
  | { status: "not-found" }
  /** The booking has a review already, sent from another visit of the form. */
  | { status: "already-reviewed"; id: string }
  /** No name yet: a review is credited to the first name, so the name form comes first. */
  | { status: "needs-name" };

/**
 * Sends a review for one of the logged-in customer's completed jobs. Public
 * at once (owner, 2026-11-19). Expected answers come back as a result; only
 * an unexpected database error throws (and rolls back).
 *
 * The order is the idempotent-save lesson's (document/solutions/conventions/):
 * lock the booking row through its filter (the customer's, completed), then
 * the caller's own request token answers "duplicate" whether or not the
 * lock found a row, then "not-found", then "already-reviewed", then the
 * insert. Calls updateTag, so call it from a Server Action.
 */
export async function createMyReview(input: ReviewInput, clock: Clock = systemClock): Promise<CreateReviewResult> {
  const user = await authorizeUser();
  const checked = checkReviewInput(input);
  if (!checked.ok) return { status: "problems", problems: checked.problems };
  const review = checked.review;

  // Its own query, so before the transaction (PGlite has one connection).
  const profile = await readMyProfile();
  const shownName = firstName(profile.name);

  const db = await getDatabase();
  const result = await db.transaction(async (tx): Promise<CreateReviewResult> => {
    const [booking] = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.id, review.bookingId), eq(bookings.userId, user.id), eq(bookings.jobStatus, "completed")))
      .for("update");

    const [earlier] = await tx
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.userId, user.id), eq(reviews.requestToken, review.requestToken)));
    if (earlier) return { status: "duplicate", id: earlier.id };
    if (!booking) return { status: "not-found" };

    const [existing] = await tx.select({ id: reviews.id }).from(reviews).where(eq(reviews.bookingId, booking.id));
    if (existing) return { status: "already-reviewed", id: existing.id };
    // A name can be cleared only by deleting the user, so this is rare; it's
    // still a refusal that comes after "duplicate".
    if (needsName(profile) || shownName === "") return { status: "needs-name" };

    const [saved] = await tx
      .insert(reviews)
      .values({
        bookingId: booking.id,
        userId: user.id,
        rating: review.rating,
        comment: review.comment,
        shownName,
        requestToken: review.requestToken,
        createdAt: clock.now(),
      })
      .onConflictDoNothing({ target: reviews.bookingId })
      .returning({ id: reviews.id });
    if (!saved) {
      // Another send for this booking won between the check and the insert.
      const [winner] = await tx.select({ id: reviews.id }).from(reviews).where(eq(reviews.bookingId, booking.id));
      return { status: "already-reviewed", id: winner!.id };
    }
    return { status: "sent", id: saved.id };
  });
  if (result.status === "sent") updateTag(REVIEWS_TAG);
  return result;
}

// --- The customer's reads ---------------------------------------------------------

/** One of the customer's completed jobs, as /account lists it. */
export type CompletedJobRow = {
  bookingId: string;
  /** Six characters without the dash: show it with formatBookingCode. */
  code: string;
  kind: VehicleKind;
  makeName: LocalizedText;
  modelName: LocalizedText;
  fuel: Fuel;
  /** When the job moved to "completed" (its job update). */
  completedAt: Date;
  /** The stars the customer gave, or null when they haven't reviewed it. */
  reviewRating: Rating | null;
};

/** How many completed jobs /account lists. */
export const COMPLETED_JOBS_SHOWN = 10;

/** The logged-in customer's completed jobs, most recently completed first. */
export async function listMyCompletedJobs(): Promise<CompletedJobRow[]> {
  const user = await authorizeUser();
  const db = await getDatabase();
  const completedAt = db
    .select({ bookingId: bookingEvents.bookingId, at: max(bookingEvents.createdAt).as("at") })
    .from(bookingEvents)
    .where(eq(bookingEvents.jobStatus, "completed"))
    .groupBy(bookingEvents.bookingId)
    .as("completed_at");
  const rows = await db
    .select({
      bookingId: bookings.id,
      code: bookings.code,
      kind: bookings.vehicleKind,
      makeName: vehicleMakes.name,
      modelName: vehicleModels.name,
      fuel: bookings.fuel,
      completedAt: completedAt.at,
      reviewRating: reviews.rating,
    })
    .from(bookings)
    .innerJoin(vehicleModels, eq(bookings.modelId, vehicleModels.id))
    .innerJoin(vehicleMakes, eq(vehicleModels.makeId, vehicleMakes.id))
    .innerJoin(completedAt, eq(completedAt.bookingId, bookings.id))
    .leftJoin(reviews, eq(reviews.bookingId, bookings.id))
    .where(and(eq(bookings.userId, user.id), eq(bookings.jobStatus, "completed")))
    .orderBy(desc(completedAt.at), desc(bookings.id))
    .limit(COMPLETED_JOBS_SHOWN);
  return rows.map((row) => ({ ...row, completedAt: new Date(row.completedAt!), reviewRating: (row.reviewRating as Rating | null) ?? null }));
}

/** What the review page needs for one booking. */
export type ReviewTarget =
  | { status: "can-review"; bookingId: string; kind: VehicleKind; makeName: LocalizedText; shownName: string }
  | { status: "already-reviewed"; bookingId: string; rating: Rating }
  /** Not the customer's, not completed, or no such booking. */
  | { status: "not-found" };

/** The review page's booking, for the logged-in customer. */
export async function readMyReviewTarget(bookingId: string): Promise<ReviewTarget> {
  const user = await authorizeUser();
  if (!isUuid(bookingId)) return { status: "not-found" };
  const profile = await readMyProfile();
  const db = await getDatabase();
  const [row] = await db
    .select({ bookingId: bookings.id, kind: bookings.vehicleKind, makeName: vehicleMakes.name, rating: reviews.rating })
    .from(bookings)
    .innerJoin(vehicleModels, eq(bookings.modelId, vehicleModels.id))
    .innerJoin(vehicleMakes, eq(vehicleModels.makeId, vehicleMakes.id))
    .leftJoin(reviews, eq(reviews.bookingId, bookings.id))
    .where(and(eq(bookings.id, bookingId), eq(bookings.userId, user.id), eq(bookings.jobStatus, "completed")));
  if (!row) return { status: "not-found" };
  if (row.rating !== null) return { status: "already-reviewed", bookingId: row.bookingId, rating: row.rating as Rating };
  return { status: "can-review", bookingId: row.bookingId, kind: row.kind, makeName: row.makeName, shownName: firstName(profile.name) };
}

// --- The public read ------------------------------------------------------------

/** A published review, as /reviews and the home page show it. */
export type PublishedReview = {
  id: string;
  rating: Rating;
  comment: string | null;
  shownName: string;
  kind: VehicleKind;
  makeName: LocalizedText;
  /** Kept for task 39: shown only once the owner has approved the models. */
  modelName: LocalizedText;
  reply: string | null;
  createdAt: Date;
};

export type PublishedReviews = {
  /** The newest REVIEW_RULES.pageSize, newest first. */
  reviews: PublishedReview[];
  /** Every published review counts, not only the listed ones. */
  count: number;
  /** One decimal, or null with none. */
  average: number | null;
};

/**
 * Every published (not hidden) review, newest first, with the count and the
 * average. Cached ('use cache', tag "reviews"), so /reviews and the home
 * page stay built ahead of time; every write calls updateTag("reviews").
 */
export async function readPublishedReviews(): Promise<PublishedReviews> {
  "use cache";
  cacheTag(REVIEWS_TAG);
  cacheLife("max");
  const db = await getDatabase();
  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      shownName: reviews.shownName,
      kind: bookings.vehicleKind,
      makeName: vehicleMakes.name,
      modelName: vehicleModels.name,
      reply: reviews.reply,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
    .innerJoin(vehicleModels, eq(bookings.modelId, vehicleModels.id))
    .innerJoin(vehicleMakes, eq(vehicleModels.makeId, vehicleMakes.id))
    .where(isNull(reviews.hiddenAt))
    .orderBy(desc(reviews.createdAt), desc(reviews.id))
    .limit(REVIEW_RULES.pageSize);
  const [totals] = await db
    .select({ count: count(), sum: sql<number>`coalesce(sum(${reviews.rating}), 0)::int` })
    .from(reviews)
    .where(isNull(reviews.hiddenAt));
  const total = totals?.count ?? 0;
  return {
    reviews: rows.map((row) => ({ ...row, rating: row.rating as Rating })),
    count: total,
    // averageRating's rounding, from the sum, so it counts every published review.
    average: total === 0 ? null : averageRating([((totals?.sum ?? 0) / total)]),
  };
}

// --- Staff ----------------------------------------------------------------------

export type ReviewChangeResult = { status: "changed" } | { status: "not-found" } | { status: "problems"; problem: "reply-missing" | "reply-too-long" };

/** Hides a review from the site (it stays stored), for "content.edit". Call from a Server Action. */
export async function hideReview(reviewId: string, clock: Clock = systemClock): Promise<ReviewChangeResult> {
  const user = await authorize("content.edit");
  if (!isUuid(reviewId)) return { status: "not-found" };
  const db = await getDatabase();
  const changed = await db
    .update(reviews)
    .set({ hiddenAt: clock.now(), hiddenBy: user.id })
    .where(eq(reviews.id, reviewId))
    .returning({ id: reviews.id });
  return finishChange(changed);
}

/** Shows a hidden review again, for "content.edit". Call from a Server Action. */
export async function showReview(reviewId: string): Promise<ReviewChangeResult> {
  await authorize("content.edit");
  if (!isUuid(reviewId)) return { status: "not-found" };
  const db = await getDatabase();
  const changed = await db
    .update(reviews)
    .set({ hiddenAt: null, hiddenBy: null })
    .where(eq(reviews.id, reviewId))
    .returning({ id: reviews.id });
  return finishChange(changed);
}

/** Sets (or replaces) the garage's reply to a review, for "content.edit". Call from a Server Action. */
export async function setReviewReply(reviewId: string, typed: string, clock: Clock = systemClock): Promise<ReviewChangeResult> {
  const user = await authorize("content.edit");
  const reply = normalizeTypedText(typed);
  if (reply === "") return { status: "problems", problem: "reply-missing" };
  if (typedLength(reply) > REVIEW_RULES.commentMaxLength) return { status: "problems", problem: "reply-too-long" };
  if (!isUuid(reviewId)) return { status: "not-found" };
  const db = await getDatabase();
  const changed = await db
    .update(reviews)
    .set({ reply, repliedAt: clock.now(), repliedBy: user.id })
    .where(eq(reviews.id, reviewId))
    .returning({ id: reviews.id });
  return finishChange(changed);
}

/** Removes the garage's reply, for "content.edit". Call from a Server Action. */
export async function clearReviewReply(reviewId: string): Promise<ReviewChangeResult> {
  await authorize("content.edit");
  if (!isUuid(reviewId)) return { status: "not-found" };
  const db = await getDatabase();
  const changed = await db
    .update(reviews)
    .set({ reply: null, repliedAt: null, repliedBy: null })
    .where(eq(reviews.id, reviewId))
    .returning({ id: reviews.id });
  return finishChange(changed);
}

function finishChange(changed: { id: string }[]): ReviewChangeResult {
  if (changed.length === 0) return { status: "not-found" };
  updateTag(REVIEWS_TAG);
  return { status: "changed" };
}
