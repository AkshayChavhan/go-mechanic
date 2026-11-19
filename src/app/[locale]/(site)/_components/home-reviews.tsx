import { useLocale, useTranslations } from "next-intl";

import { ReviewCard } from "@/components/site/review-card";
import { SampleBadge } from "@/components/site/sample-badge";
import { sceneMark } from "@/components/site/scroll-scene-attributes";
import { Section } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import type { HomeReviewsShown } from "@/content/home";
import { formatNumber } from "@/i18n/format";
import { Link } from "@/i18n/navigation";

import type { Tone } from "./home-tones";

/** Where every review is listed. */
export const REVIEWS_PATH = "/reviews";

/**
 * A preview of customer reviews: the average and the count, 3 cards, and a
 * link to /reviews. The page renders it only when selectHomeReviews() gives
 * it something: real reviews once 3 are published (task 37), else the
 * samples under `npm run dev` only. The rating is here and nowhere else on
 * the page: its one source is these reviews (owner, 2026-11-19).
 *
 * The link sits outside the reveal group: links are never reveal targets.
 */
export function HomeReviews({ reviews, tone }: { reviews: HomeReviewsShown; tone: Tone }) {
  const t = useTranslations("HomePage.reviews");
  const tReviews = useTranslations("Reviews");
  const locale = useLocale();

  return (
    <Section tone={tone} width="wide" aria-labelledby="home-reviews">
      <div className="flex flex-col gap-12">
        <div className="flex flex-col gap-3" {...sceneMark("reveal")}>
          <h2 id="home-reviews" className="type-headline text-balance">
            {t("title")}
          </h2>
          <p
            className="flex flex-wrap items-center gap-3 type-title text-muted-foreground"
            {...(reviews.sample ? { "data-sample": "" } : {})}
          >
            {tReviews("summary", {
              average: formatNumber(reviews.summary.average, locale, 1),
              count: reviews.summary.count,
            })}
            {reviews.sample && <SampleBadge />}
          </p>
        </div>
        <ul {...sceneMark("revealGroup")} className="grid gap-4 md:grid-cols-3">
          {reviews.items.map((review) => (
            <li key={review.id}>
              <ReviewCard review={review} sample={reviews.sample} />
            </li>
          ))}
        </ul>
        <Button asChild variant="link" className="-ml-3 w-fit">
          <Link href={REVIEWS_PATH}>{t("allLink")}</Link>
        </Button>
      </div>
    </Section>
  );
}
