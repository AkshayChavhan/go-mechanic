"use server";

// The review form's Server Action (task 37): /account/reviews/[bookingId].
//
// Like the other customer actions (estimates.ts), it takes the locale as its
// bound first argument and checks it, then checks who is logged in
// (requireUser): logged out, it redirects to /login. The booking id is bound
// too, from the page's address; the save checks that it's the customer's own
// completed job, so a changed id gives "not-found", never someone else's.
//
// "use server" must come first; `import "server-only"` follows it.

import "server-only";

import { getTranslations } from "next-intl/server";
import { RedirectType } from "next/navigation";

import { redirect } from "@/i18n/navigation";
import { ACCOUNT_PATH } from "@/lib/access-routes";
import { readReviewForm, type ReviewFormField, type ReviewFormState, reviewInput } from "@/lib/review-form";
import { requireUser } from "@/server/auth/access";
import { createMyReview } from "@/server/dal/reviews";

import { checkedLocale } from "./form-input";

/** Sends a review of one of the customer's completed jobs. The save refreshes /reviews and the home page. */
export async function sendReview(
  locale: string,
  bookingId: string,
  previous: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const checked = checkedLocale(locale);
  await requireUser(checked);

  // Bound by the page, but a hand-made call could send anything: only a string goes on.
  const result = await createMyReview(reviewInput(typeof bookingId === "string" ? bookingId : "", formData));
  // No name yet: the name form on /account comes first. Outside any try:
  // redirect() works by throwing.
  if (result.status === "needs-name") return redirect({ href: ACCOUNT_PATH, locale: checked }, RedirectType.replace);

  const next = { submission: previous.submission + 1, values: readReviewForm(formData) };
  // A second send of the same form: the first review stands, so the same thank-you.
  if (result.status === "sent" || result.status === "duplicate") return { ...next, errors: {}, sent: true };

  const t = await getTranslations({ locale: checked, namespace: "ReviewPage" });
  const errors: Partial<Record<ReviewFormField, string>> = {};
  if (result.status === "not-found") errors.form = t("errors.not-found");
  else if (result.status === "already-reviewed") errors.form = t("errors.already-reviewed");
  else {
    // One message per field: the first problem found is the one to fix first.
    for (const { field, problem } of result.problems) errors[field] ??= t(`errors.${problem}`);
  }
  return { ...next, errors, sent: false };
}
