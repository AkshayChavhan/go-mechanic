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
export function Stars({ rating, label }: { rating: number; label: string }) {
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

type ReviewCardProps = {
  review: Review;
  /** A made-up review (`npm run dev` only): a "Sample" badge and data-sample. */
  sample?: boolean;
  /**
   * "preview" (the home page): the comment clamped to 4 lines, no reply, so
   * three cards in a row stay calm. "full" (/reviews): the whole comment and
   * the garage's reply.
   */
  variant?: "preview" | "full";
};

/**
 * One customer review: its stars, its words as a quotation (none for stars
 * only), who wrote it, and on /reviews the garage's reply. A real review is
 * credited "Asha, Honda car" (task 37); a sample "Sample customer, car".
 */
export function ReviewCard({ review, sample = false, variant = "preview" }: ReviewCardProps) {
  const t = useTranslations("Reviews");
  const locale = useLocale();
  const credit = review.credit
    ? t("credit", { name: review.credit.name, make: localize(review.credit.makeName, locale), kind: review.kind })
    : t("sampleCredit", { kind: review.kind });

  return (
    <Card {...(sample ? { "data-sample": "" } : {})} className="h-full [--card-spacing:--spacing(6)]">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <Stars rating={review.rating} label={t("rating", { rating: review.rating })} />
        {sample && <SampleBadge />}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {review.comment ? (
          <figure className="flex flex-col gap-4">
            {/* Plain text: the customer's line breaks are kept by CSS, never as HTML. */}
            <blockquote
              className={cn("type-body break-words whitespace-pre-line text-pretty", variant === "preview" && "line-clamp-4")}
            >
              {review.comment}
            </blockquote>
            <figcaption className="text-muted-foreground">{credit}</figcaption>
          </figure>
        ) : (
          <p className="text-muted-foreground">{credit}</p>
        )}
        {variant === "full" && review.reply && (
          <div className="flex flex-col gap-1 rounded-lg bg-muted p-4">
            <p className="type-callout font-semibold">{t("reply")}</p>
            <p className="type-callout break-words whitespace-pre-line text-pretty">{review.reply}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
