// What the review form on /account/reviews/[bookingId] shows: the state its
// Server Action (src/server/actions/reviews.ts) returns after each try, and
// the one reader of what the form posts (task 37). It lives here because a
// "use server" file may only export async functions, and the browser needs
// the initial state too.
//
// Like the estimate form's (estimate-form.ts), each state carries a
// submission counter: the form's fields are keyed by it, so they remount
// after every answer with what was posted as their starting values. The
// request token sits outside, so a retry reuses it.

import type { ReviewInput } from "@/domain/reviews";
import { formText } from "@/lib/form-text";

export const REVIEW_FIELD_NAMES = {
  rating: "rating",
  comment: "comment",
  requestToken: "requestToken",
} as const;

export type ReviewFormValues = { rating: string; comment: string };

export const emptyReviewFormValues: ReviewFormValues = { rating: "", comment: "" };

/** The form's values from what it posted. */
export function readReviewForm(formData: FormData): ReviewFormValues {
  return { rating: formText(formData, REVIEW_FIELD_NAMES.rating), comment: formText(formData, REVIEW_FIELD_NAMES.comment) };
}

/** What the save checks. The booking comes from the page's address, bound to the action. */
export function reviewInput(bookingId: string, formData: FormData): ReviewInput {
  return { bookingId, ...readReviewForm(formData), requestToken: formText(formData, REVIEW_FIELD_NAMES.requestToken) };
}

/** The parts of the form an error can belong to; "form" is the whole form. */
export type ReviewFormField = "rating" | "comment" | "form";

export type ReviewFormState = {
  /** Goes up by one with every answer. */
  submission: number;
  values: ReviewFormValues;
  errors: Partial<Record<ReviewFormField, string>>;
  /** True once the review is saved: the form shows its thank-you panel. */
  sent: boolean;
};

export const initialReviewFormState: ReviewFormState = { submission: 0, values: emptyReviewFormValues, errors: {}, sent: false };
