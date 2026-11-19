import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { ReviewCard } from "@/components/site/review-card";
import { Section } from "@/components/site/section";
import { toReviewCard } from "@/content/home";
import { formatNumber } from "@/i18n/format";
import { readPublishedReviews } from "@/server/dal/reviews";

import { pageTones } from "../_components/page-tones";

// /reviews (task 37): every published review, newest first, with the average
// and the count. Real reviews only, in every build (no samples here). Built
// ahead of time from a cached read, refreshed when a review is sent, hidden
// or answered (the "reviews" tag). Task 42 adds the AggregateRating
// structured data.

export const ensureStatic = "navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ReviewsPage");
  const tBrand = await getTranslations("Brand");
  const brand = tBrand("name");
  return { title: t("metaTitle", { brand }), description: t("metaDescription", { brand }) };
}

export default async function ReviewsPage() {
  const locale = await getLocale();
  const t = await getTranslations("ReviewsPage");
  const tReviews = await getTranslations("Reviews");
  const published = await readPublishedReviews();
  const tones = pageTones(2);

  // Brand and type only: the model is a draft until the owner approves the models (task 39).
  const cards = published.reviews.map(toReviewCard);

  return (
    <>
      <Section tone={tones[0]} width="wide">
        <div className="flex max-w-2xl flex-col gap-3">
          <h1 className="type-headline text-balance">{t("heading")}</h1>
          <p className="type-lead text-pretty text-muted-foreground">{t("intro")}</p>
          {published.average !== null && (
            <p className="type-title">
              {tReviews("summary", { average: formatNumber(published.average, locale, 1), count: published.count })}
            </p>
          )}
        </div>
      </Section>

      <Section tone={tones[1]} width="wide">
        {cards.length === 0 ? (
          <div className="flex max-w-2xl flex-col gap-2">
            <p className="type-title">{t("empty")}</p>
            <p className="type-body text-pretty text-muted-foreground">{t("howTo")}</p>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {cards.map((review) => (
              <li key={review.id}>
                <ReviewCard review={review} variant="full" />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
