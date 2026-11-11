import { describe, expect, test } from "vitest";

import { FOOTER_TONE } from "./home-tones";
import { pageTones } from "./page-tones";

describe("pageTones", () => {
  test.each([
    [1, ["white"]],
    [2, ["white", "dark"]],
    [3, ["white", "grey", "white"]],
    [4, ["white", "grey", "white", "dark"]],
  ])("%i sections: %j", (count, expected) => {
    expect(pageTones(count)).toEqual(expected);
  });

  test.each([1, 2, 3, 4, 5, 6, 7])("%i sections: no two neighbours share a tone, the footer included", (count) => {
    const tones = [...pageTones(count), FOOTER_TONE];
    for (let i = 1; i < tones.length; i++) expect(tones[i], `section ${i}`).not.toBe(tones[i - 1]);
  });

  test("no sections, no tones", () => {
    expect(pageTones(0)).toEqual([]);
  });
});
