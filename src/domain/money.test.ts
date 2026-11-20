import { describe, expect, test } from "vitest";

import { parseRupees, PRICE_RULES } from "./money";

describe("parseRupees", () => {
  test.each([
    ["1500", 150_000],
    ["1,500", 150_000],
    ["₹1,500", 150_000],
    [" ₹ 1,23,456 ", 12_345_600],
    ["1", 100],
    ["10,00,000", 100_000_000],
    ["1000000", 100_000_000],
  ])("%j is %i paise", (typed, paise) => {
    expect(parseRupees(typed)).toEqual({ ok: true, paise });
  });

  test.each([
    ["", "blank"],
    ["   ", "blank"],
    ["₹", "blank"],
    ["abc", "not-a-number"],
    ["15OO", "not-a-number"],
    ["1,5,0,0x", "not-a-number"],
    ["-500", "not-a-number"],
    [",500", "not-a-number"],
    ["1,,500", "not-a-number"],
    ["1 500", "not-a-number"],
    ["१५००", "not-a-number"],
    ["1500.50", "not-whole"],
    ["1.500", "not-whole"],
    ["1500.", "not-whole"],
    ["0", "too-small"],
    ["000", "too-small"],
    ["1000001", "too-large"],
    ["99999999999999999999", "too-large"],
  ])("%j is refused: %s", (typed, problem) => {
    expect(parseRupees(typed)).toEqual({ ok: false, problem });
  });

  test("the limits are ₹1 and ₹10,00,000, in paise", () => {
    expect(PRICE_RULES).toEqual({ minPaise: 100, maxPaise: 100_000_000 });
  });
});
