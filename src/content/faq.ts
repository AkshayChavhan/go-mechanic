// The FAQ's answers the owner hasn't given yet: real, sample, or nothing.
//
// The answers the owner has confirmed (paying by cash or UPI, booking by
// WhatsApp or call, the hours) are in messages/en.json (FaqPage) and show in
// every build. The rest (warranty, how long jobs take, genuine parts, pickup
// and drop, the online booking window) aren't known or built yet. The owner
// decided on 2026-10-29 that they show as labelled samples until then
// (task 19's plan, Key Decisions). So:
// - `faqItems` holds real answers given later, or null (null today).
// - `sampleFaqItems` are made up, to judge the design.
// - The page reads only through selectFaqItems(): the real answers in every
//   build, else the samples under `npm run dev` (showSamples()), else null.
//
// Only Server Components import this file, so the sample text stays on the
// server. No `import "server-only"` line: the browser tests (e2e/) import the
// canary from here, and Playwright can't load that package.

import type { LocalizedText } from "@/i18n/localized-text";
import { realOrSamples, type Shown } from "@/lib/samples";

/** The FAQ's groups, in page order. Their headings are in messages (FaqPage.groups). */
export const FAQ_GROUPS = ["paying", "visit", "work"] as const;

export type FaqGroup = (typeof FAQ_GROUPS)[number];

/** One question and its answer, in a group. */
export type FaqItem = {
  id: string;
  group: FaqGroup;
  question: LocalizedText;
  answer: LocalizedText;
};

/** Real answers the owner gives later, or null. Task 40 moves the FAQ to the database. */
export const faqItems: readonly FaqItem[] | null = null;

// --- Samples: `npm run dev` only ------------------------------------------
// Plainly invented. Never copy them into faqItems.

/**
 * A phrase in one sample answer and nowhere else. The production browser
 * tests (e2e/info-pages.spec.ts) search the built pages for it.
 */
export const faqSampleCanary = "about as long as a cricket match";

export const sampleFaqItems: readonly FaqItem[] = [
  {
    id: "sample-booking-window",
    group: "paying",
    question: { en: "How far ahead can I book online?" },
    answer: { en: "A sample answer: from tomorrow up to 7 days ahead, in 1-hour slots." },
  },
  {
    id: "sample-job-times",
    group: "visit",
    question: { en: "How long does a service take?" },
    answer: { en: `A sample answer: a periodic car service takes ${faqSampleCanary}; a scooter service, about two hours.` },
  },
  {
    id: "sample-pickup",
    group: "visit",
    question: { en: "Can you pick up my vehicle?" },
    answer: { en: "A sample answer: yes, in nearby PIN codes, for a small fee." },
  },
  {
    id: "sample-warranty",
    group: "work",
    question: { en: "Is the work under warranty?" },
    answer: { en: "A sample answer: 6 months or 10,000 km on the work we do, whichever comes first." },
  },
  {
    id: "sample-parts",
    group: "work",
    question: { en: "Do you use genuine parts?" },
    answer: { en: "A sample answer: genuine (OEM) or matching-quality (OES) parts, and we show you the box." },
  },
];

// --- Selector: the only way the page reads this file -----------------------

/** The answers to show: the real ones, else the samples under `npm run dev`, else null. */
export function selectFaqItems(real: readonly FaqItem[] | null = faqItems): Shown<FaqItem> | null {
  return realOrSamples(real, sampleFaqItems);
}
