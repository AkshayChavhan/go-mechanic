import { describe, expect, test } from "vitest";

import { blend, contrastRatio } from "@/lib/color-contrast";

describe("contrastRatio (WCAG 2.2)", () => {
  test("black on white is 21:1, in either order", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });

  test("a colour on itself is 1:1", () => {
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
  });

  test("#777777 on white is about 4.48:1, just under the 4.5:1 AA line", () => {
    // A well-known value, so a wrong formula can't pass by luck.
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });

  test("short hex works like long hex, in any letter case", () => {
    expect(contrastRatio("#fff", "#0071e3")).toBe(contrastRatio("#ffffff", "#0071e3"));
    expect(contrastRatio("#FFFFFF", "#0071E3")).toBe(contrastRatio("#ffffff", "#0071e3"));
  });

  test.each(["red", "#12", "#gggggg", "#ffff", "ffffff", "oklch(1 0 0)", ""])("rejects %j", (color) => {
    expect(() => contrastRatio(color, "#ffffff")).toThrow();
    expect(() => contrastRatio("#ffffff", color)).toThrow();
  });
});

describe("blend (a see-through colour over a backdrop)", () => {
  test("half-transparent black on white is mid grey", () => {
    expect(blend("#000000", 0.5, "#ffffff")).toBe("#808080");
  });

  test("fully opaque shows the colour, fully transparent shows the backdrop", () => {
    expect(blend("#0071e3", 1, "#ffffff")).toBe("#0071e3");
    expect(blend("#0071e3", 0, "#f5f5f7")).toBe("#f5f5f7");
  });

  test.each([-0.1, 1.1, Number.NaN])("rejects opacity %s", (opacity) => {
    expect(() => blend("#000000", opacity, "#ffffff")).toThrow();
  });
});
