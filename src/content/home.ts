// The home page's trust stats and reviews: real, sample, or nothing.
//
// The owner has no real numbers or reviews yet, and decided on 2026-10-27
// that made-up ones must never reach customers (plan KTD7). So:
// - `trustStats` and `reviews` hold the real data, or null (both null today).
// - `sampleTrustStats` and `sampleReviews` are made up, to judge the design.
// - The page reads only through selectTrustStats() and selectReviews(). They
//   return the real data in every build, else the samples under `npm run dev`
//   (showSamples()), else null, and a section with null renders nothing.
//
// Only Server Components may import this file, so the sample text stays on
// the server. The words around each number ("Years in business", "+", "/5")
// and the "Sample" badge are in messages/en.json (HomePage); this file holds
// only values and review text, and never the brand name.

import type { LocalizedText } from "@/i18n/localized-text";
import { realOrSamples, type Shown } from "@/lib/samples";

import type { VehicleKind } from "./services";

/** One trust stat. The four ids are the ones the brief asks for (features.md, Home). */
export type TrustStat = {
  id: "years" | "vehicles" | "rating" | "warranty";
  /** The number alone: 10, 5000, 4.8, 6. Messages add the words around it. */
  value: number;
  /** Digits after the decimal point: 1 for the rating ("4.8"), 0 for the rest. */
  decimals: number;
  /** Whether it counts up when scrolled into view. The warranty is shown, not counted. */
  counts: boolean;
};

/**
 * One customer review. No name: a sample is credited "Sample customer" and
 * its vehicle, never a real-looking person. Task 37 adds real reviews, with
 * whatever the customer agreed to show.
 */
export type Review = {
  id: string;
  vehicle: VehicleKind;
  /** Stars, 1 to 5. */
  rating: 1 | 2 | 3 | 4 | 5;
  text: LocalizedText;
};

/** What a section gets (from src/lib/samples.ts, shared by every content file with samples). */
export type { Shown };

/**
 * The real trust stats, or null until the owner gives them. Years in business
 * is a number the owner gives, never worked out from today's date (reading
 * the date would stop the page being built ahead of time).
 */
export const trustStats: readonly TrustStat[] | null = null;

/** Real reviews, or null. Task 37 replaces this with the reviews customers write. */
export const reviews: readonly Review[] | null = null;

// --- Samples: `npm run dev` only ------------------------------------------
// Round, obviously invented values. Never copy them into trustStats.

export const sampleTrustStats: readonly TrustStat[] = [
  { id: "years", value: 10, decimals: 0, counts: true },
  { id: "vehicles", value: 5000, decimals: 0, counts: true },
  { id: "rating", value: 4.8, decimals: 1, counts: true },
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
    vehicle: "car",
    rating: 5,
    text: { en: `They showed me the worn brake pads and told me the price before changing them. The brakes are ${sampleCanary} now.` },
  },
  {
    id: "sample-scooter-service",
    vehicle: "two-wheeler",
    rating: 5,
    text: { en: "Periodic service for my scooter. They explained what was done and why, in plain words." },
  },
  {
    id: "sample-ac",
    vehicle: "car",
    rating: 4,
    text: { en: "The AC cools properly again. I waited a little on a busy Sunday, but the work was neat." },
  },
];

// --- Selectors: the only way the page reads this file ----------------------

/** The trust stats to show: the real ones, else the samples under `npm run dev`, else null. */
export function selectTrustStats(real: readonly TrustStat[] | null = trustStats): Shown<TrustStat> | null {
  return realOrSamples(real, sampleTrustStats);
}

/** The reviews to show: the real ones, else the samples under `npm run dev`, else null. */
export function selectReviews(real: readonly Review[] | null = reviews): Shown<Review> | null {
  return realOrSamples(real, sampleReviews);
}
