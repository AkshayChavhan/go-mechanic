import { describe, expect, test } from "vitest";

import { BOARD_RANGE_DAYS, isOnBoard, pickBoardDate } from "./board-dates";

const today = "2026-11-19";

describe("pickBoardDate (which day the bookings board shows)", () => {
  test("a real date within a year gives itself, with no note", () => {
    expect(pickBoardDate("2026-11-20", today)).toEqual({ date: "2026-11-20", note: false });
  });

  test("no value (the first visit) gives today, with no note", () => {
    expect(pickBoardDate(undefined, today)).toEqual({ date: today, note: false });
  });

  test.each([
    ["an array (?date=a&date=b)", ["2026-11-20", "2026-11-21"]],
    ["an empty field", ""],
    ["a day that doesn't exist", "2026-02-30"],
    ["not a date", "tomorrow"],
    ["400 days ahead", "2027-12-24"],
    ["400 days back", "2025-10-15"],
  ])("%s gives today, with the note", (_, value) => {
    expect(pickBoardDate(value, today)).toEqual({ date: today, note: true });
  });

  test("the range is 366 days either way, both ends included", () => {
    expect(BOARD_RANGE_DAYS).toBe(366);
    expect(pickBoardDate("2027-11-20", today)).toEqual({ date: "2027-11-20", note: false });
    expect(pickBoardDate("2027-11-21", today).note).toBe(true);
    expect(pickBoardDate("2025-11-18", today)).toEqual({ date: "2025-11-18", note: false });
    expect(pickBoardDate("2025-11-17", today).note).toBe(true);
  });
});

describe("isOnBoard", () => {
  test("counts calendar days, across a month and a year end", () => {
    expect(isOnBoard("2027-11-20", today)).toBe(true);
    expect(isOnBoard("2027-11-21", today)).toBe(false);
    expect(isOnBoard("2025-11-18", today)).toBe(true);
    expect(isOnBoard("2025-11-17", today)).toBe(false);
  });
});
