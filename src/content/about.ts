// The about page's facts the owner hasn't given yet: real, sample, or nothing.
//
// The owner decided on 2026-10-29 that the garage's story, team,
// certifications, genuine parts and warranty show as labelled samples until
// they send the real facts (task 19's plan, Key Decisions). So:
// - `aboutTopics` holds the real ones, or null (null today).
// - `sampleAboutTopics` are made up, to judge the design.
// - The page reads only through selectAboutTopics(): the real topics in
//   every build, else the samples under `npm run dev` (showSamples()), else
//   null, and the page then shows only what's confirmed.
//
// Only Server Components import this file, so the sample text stays on the
// server. No `import "server-only"` line: the browser tests (e2e/) import the
// canary from here, and Playwright can't load that package. The confirmed
// facts (where the garage is, what it works on, its hours) are in
// messages/en.json (AboutPage); this file never holds the brand name.

import type { LocalizedText } from "@/i18n/localized-text";
import { realOrSamples, type Shown } from "@/lib/samples";

/** One topic about the garage: a heading and a paragraph. */
export type AboutTopic = {
  id: "story" | "team" | "certifications" | "parts" | "warranty";
  title: LocalizedText;
  body: LocalizedText;
};

/** The real topics, or null until the owner gives them. Task 40 moves them to the database. */
export const aboutTopics: readonly AboutTopic[] | null = null;

// --- Samples: `npm run dev` only ------------------------------------------
// Plainly invented. Never copy them into aboutTopics.

/**
 * A phrase in one sample topic and nowhere else. The production browser
 * tests (e2e/info-pages.spec.ts) search the built pages for it: finding it
 * would mean a sample leaked.
 */
export const aboutSampleCanary = "older than our first spanner";

export const sampleAboutTopics: readonly AboutTopic[] = [
  {
    id: "story",
    title: { en: "How the garage started" },
    body: {
      en: `A sample story: the garage opened with two bays and a toolbox ${aboutSampleCanary}, fixing scooters for neighbours.`,
    },
  },
  {
    id: "team",
    title: { en: "Who works on your vehicle" },
    body: { en: "A sample team: four mechanics, two for cars and two for two-wheelers, and someone at the desk to answer calls." },
  },
  {
    id: "certifications",
    title: { en: "Training and certificates" },
    body: { en: "Sample certificates: manufacturer training for car air conditioning and for scooter engines." },
  },
  {
    id: "parts",
    title: { en: "Genuine parts" },
    body: {
      en: "A sample promise: genuine (OEM) or matching-quality (OES) parts, shown to you in the box before they go in.",
    },
  },
  {
    id: "warranty",
    title: { en: "Our warranty" },
    body: { en: "A sample warranty: 6 months or 10,000 km on the work we do, whichever comes first." },
  },
];

// --- Selector: the only way the page reads this file -----------------------

/** The topics to show: the real ones, else the samples under `npm run dev`, else null. */
export function selectAboutTopics(real: readonly AboutTopic[] | null = aboutTopics): Shown<AboutTopic> | null {
  return realOrSamples(real, sampleAboutTopics);
}
