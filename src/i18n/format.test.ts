import { afterEach, describe, expect, test } from "vitest";

import { formatDate, formatRupees, formatTime } from "./format";

// The expected strings below were copied from a real run of Node 24's Intl,
// not typed from memory.

describe("formatRupees (money is stored as integer paise)", () => {
  test("Indian digit grouping", () => {
    expect(formatRupees(12_345_600, "en")).toBe("₹1,23,456");
  });

  test("one crore", () => {
    expect(formatRupees(1_000_000_000, "en")).toBe("₹1,00,00,000");
  });

  test("shows paise only when there are some", () => {
    expect(formatRupees(49_950, "en")).toBe("₹499.50");
    expect(formatRupees(100, "en")).toBe("₹1");
    expect(formatRupees(0, "en")).toBe("₹0");
  });

  test("negative amounts (for discounts)", () => {
    expect(formatRupees(-10_000, "en")).toBe("-₹100");
  });

  test("minus zero (say, a zero discount negated) shows as ₹0", () => {
    expect(formatRupees(-0, "en")).toBe("₹0");
  });

  test.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])(
    "rejects %s: paise must be a safe whole number",
    (value) => {
      expect(() => formatRupees(value, "en")).toThrow(RangeError);
    },
  );
});

describe("formatDate and formatTime (always India time)", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    // Setting process.env.TZ = undefined would store the text "undefined".
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  test("a UTC evening is already the next day in India", () => {
    // 20:00 UTC on 25 Oct = 01:30 IST on 26 Oct
    expect(formatDate(new Date("2026-10-25T20:00:00Z"), "en")).toBe("26 Oct 2026");
  });

  test("the last second of a day in India", () => {
    // 18:29:59 UTC = 23:59:59 IST
    expect(formatDate(new Date("2026-10-25T18:29:59Z"), "en")).toBe("25 Oct 2026");
  });

  test("times in 12-hour India time", () => {
    expect(formatTime(new Date("2026-10-25T04:30:00Z"), "en")).toBe("10:00 am");
    expect(formatTime(new Date("2026-10-25T12:45:00Z"), "en")).toBe("6:15 pm");
  });

  test("the result doesn't depend on the computer's own time zone", () => {
    process.env.TZ = "America/Los_Angeles";
    expect(formatDate(new Date("2026-10-25T20:00:00Z"), "en")).toBe("26 Oct 2026");
    expect(formatTime(new Date("2026-10-25T04:30:00Z"), "en")).toBe("10:00 am");
  });

  test("rejects an invalid date", () => {
    expect(() => formatDate(new Date("not a date"), "en")).toThrow(RangeError);
    expect(() => formatTime(new Date("not a date"), "en")).toThrow(RangeError);
  });
});
