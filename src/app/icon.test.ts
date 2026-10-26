import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

// The site icon (src/app/icon.svg): the brand's first letter on a tile. The
// letter is drawn as an outline, because browsers draw favicon text with
// whatever font they have, so a <text> letter looks different on each device.

const svg = readFileSync(new URL("./icon.svg", import.meta.url), "utf8");

describe("icon.svg", () => {
  test("is square", () => {
    const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1].trim().split(/\s+/).map(Number);
    expect(viewBox).toHaveLength(4);
    expect(viewBox?.[2]).toBeGreaterThan(0);
    expect(viewBox?.[2]).toBe(viewBox?.[3]);
  });

  test("draws the letter as a path, not as text", () => {
    expect(svg).toMatch(/<path\b/);
    expect(svg).not.toMatch(/<text\b/);
  });
});
