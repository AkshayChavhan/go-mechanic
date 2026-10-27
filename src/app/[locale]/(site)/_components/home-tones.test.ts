import { describe, expect, test } from "vitest";

import { FOOTER_TONE, homeTones, type Tone } from "./home-tones";

/** The tones from the top of the page to the footer, for the sections that show. */
function pageTones(shown: { stats: boolean; reviews: boolean }): Tone[] {
  const tones = homeTones(shown);
  return [
    tones.hero,
    tones.story,
    tones.services,
    ...(shown.stats ? [tones.stats] : []),
    ...(shown.reviews ? [tones.reviews] : []),
    tones.cta,
    FOOTER_TONE,
  ];
}

describe("homeTones", () => {
  test.each([
    { stats: false, reviews: false },
    { stats: true, reviews: true },
    { stats: true, reviews: false },
    { stats: false, reviews: true },
  ])("neighbouring sections never share a tone, the footer included: %o", (shown) => {
    const tones = pageTones(shown);
    tones.slice(1).forEach((tone, index) => expect(tone, tones.join(", ")).not.toBe(tones[index]));
  });

  test("a production build today (no stats, no reviews): white, black, grey, white, then the grey footer", () => {
    expect(pageTones({ stats: false, reviews: false })).toEqual(["white", "dark", "grey", "white", "grey"]);
  });

  test("npm run dev today (sample stats and reviews): the plan's tones, the call to action white", () => {
    expect(pageTones({ stats: true, reviews: true })).toEqual(["white", "dark", "grey", "white", "grey", "white", "grey"]);
  });

  test("real stats before real reviews: the call to action turns black rather than repeat white", () => {
    expect(pageTones({ stats: true, reviews: false })).toEqual(["white", "dark", "grey", "white", "dark", "grey"]);
  });
});
