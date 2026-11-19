import { describe, expect, test } from "vitest";

import { normalizeTypedText, typedLength } from "./typed-text";

describe("normalizeTypedText", () => {
  test("trims, keeps line breaks, drops spaces at line ends and Windows line breaks", () => {
    expect(normalizeTypedText("  Squeal  \r\nOnly when cold \n\n")).toBe("Squeal\nOnly when cold");
  });

  test("drops NUL characters, which Postgres text can't hold", () => {
    expect(normalizeTypedText("Squeal\u0000 when cold")).toBe("Squeal when cold");
  });
});

test("typedLength counts characters, so an emoji counts once", () => {
  expect(typedLength("🚗🚗")).toBe(2);
  expect(typedLength("")).toBe(0);
});
