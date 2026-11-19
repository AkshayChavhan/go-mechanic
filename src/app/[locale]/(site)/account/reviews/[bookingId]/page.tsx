import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Section } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { RATINGS, type Rating } from "@/domain/reviews";
import { Link } from "@/i18n/navigation";
import { ACCOUNT_PATH } from "@/lib/access-routes";

import { ReviewGate } from "./review-gate";

// /account/reviews/[bookingId]: review one completed job (task 37).
//
// The booking id is only known per request (no generateStaticParams: the
// bookings aren't known at build time), so it's runtime data. The shell
// (back link, heading, intro) is built ahead of time; the id is read inside
// <Suspense>, with the session, by ReviewGate (node_modules/next/dist/docs/
// 01-app/03-api-reference/03-file-conventions/dynamic-routes.md, "Without
// generateStaticParams"). It's under /account, so the proxy sends a visitor
// with no session cookie to /login with a real 307.

// Static: reads no session. noindex: a personal page, nothing to list.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ReviewPage");
  const tBrand = await getTranslations("Brand");
  return { title: t("metaTitle", { brand: tBrand("name") }), robots: { index: false, follow: false } };
}

export default async function ReviewJobPage({ params }: PageProps<"/[locale]/account/reviews/[bookingId]">) {
  const locale = await getLocale();
  const t = await getTranslations("ReviewPage");
  const starLabels = Object.fromEntries(RATINGS.map((n) => [n, t("starLabel", { n })])) as Record<Rating, string>;
  const labels = {
    ratingLegend: t("ratingLegend"),
    starLabels,
    commentLabel: t("commentLabel"),
    commentHint: t("commentHint"),
    commentCount: t("commentCount"),
    submit: t("submit"),
    sending: t("sending"),
    connection: t("connection"),
    thanksHeading: t("thanksHeading"),
    thanksBody: t("thanksBody"),
    seeReviews: t("seeReviews"),
    back: t("back"),
  };

  return (
    // wide: the left edge lines up with the header's Wordmark.
    <Section width="wide">
      <div className="flex max-w-md flex-col gap-10">
        <div className="flex flex-col gap-3">
          <Button asChild variant="link" className="-ml-3 w-fit">
            <Link href={ACCOUNT_PATH}>
              <ArrowLeftIcon data-icon="inline-start" />
              {t("back")}
            </Link>
          </Button>
          <h1 className="type-headline text-balance">{t("heading")}</h1>
          <p className="type-lead text-pretty text-muted-foreground">{t("intro")}</p>
        </div>
        <Suspense fallback={<p className="type-body text-muted-foreground">{t("loading")}</p>}>
          {params.then(({ bookingId }) => (
            <ReviewGate locale={locale} bookingId={bookingId} labels={labels} />
          ))}
        </Suspense>
      </div>
    </Section>
  );
}
