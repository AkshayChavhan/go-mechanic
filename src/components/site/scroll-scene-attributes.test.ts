import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { sceneAttribute, sceneCount, sceneMark, sceneSelector } from "./scroll-scene-attributes";

// Comments removed, so a commented-out rule never counts.
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("the scroll scene's attributes", () => {
  test("are unique data-* attributes", () => {
    const names = Object.values(sceneAttribute);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^data-[a-z]+(?:-[a-z]+)*$/);
  });

  test("sceneSelector and sceneMark use the same names", () => {
    expect(sceneSelector("reveal")).toBe("[data-scene-reveal]");
    expect(sceneMark("revealGroup")).toEqual({ "data-scene-reveal-group": "" });
    expect(sceneMark("storyRail")).toEqual({ "data-scene-story-rail": "" });
  });

  test("sceneCount writes the final value, and decimals only when there are some", () => {
    expect(sceneCount(5000)).toEqual({ "data-scene-count": "5000" });
    expect(sceneCount(4.8, 1)).toEqual({ "data-scene-count": "4.8", "data-scene-count-decimals": "1" });
  });

  test("globals.css prints every reveal target visible, whether or not it has played", () => {
    // GSAP hides a reveal inline until it scrolls into view. If an attribute
    // is renamed here but not in the print rule, those parts print blank.
    const print = /@media\s+print\s*\{([\s\S]*?\})\s*\}/.exec(css)?.[1];
    expect(print, "a @media print block").toBeDefined();
    const [selectors, declarations] = print!.split("{");
    expect(selectors.split(",").map((selector) => selector.trim())).toEqual(
      expect.arrayContaining([sceneSelector("reveal"), `${sceneSelector("revealGroup")} > *`]),
    );
    expect(declarations).toMatch(/opacity:\s*1\s*!important/);
    expect(declarations).toMatch(/transform:\s*none\s*!important/);
  });
});
