import { StarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Review } from "@/content/home";
import { localize } from "@/i18n/localized-text";
import { cn } from "@/lib/utils";

import { SampleBadge } from "./sample-badge";

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Five stars, filled up to the rating. The stars are decorative (hidden from
 * screen readers), which hear `label` instead ("Rated 4 out of 5"). Filled
 * and outlined stars differ in shape, not only in colour.
 */
function Stars({ rating, label }: { rating: number; label: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {STARS.map((star) => (
        <StarIcon
          key={star}
          aria-hidden="true"
          className={cn("size-4", star <= rating ? "fill-current text-foreground" : "text-muted-foreground")}
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * One customer review: its stars, its words as a quotation, and who wrote it
 * (a vehicle, never a name for a sample). `sample` marks a made-up review
 * (`npm run dev` only): a "Sample" badge, data-sample, and the credit
 * "Sample customer with a car". Task 37 brings real reviews.
 */
export function ReviewCard({ review, sample = false }: { review: Review; sample?: boolean }) {
  const t = useTranslations("HomePage.reviews");
  const locale = useLocale();

  return (
    <Card {...(sample ? { "data-sample": "" } : {})} className="h-full [--card-spacing:--spacing(6)]">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <Stars rating={review.rating} label={t("rating", { rating: review.rating })} />
        {sample && <SampleBadge />}
      </CardHeader>
      <CardContent>
        <figure className="flex flex-col gap-4">
          <blockquote className="type-body">{localize(review.text, locale)}</blockquote>
          <figcaption className="text-muted-foreground">
            {t(sample ? "sampleCredit" : "credit", { vehicle: review.vehicle })}
          </figcaption>
        </figure>
      </CardContent>
    </Card>
  );
}
