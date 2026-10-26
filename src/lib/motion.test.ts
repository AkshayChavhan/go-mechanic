import { readFileSync } from "node:fs";

import { gsap } from "gsap";
import { describe, expect, test } from "vitest";

import { duration, ease, motionAllowed, motionReduced } from "@/lib/motion";

// motion.ts (for GSAP) and globals.css (for CSS) hold the same motion values.
// These tests keep the two equal, so CSS and GSAP motion always feel the same.

// Comments removed, so a commented-out value never counts.
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** The value of a CSS variable declared exactly once in globals.css. */
function cssVariable(name: string): string {
  const values = [...css.matchAll(new RegExp(`--${name}\\s*:\\s*([^;]+);`, "g"))].map(([, value]) => value.trim());
  // Declared twice, the later one would win and this test could read the wrong one.
  expect(values, `--${name} in globals.css`).toHaveLength(1);
  return values[0];
}

const withoutSpaces = (value: string) => value.replace(/\s/g, "");

describe("motion tokens", () => {
  test.each(Object.entries(duration))("duration.%s matches its --duration-* in globals.css", (name, seconds) => {
    // GSAP counts in seconds, CSS here in milliseconds.
    expect(cssVariable(`duration-${name}`)).toBe(`${Math.round(seconds * 1000)}ms`);
  });

  test.each(Object.entries(ease))("ease.%s matches its --ease-* in globals.css", (name, { css: curve }) => {
    expect(withoutSpaces(cssVariable(`ease-${name}`))).toBe(withoutSpaces(curve));
  });

  test("durations grow from fast to reveal", () => {
    expect(duration.fast).toBeLessThan(duration.base);
    expect(duration.base).toBeLessThan(duration.slow);
    expect(duration.slow).toBeLessThan(duration.reveal);
  });

  test.each(Object.entries(ease))("ease.%s names an ease GSAP knows", (_name, { gsap: name }) => {
    expect(typeof gsap.parseEase(name)).toBe("function");
  });

  test("an ease GSAP doesn't know is caught", () => {
    // Proves the check above can fail: a typo gives no function.
    expect(typeof gsap.parseEase("power9.out")).not.toBe("function");
  });

  test("the media queries for gsap.matchMedia() are the reduced-motion ones", () => {
    expect(motionAllowed).toBe("(prefers-reduced-motion: no-preference)");
    expect(motionReduced).toBe("(prefers-reduced-motion: reduce)");
  });

  test("globals.css turns CSS motion off for visitors who ask for less", () => {
    const block = new RegExp(`@media\\s*${motionReduced.replace(/[()]/g, "\\$&")}\\s*\\{[^}]*\\}`).exec(css)?.[0];
    expect(block, "a @media (prefers-reduced-motion: reduce) block").toBeDefined();
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });
});
