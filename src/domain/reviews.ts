// A customer's review of a completed job (task 37): stars, an optional
// comment, and the first name it's credited to.
//
// Pure logic: no Next.js, React or database imports. The data-access save
// (src/server/dal/reviews.ts) checks what the form posts with
// checkReviewInput(), then checks against the database what only it can
// know: that the booking is the customer's and its job is completed, and
// that it has no review yet.

import { isUuid } from "./ids";
import { normalizeName } from "./profile";
import { normalizeTypedText, typedLength } from "./typed-text";

export const REVIEW_RULES = {
  /** Characters (code points, like Postgres char_length), after trimming. */
  commentMaxLength: 1000,
  /** Published reviews needed before the home page shows any (owner, 2026-11-19). */
  minForHome: 3,
  /** Reviews /reviews lists, newest first; paging waits until there are more. */
  pageSize: 100,
} as const;

export const RATINGS = [1, 2, 3, 4, 5] as const;
export type Rating = (typeof RATINGS)[number];

/** What the form posts, as strings. */
export type ReviewInput = {
  bookingId: string;
  /** "1" to "5". */
  rating: string;
  /** Blank for stars only. */
  comment: string;
  /** A random uuid per visit of the form, so a second send makes no second review. */
  requestToken: string;
};

export type ReviewInputProblem =
  | { field: "rating"; problem: "rating-missing" | "rating-invalid" }
  | { field: "comment"; problem: "comment-too-long" }
  | { field: "form"; problem: "bad-request" };

export type CheckedReview = {
  bookingId: string;
  rating: Rating;
  /** Null: stars only. */
  comment: string | null;
  requestToken: string;
};

/** The review to store, or every problem with it. */
export function checkReviewInput(
  input: ReviewInput,
): { ok: true; review: CheckedReview } | { ok: false; problems: ReviewInputProblem[] } {
  const problems: ReviewInputProblem[] = [];
  const rating = input.rating.trim();
  const parsed = RATINGS.find((value) => String(value) === rating);
  if (rating === "") problems.push({ field: "rating", problem: "rating-missing" });
  else if (parsed === undefined) problems.push({ field: "rating", problem: "rating-invalid" });

  const comment = normalizeTypedText(input.comment);
  if (typedLength(comment) > REVIEW_RULES.commentMaxLength) problems.push({ field: "comment", problem: "comment-too-long" });

  const bookingId = input.bookingId.trim();
  const requestToken = input.requestToken.trim();
  // Both are made by the server and the page; a bad one is a hand-made post.
  if (!isUuid(bookingId) || !isUuid(requestToken)) problems.push({ field: "form", problem: "bad-request" });

  if (problems.length > 0 || parsed === undefined) return { ok: false, problems };
  return {
    ok: true,
    review: {
      bookingId: bookingId.toLowerCase(),
      rating: parsed,
      comment: comment === "" ? null : comment,
      requestToken: requestToken.toLowerCase(),
    },
  };
}

/**
 * The name a review is credited to: the first word of the saved name, as
 * the name form normalised it ("Asha Patil" → "Asha", "A. Patil" → "A.").
 * Empty when there's no name (the save then sends the customer to /account).
 */
export function firstName(name: string): string {
  return normalizeName(name).split(" ")[0] ?? "";
}

/** The average of `ratings` to one decimal (4.33 → 4.3), or null with none. */
export function averageRating(ratings: readonly number[]): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((total, rating) => total + rating, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}
