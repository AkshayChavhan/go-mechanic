import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Stars } from "@/components/site/review-card";
import { ReviewForm, type ReviewFormLabels } from "@/components/reviews/review-form";
import { Button } from "@/components/ui/button";
import { needsName } from "@/domain/profile";
import type { Locale } from "@/i18n/config";
import { localize } from "@/i18n/localized-text";
import { Link } from "@/i18n/navigation";
import { ACCOUNT_PATH } from "@/lib/access-routes";
import { sendReview } from "@/server/actions/reviews";
import { requireUser } from "@/server/auth/access";
import { readMyProfile } from "@/server/dal/profile";
import { readMyReviewTarget } from "@/server/dal/reviews";

import { inlineLinkClass } from "../../../_components/contact-rich-text";

export type ReviewGateProps = {
  locale: Locale;
  bookingId: string;
  /** The form's labels the page builds ahead of time; the credit preview is added here. */
  labels: Omit<ReviewFormLabels, "creditPreview">;
};

/**
 * Who may review this booking, and the form for them (task 37):
 * - logged out: to /login?session=ended (requireUser; the proxy already sends
 *   a visitor with no session cookie there with a real 307);
 * - no name yet: a link to /account, where the name form is;
 * - not the customer's completed job (or no such booking): a note;
 * - already reviewed: its stars and a link back;
 * - otherwise the form, with the credit it will be shown under.
 *
 * It reads the session, so the page puts it inside <Suspense>. The
 * sendReview action checks it all again, so a form posted directly can't
 * skip this.
 */
export async function ReviewGate({ locale, bookingId, labels }: ReviewGateProps) {
  await requireUser(locale);
  const t = await getTranslations({ locale, namespace: "ReviewPage" });
  const tReviews = await getTranslations({ locale, namespace: "Reviews" });
  const tEstimate = await getTranslations({ locale, namespace: "EstimatePage" });

  if (needsName(await readMyProfile())) {
    return (
      <GateNote note={tEstimate("nameNote")}>
        <Button asChild className="w-full sm:w-fit">
          <Link href={ACCOUNT_PATH}>{tEstimate("nameLink")}</Link>
        </Button>
      </GateNote>
    );
  }

  const target = await readMyReviewTarget(bookingId);
  if (target.status === "not-found") {
    return <GateNote note={t("notFound")}>{backLink(labels.back)}</GateNote>;
  }
  if (target.status === "already-reviewed") {
    return (
      <GateNote note={t("alreadyReviewed", { rating: target.rating })}>
        <Stars rating={target.rating} label={tReviews("rating", { rating: target.rating })} />
        {backLink(labels.back)}
      </GateNote>
    );
  }

  const credit = tReviews("credit", { name: target.shownName, make: localize(target.makeName, locale), kind: target.kind });
  return (
    <div className="flex flex-col gap-6">
      <p className="type-body font-semibold">{t("vehicle", { make: localize(target.makeName, locale), kind: target.kind })}</p>
      <ReviewForm
        // Keyed by the booking: another booking's page never shows this draft.
        key={target.bookingId}
        // The locale and the booking go in as the action's first arguments.
        action={sendReview.bind(null, locale, target.bookingId)}
        labels={{ ...labels, creditPreview: t("creditPreview", { credit }) }}
        publicNote={t.rich("publicNote", {
          privacy: (chunks) => (
            <Link href="/privacy" className={inlineLinkClass}>
              {chunks}
            </Link>
          ),
        })}
      />
    </div>
  );
}

function backLink(label: string) {
  return (
    <Button asChild variant="secondary" className="w-full sm:w-fit">
      <Link href={ACCOUNT_PATH}>{label}</Link>
    </Button>
  );
}

function GateNote({ note, children }: { note: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="type-body text-pretty">{note}</p>
      {children}
    </div>
  );
}
