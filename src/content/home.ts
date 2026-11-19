// The home page's trust stats and reviews: real, sample, or nothing.
//
// The owner has no real numbers or reviews yet, and decided on 2026-10-27
// that made-up ones must never reach customers (plan KTD7). So:
// - `trustStats` holds the real stats, or null (null today). Real reviews
//   come from the database (task 37): the page passes readPublishedReviews()
//   to selectHomeReviews(), which uses them from 3 published reviews.
// - `sampleTrustStats` and `sampleReviews` are made up, to judge the design.
// - The page reads only through selectTrustStats() and selectHomeReviews().
//   They return the real data in every build, else the samples under
//   `npm run dev` (showSamples()), else null, and a section with null
//   renders nothing.
//
// Only Server Components may import this file, so the sample text stays on
// the server. The words around each number ("Years in business", "+", "/5")
// and the "Sample" badge are in messages/en.json (HomePage); this file holds
// only values and review text, and never the brand name.

import type { LocalizedText } from "@/i18n/localized-text";
import { realOrSamples, type Shown } from "@/lib/samples";

import type { VehicleKind } from "@/domain/vehicles";

/**
 * One trust stat, from the brief (features.md, Home). The rating isn't one
 * any more (task 37, owner 2026-11-19): its one source is this site's own
 * reviews, shown with them in the reviews section.
 */
export type TrustStat = {
  id: "years" | "vehicles" | "warranty";
  /** The number alone: 10, 5000, 6. Messages add the words around it. */
  value: number;
  /** Digits after the decimal point. */
  decimals: number;
  /** Whether it counts up when scrolled into view. The warranty is shown, not counted. */
  counts: boolean;
};

/**
 * One customer review as a card shows it. A real one (task 37) is credited
 * to the customer's first name and the vehicle's brand and type ("Asha,
 * Honda car"); a sample has no credit and is shown as "Sample customer, car".
 */
export type Review = {
  id: string;
  /** Stars, 1 to 5. */
  rating: 1 | 2 | 3 | 4 | 5;
  /** The customer's words, or null for stars only. */
  comment: string | null;
  kind: VehicleKind;
  /** Null for a sample. */
  credit: { name: string; makeName: LocalizedText } | null;
  /** The garage's reply, or null. */
  reply: string | null;
};

/** The reviews' average (one decimal) and how many there are. */
export type ReviewsSummary = { average: number; count: number };

/** What the home page's reviews section shows: 3 cards and the summary. */
export type HomeReviewsShown = Shown<Review> & { summary: ReviewsSummary };

/** Published reviews as readPublishedReviews() returns them (src/server/dal/reviews.ts). */
export type PublishedReviewsInput = {
  reviews: readonly {
    id: string;
    rating: Review["rating"];
    comment: string | null;
    kind: VehicleKind;
    shownName: string;
    makeName: LocalizedText;
    reply: string | null;
  }[];
  count: number;
  average: number | null;
};

/** What a section gets (from src/lib/samples.ts, shared by every content file with samples). */
export type { Shown };

/**
 * The real trust stats, or null until the owner gives them. Years in business
 * is a number the owner gives, never worked out from today's date (reading
 * the date would stop the page being built ahead of time).
 */
export const trustStats: readonly TrustStat[] | null = null;

// --- Samples: `npm run dev` only ------------------------------------------
// Round, obviously invented values. Never copy them into trustStats.

export const sampleTrustStats: readonly TrustStat[] = [
  { id: "years", value: 10, decimals: 0, counts: true },
  { id: "vehicles", value: 5000, decimals: 0, counts: true },
  { id: "warranty", value: 6, decimals: 0, counts: false },
];

/**
 * A phrase that appears in one sample review and nowhere else. The production
 * tests (e2e/home.spec.ts) search the built site's HTML, page data and
 * JavaScript for it: finding it would mean a sample leaked into production.
 */
export const sampleCanary = "quiet as a sleeping cat";

export const sampleReviews: readonly Review[] = [
  {
    id: "sample-brakes",
    kind: "car",
    rating: 5,
    comment: `They showed me the worn brake pads and told me the price before changing them. The brakes are ${sampleCanary} now.`,
    credit: null,
    reply: null,
  },
  {
    id: "sample-scooter-service",
    kind: "two-wheeler",
    rating: 5,
    comment: "Periodic service for my scooter. They explained what was done and why, in plain words.",
    credit: null,
    reply: null,
  },
  {
    id: "sample-ac",
    kind: "car",
    rating: 4,
    comment: "The AC cools properly again. I waited a little on a busy Sunday, but the work was neat.",
    credit: null,
    reply: null,
  },
];

/** The samples' made-up summary. */
export const sampleReviewsSummary: ReviewsSummary = { average: 4.7, count: 3 };

// --- Selectors: the only way the page reads this file ----------------------

/** The trust stats to show: the real ones, else the samples under `npm run dev`, else null. */
export function selectTrustStats(real: readonly TrustStat[] | null = trustStats): Shown<TrustStat> | null {
  return realOrSamples(real, sampleTrustStats);
}

/** A published review as a card shows it: credited to the first name and the brand and type (never the model, task 39). */
export function toReviewCard(review: PublishedReviewsInput["reviews"][number]): Review {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    kind: review.kind,
    credit: { name: review.shownName, makeName: review.makeName },
    reply: review.reply,
  };
}

/** How many reviews the home page shows. */
export const HOME_REVIEW_CARDS = 3;

/**
 * The home page's reviews (task 37): real ones once `minForHome` (3) are
 * published (owner, 2026-11-19), else the samples under `npm run dev`, else
 * null. The 3 cards are the newest with a comment first, topped up with the
 * newest stars-only ones, so there are always 3.
 */
export function selectHomeReviews(published: PublishedReviewsInput, minForHome: number): HomeReviewsShown | null {
  if (published.count >= minForHome && published.average !== null) {
    const withComment = published.reviews.filter((review) => review.comment !== null);
    const starsOnly = published.reviews.filter((review) => review.comment === null);
    const items = [...withComment, ...starsOnly].slice(0, HOME_REVIEW_CARDS).map(toReviewCard);
    return { items, sample: false, summary: { average: published.average, count: published.count } };
  }
  const samples = realOrSamples(null, sampleReviews);
  return samples && { ...samples, summary: sampleReviewsSummary };
}
