"use client";

// The review form on /account/reviews/[bookingId] (task 37): stars, an
// optional comment, the credit it will be shown under, and a note that it's
// public at once.
//
// A client component ("island") like the estimate form (estimate-form.tsx):
// it keeps the action's answer (useActionState) and moves the cursor to the
// first field to fix. It reads no messages: the page reads them on the
// server and passes every label as a prop.
// - The <form> belongs to the visit; its fields are keyed by the answer's
//   submission counter, so they remount with what was posted.
// - The request token is made on the first send and reused by every retry
//   of this visit, so a lost answer never makes a second review.
// - FreshOnEachVisit starts it all fresh on each visit: the next customer on
//   a shared phone never sees the last one's draft.
// - Once sent, a thank-you panel takes the form's place.

import { type ReactNode, useActionState, useEffect, useId, useRef, useState } from "react";

import { type FormAction, FreshOnEachVisit, ids, SubmitButton, submitterWithFallback } from "@/components/account/form-parts";
import { StarRatingInput } from "@/components/site/star-rating-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { RATINGS, type Rating, REVIEW_RULES } from "@/domain/reviews";
import { Link } from "@/i18n/navigation";
import { initialReviewFormState, readReviewForm, REVIEW_FIELD_NAMES, type ReviewFormState } from "@/lib/review-form";

/** The sendReview Server Action with the locale and the booking already bound. */
export type ReviewAction = FormAction<ReviewFormState>;

/** Every word the form shows, from the ReviewPage messages. The page reads them. */
export type ReviewFormLabels = {
  ratingLegend: string;
  starLabels: Record<Rating, string>;
  commentLabel: string;
  commentHint: string;
  /** "{count} of {max} characters". */
  commentCount: string;
  /** "Shown as: Asha, Honda car", made on the server. */
  creditPreview: string;
  submit: string;
  sending: string;
  connection: string;
  thanksHeading: string;
  thanksBody: string;
  seeReviews: string;
  back: string;
};

export type ReviewFormProps = {
  action: ReviewAction;
  labels: ReviewFormLabels;
  /** The public note, with its link to /privacy, rendered on the server. */
  publicNote: ReactNode;
};

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/**
 * What useActionState runs on each submit: it adds the visit's request token,
 * and a failed call (no network) becomes the `connection` message with
 * everything posted kept.
 */
export function reviewSubmitter(action: ReviewAction, connectionText: string, token: () => string) {
  const withToken: ReviewAction = (previous, formData) => {
    formData.set(REVIEW_FIELD_NAMES.requestToken, token());
    return action(previous, formData);
  };
  return submitterWithFallback(withToken, (previous, formData) => ({
    submission: previous.submission + 1,
    values: readReviewForm(formData),
    errors: { form: connectionText },
    sent: false,
  }));
}

/** The review form. It starts fresh on every visit (see the top of this file). */
export function ReviewForm(props: ReviewFormProps) {
  return (
    <FreshOnEachVisit>
      <ReviewFormVisit {...props} />
    </FreshOnEachVisit>
  );
}

function ReviewFormVisit({ action, labels, publicNote }: ReviewFormProps) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const token = useRef<string | null>(null);
  const [state, formAction] = useActionState(
    reviewSubmitter(action, labels.connection, () => (token.current ??= crypto.randomUUID())),
    initialReviewFormState,
  );

  // After an answer with errors, the cursor goes to the first field to fix.
  // Not when the page opens: on a phone that would pop the keyboard up.
  useEffect(() => {
    if (state.submission === 0 || state.sent) return;
    const target = state.errors.rating
      ? form.current?.querySelector<HTMLElement>(`input[name="${REVIEW_FIELD_NAMES.rating}"]`)
      : form.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    target?.focus();
  }, [state.submission, state.sent, state.errors.rating]);

  if (state.sent) {
    return (
      <div role="status" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <h2 className="type-title">{labels.thanksHeading}</h2>
        <p className="type-body text-pretty">{labels.thanksBody}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/reviews">{labels.seeReviews}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/account">{labels.back}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form ref={form} action={formAction} className="flex flex-col gap-8">
      <ReviewFields key={state.submission} state={state} labels={labels} />
      <p className="type-callout text-pretty">{labels.creditPreview}</p>
      <p id={`${id}-public`} className="type-callout text-pretty text-muted-foreground">
        {publicNote}
      </p>
      {state.errors.form && <FieldError>{state.errors.form}</FieldError>}
      <SubmitButton pendingLabel={labels.sending}>{labels.submit}</SubmitButton>
    </form>
  );
}

/**
 * The rating chosen in the page right now, or null. Like the estimate form's
 * choiceInPage: it runs during the first render in the browser, while React
 * hydrates, the only moment a star tapped before the page's JavaScript
 * loaded can still be read.
 */
function ratingInPage(groupId: string): Rating | null {
  if (typeof document === "undefined") return null;
  const checked = document
    .getElementById(groupId)
    ?.querySelector<HTMLInputElement>(`input[name="${REVIEW_FIELD_NAMES.rating}"]:checked`);
  return toRating(checked?.value ?? "");
}

function toRating(value: string): Rating | null {
  return RATINGS.find((rating) => String(rating) === value) ?? null;
}

function ReviewFields({ state, labels }: { state: ReviewFormState; labels: ReviewFormLabels }) {
  const id = useId();
  const { values, errors } = state;
  // A star tapped before hydration wins over the posted one. Only a value
  // changes here, never the structure, so hydration still matches.
  const [rating, setRating] = useState<Rating | null>(() => ratingInPage(`${id}-rating`) ?? toRating(values.rating));
  const [length, setLength] = useState([...values.comment.trim()].length);

  return (
    <>
      <div id={`${id}-rating`}>
        <StarRatingInput
          legend={labels.ratingLegend}
          name={REVIEW_FIELD_NAMES.rating}
          starLabels={labels.starLabels}
          value={rating}
          onChange={setRating}
          error={errors.rating}
          errorId={`${id}-rating-error`}
        />
      </div>
      <Field data-invalid={errors.comment ? true : undefined}>
        <FieldLabel htmlFor={`${id}-comment`}>{labels.commentLabel}</FieldLabel>
        <Textarea
          id={`${id}-comment`}
          name={REVIEW_FIELD_NAMES.comment}
          defaultValue={values.comment}
          // No maxLength: the browser counts emoji as two, the check counts them once.
          onChange={(event) => setLength([...event.currentTarget.value.trim()].length)}
          aria-invalid={errors.comment ? true : undefined}
          aria-describedby={ids(`${id}-comment-hint`, `${id}-comment-count`, errors.comment && `${id}-comment-error`)}
        />
        <FieldDescription id={`${id}-comment-hint`}>{labels.commentHint}</FieldDescription>
        {/* Not a live region: read with the field (aria-describedby), not on every keystroke. */}
        <p id={`${id}-comment-count`} className="type-caption text-muted-foreground tabular-nums">
          {fill(labels.commentCount, { count: length, max: REVIEW_RULES.commentMaxLength })}
        </p>
        {errors.comment && <FieldError id={`${id}-comment-error`}>{errors.comment}</FieldError>}
      </Field>
    </>
  );
}
