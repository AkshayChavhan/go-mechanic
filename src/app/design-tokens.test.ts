import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { contrastRatio } from "@/lib/color-contrast";

// Checks the colour tokens in globals.css: every text colour is readable on
// the surfaces it sits on (WCAG AA), in each of the three surface tones.
// The values are read from the real file, so changing a colour re-runs the maths.

// Comments removed, so a commented-out token never counts.
const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

// The custom properties declared in top-level blocks (starting at the beginning
// of a line) with exactly this selector, without their "--".
function declarations(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const result: Record<string, string> = {};
  for (const [, body] of css.matchAll(new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, "gm"))) {
    for (const [, name, value] of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) result[name] = value.trim();
  }
  return result;
}

// Each tone is the white page (:root) plus the variables its class changes.
const root = declarations(":root");
const greyOverrides = declarations(".surface-grey");
const darkOverrides = declarations(".dark");
const tones = {
  white: root,
  grey: { ...root, ...greyOverrides },
  dark: { ...root, ...darkOverrides },
};

// [text, surface] pairs that need 4.5:1 (WCAG 1.4.3, normal-size text).
const textPairs: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["foreground", "muted"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["primary-foreground", "primary-hover"],
  ["secondary-foreground", "secondary"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["destructive", "background"],
  ["destructive", "card"],
  ["link", "background"],
  ["link", "card"],
  ["success", "background"],
  ["success", "card"],
  ["success-foreground", "success"],
];

// [line, surface] pairs that need 3:1 (WCAG 1.4.11): a field's border shows
// where the field is, and the focus outline shows where the keyboard is.
const linePairs: [string, string][] = [
  ["input", "background"],
  ["input", "card"],
  ["input", "muted"],
  ["ring", "background"],
  ["ring", "card"],
  ["ring", "muted"],
];

// Every variable shadcn components read, plus our own colour tokens.
const requiredTokens = [
  ...["background", "foreground", "card", "card-foreground", "popover", "popover-foreground"],
  ...["primary", "primary-foreground", "secondary", "secondary-foreground", "muted", "muted-foreground"],
  ...["accent", "accent-foreground", "destructive", "border", "input", "ring"],
  ...["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"],
  ...["sidebar", "sidebar-foreground", "sidebar-primary", "sidebar-primary-foreground"],
  ...["sidebar-accent", "sidebar-accent-foreground", "sidebar-border", "sidebar-ring"],
  ...["primary-hover", "success", "success-foreground", "link"],
];

const checkedTokens = [...new Set([...textPairs, ...linePairs].flat())];

describe("colour tokens in globals.css", () => {
  test("the grey band and the black showcase each change the page colour", () => {
    // Otherwise a missing or renamed block would make every tone "white".
    expect(greyOverrides.background).toBeDefined();
    expect(darkOverrides.background).toBeDefined();
  });

  test.each(requiredTokens)("--%s is defined on :root", (token) => {
    expect(root[token]).toBeDefined();
  });

  // Registration is what creates the bg-*, text-* and border-* classes.
  test.each(requiredTokens)("--%s is registered in @theme inline", (token) => {
    expect(css).toMatch(new RegExp(`--color-${token}:\\s*var\\(--${token}\\);`));
  });

  describe.each(Object.entries(tones))("%s tone", (_tone, tokens) => {
    test.each(checkedTokens)("--%s is a hex colour", (token) => {
      // An OKLCH leftover would otherwise skip the contrast maths.
      expect(tokens[token]).toMatch(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    });

    test.each(textPairs)("--%s on --%s reaches 4.5:1", (text, surface) => {
      const ratio = contrastRatio(tokens[text], tokens[surface]);
      expect(ratio, `${tokens[text]} on ${tokens[surface]} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    });

    test.each(linePairs)("--%s on --%s reaches 3:1", (line, surface) => {
      const ratio = contrastRatio(tokens[line], tokens[surface]);
      expect(ratio, `${tokens[line]} on ${tokens[surface]} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    });
  });
});
