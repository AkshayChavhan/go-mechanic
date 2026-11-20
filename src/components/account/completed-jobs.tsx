import { getTranslations } from "next-intl/server";

import { Stars } from "@/components/site/review-card";
import { Button } from "@/components/ui/button";
import { formatBookingCode } from "@/domain/bookings";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { localize } from "@/i18n/localized-text";
import { Link } from "@/i18n/navigation";
import type { CompletedJobRow } from "@/server/dal/reviews";

/** The review page for one booking. */
export function reviewPath(bookingId: string): string {
  return `/account/reviews/${bookingId}`;
}

/**
 * "Your completed jobs" on /account (task 37): each job the garage finished,
 * most recently completed first. Each row says which visit it was (the
 * vehicle, the day it was completed and the booking code) and either the
 * stars the customer gave or a grey "Write a review" button (the page's one
 * blue button stays "Add a vehicle"). The account shows it only when there
 * is at least one.
 */
export async function CompletedJobs({ jobs, locale }: { jobs: CompletedJobRow[]; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "MyReviews" });
  const tReviews = await getTranslations({ locale, namespace: "Reviews" });

  return (
    <section aria-labelledby="my-completed-jobs" className="flex flex-col gap-6">
      <h2 id="my-completed-jobs" className="type-title">
        {t("heading")}
      </h2>
      <ul className="flex flex-col gap-4">
        {jobs.map((job) => (
          <li
            key={job.bookingId}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5"
          >
            <div className="flex flex-col gap-1">
              <h3 className="type-body font-semibold">
                {localize(job.makeName, locale)} {localize(job.modelName, locale)}
              </h3>
              <p className="flex flex-wrap gap-x-4 type-callout text-muted-foreground">
                <span>{t("completedOn", { date: formatDate(job.completedAt, locale) })}</span>
                <span className="whitespace-nowrap tabular-nums">{t("code", { code: formatBookingCode(job.code) })}</span>
              </p>
            </div>
            {job.reviewRating === null ? (
              <Button asChild variant="secondary">
                <Link href={reviewPath(job.bookingId)}>{t("write")}</Link>
              </Button>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <Stars rating={job.reviewRating} label={tReviews("rating", { rating: job.reviewRating })} />
                <p aria-hidden="true" className="type-caption text-muted-foreground">
                  {t("yourRating", { rating: job.reviewRating })}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
