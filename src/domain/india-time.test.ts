import { describe, expect, test } from "vitest";

import { addDays, indiaDateOf, indiaInstantOn, weekdayIndexOf } from "./india-time";

// Every instant below is written in UTC (the "Z" at the end), with the India
// time it stands for in a comment. India is 5 hours 30 minutes ahead of UTC.
// 26 Oct 2026 is a Monday.

describe("the test setup", () => {
  test("runs in UTC (vitest.config.mts), so a computer set to India time can't hide a bug", () => {
    expect(process.env.TZ).toBe("UTC");
  });
});

describe("indiaDateOf (the date on India's calendar at a moment)", () => {
  test.each([
    // 23:59 India time on 28 Oct: still the 28th in India, and in UTC.
    ["2026-10-28T18:29:00Z", "2026-10-28"],
    // 00:00 India time on 29 Oct, while UTC still says the 28th.
    ["2026-10-28T18:30:00Z", "2026-10-29"],
    // 05:29 India time on 29 Oct: UTC still says the 28th.
    ["2026-10-28T23:59:59Z", "2026-10-29"],
    // 00:00 India time on 1 Jan 2027: a new year in India first.
    ["2026-12-31T18:30:00Z", "2027-01-01"],
  ])("at %s it's %s in India", (instant, date) => {
    expect(indiaDateOf(new Date(instant))).toBe(date);
  });
});

describe("addDays", () => {
  test.each([
    ["2026-10-29", 1, "2026-10-30"],
    ["2026-10-31", 1, "2026-11-01"],
    ["2026-12-31", 1, "2027-01-01"],
    // 2028 is a leap year; 2027 isn't.
    ["2028-02-28", 1, "2028-02-29"],
    ["2027-02-28", 1, "2027-03-01"],
    ["2026-11-01", -1, "2026-10-31"],
    ["2026-10-28", 7, "2026-11-04"],
  ])("%s plus %i days is %s", (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
  });
});

describe("weekdayIndexOf (Monday = 0 ... Sunday = 6)", () => {
  test.each([
    ["2026-10-26", 0], // Monday
    ["2026-10-28", 2], // Wednesday
    ["2026-11-01", 6], // Sunday
    ["2027-01-01", 4], // Friday
  ])("%s is weekday %i", (date, index) => {
    expect(weekdayIndexOf(date)).toBe(index);
  });
});

describe("indiaInstantOn (the moment India's clock shows a time on a date)", () => {
  test("10:00 on 29 Oct in India is 04:30 UTC", () => {
    expect(indiaInstantOn("2026-10-29", 600).toISOString()).toBe("2026-10-29T04:30:00.000Z");
  });

  test("midnight on 1 Jan 2027 in India is 18:30 UTC on 31 Dec", () => {
    expect(indiaInstantOn("2027-01-01", 0).toISOString()).toBe("2026-12-31T18:30:00.000Z");
  });

  test("gives back the same India date it was given", () => {
    for (const date of ["2026-10-29", "2027-01-01", "2028-02-29"]) {
      expect(indiaDateOf(indiaInstantOn(date, 0))).toBe(date);
      expect(indiaDateOf(indiaInstantOn(date, 23 * 60 + 59))).toBe(date);
    }
  });
});
