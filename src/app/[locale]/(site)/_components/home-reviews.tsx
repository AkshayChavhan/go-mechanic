import { useTranslations } from "next-intl";

import { ReviewCard } from "@/components/site/review-card";
import { sceneMark } from "@/components/site/scroll-scene-attributes";
import { Section } from "@/components/site/section";
import type { Review, Shown } from "@/content/home";

import type { Tone } from "./home-tones";

/**
 * A preview of customer reviews. Like the stats, the page renders it only
 * when selectReviews() gives it something: until task 37 that's the samples,
 * under `npm run dev` only.
 */
export function HomeReviews({ reviews, tone }: { reviews: Shown<Review>; tone: Tone }) {
  const t = useTranslations("HomePage.reviews");

  return (
    <Section tone={tone} width="wide" aria-labelledby="home-reviews">
      <div className="flex flex-col gap-12">
        <h2 id="home-reviews" {...sceneMark("reveal")} className="type-headline text-balance">
          {t("title")}
        </h2>
        <ul {...sceneMark("revealGroup")} className="grid gap-4 md:grid-cols-3">
          {reviews.items.map((review) => (
            <li key={review.id}>
              <ReviewCard review={review} sample={reviews.sample} />
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
