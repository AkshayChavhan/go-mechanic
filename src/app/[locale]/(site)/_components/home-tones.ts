// The home page's section tones, worked out from which sections show.
//
// Neighbouring sections must never share a tone, the grey footer included
// (plan R2). The stats and reviews sections come and go (real data, samples
// under `npm run dev`, or nothing), so their tones, and the final call to
// action's, can't be fixed in the markup:
// - hero white, story black, services grey: always;
// - stats and reviews, when they show, alternate white and grey after that;
// - the call to action sits on the grey footer, so it's white after a grey
//   band, and black (a second showcase) after a white one.
// Today that gives the plan's tones in both builds (assumption A1), and still
// works once the owner adds real stats before task 37 adds real reviews.

export type Tone = "white" | "grey" | "dark";

/** The tone of SiteFooter, under every page. */
export const FOOTER_TONE: Tone = "grey";

export function homeTones(shown: { stats: boolean; reviews: boolean }) {
  // The tones shown so far, top down: hero, story, services.
  const shownTones: Tone[] = ["white", "dark", "grey"];
  const after = (previous: Tone): Tone => (previous === "grey" ? "white" : "grey");

  const stats = after(shownTones[shownTones.length - 1]);
  if (shown.stats) shownTones.push(stats);
  const reviews = after(shownTones[shownTones.length - 1]);
  if (shown.reviews) shownTones.push(reviews);
  const cta: Tone = shownTones[shownTones.length - 1] === "grey" ? "white" : "dark";

  return { hero: "white", story: "dark", services: "grey", stats, reviews, cta } as const satisfies Record<string, Tone>;
}
