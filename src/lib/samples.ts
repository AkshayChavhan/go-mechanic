// The one gate for sample content: made-up trust stats and reviews that let
// us see the home page's design before the real numbers and reviews exist.
//
// The owner decided on 2026-10-27 that made-up numbers and reviews must never
// reach customers. So samples show under `npm run dev` only:
// - Next.js writes the value of NODE_ENV into the code at build time, so in a
//   production build this is `"production" === "development"`, always false.
//   The page stays static, and a production prerender never renders a sample.
// - Use it through the selectors in src/content/ (home.ts, about.ts, faq.ts),
//   which prefer real data whenever it exists, through realOrSamples() below.
//
// Why not devOnly() (src/lib/dev-only.ts)? Its comment invites showing dev
// pages on a staging server (a production build) by changing that one
// function. A staging site may be shown to customers, so samples keep their
// own switch, and a change to devOnly() can never turn them on.
export function showSamples(): boolean {
  return process.env.NODE_ENV === "development";
}

/** What a section gets: its items, and whether they are samples (each then shows a "Sample" badge). */
export type Shown<T> = { items: readonly T[]; sample: boolean };

/**
 * The real items in every build; else the samples, marked as samples, under
 * `npm run dev`; else null, and a section with null renders nothing. An empty
 * list counts as no data: an empty section would look broken.
 */
export function realOrSamples<T>(real: readonly T[] | null, samples: readonly T[]): Shown<T> | null {
  if (real && real.length > 0) return { items: real, sample: false };
  if (showSamples()) return { items: samples, sample: true };
  return null;
}
