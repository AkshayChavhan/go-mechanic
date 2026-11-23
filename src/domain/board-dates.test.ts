import { describe, expect, test } from "vitest";

import {
  BOARD_NOTICES,
  BOARD_RANGE_DAYS,
  BOARD_REFUSAL_NOTICES,
  boardQuery,
  checkBoardView,
  isOnBoard,
  isRefusalNotice,
  parseBoardNotice,
  parseShowCancelled,
  pickBoardDate,
} from "./board-dates";

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

describe("parseShowCancelled (the board's cancelled filter)", () => {
  test("only ?cancelled=show shows cancelled bookings", () => {
    expect(parseShowCancelled("show")).toBe(true);
    for (const value of [undefined, "", "1", "true", "SHOW", ["show", "show"]]) expect(parseShowCancelled(value)).toBe(false);
  });
});

describe("parseBoardNotice (the notice after a board action)", () => {
  test("a known notice with a well-formed booking code", () => {
    expect(parseBoardNotice("cancelled", "K7Q4MX")).toEqual({ notice: "cancelled", code: "K7Q4MX" });
    expect(parseBoardNotice("reason-too-short", "PZ3H8T")).toEqual({ notice: "reason-too-short", code: "PZ3H8T" });
    // The Job step control's notices (task 33).
    expect(parseBoardNotice("job-moved", "K7Q4MX")).toEqual({ notice: "job-moved", code: "K7Q4MX" });
    expect(parseBoardNotice("job-step-changed", "K7Q4MX")).toEqual({ notice: "job-step-changed", code: "K7Q4MX" });
  });

  test.each([
    ["an unknown notice", "deleted", "K7Q4MX"],
    ["no notice", undefined, "K7Q4MX"],
    ["no code", "confirmed", undefined],
    ["a code with a letter the alphabet leaves out (O)", "confirmed", "K7Q4MO"],
    ["a dashed code", "confirmed", "K7Q-4MX"],
    ["a short code", "confirmed", "K7Q4M"],
    ["a lower-case code", "confirmed", "k7q4mx"],
    ["several notices", ["confirmed", "cancelled"], "K7Q4MX"],
    ["a name of Object.prototype", "toString", "K7Q4MX"],
  ])("%s gives no notice", (_, notice, code) => {
    expect(parseBoardNotice(notice, code)).toBeNull();
  });

  test("refusals are told apart from successes", () => {
    expect(isRefusalNotice("changed")).toBe(true);
    expect(isRefusalNotice("reason-too-long")).toBe(true);
    expect(isRefusalNotice("confirmed")).toBe(false);
    expect(isRefusalNotice("unchanged")).toBe(false);
    expect(isRefusalNotice("job-moved")).toBe(false);
    expect(isRefusalNotice("job-step-changed")).toBe(true);
    // Every notice is one or the other, never both.
    for (const notice of BOARD_NOTICES) expect(BOARD_REFUSAL_NOTICES.includes(notice as never)).toBe(isRefusalNotice(notice));
  });
});

describe("checkBoardView (the view a board action was bound to, checked again)", () => {
  test("a real date and the filter on", () => {
    expect(checkBoardView({ date: "2026-11-20", showCancelled: true })).toEqual({ date: "2026-11-20", showCancelled: true });
  });

  test.each([
    ["nothing", undefined],
    ["a string", "2026-11-20"],
    ["an unreadable date", { date: "2026-02-30", showCancelled: "yes" }],
    ["a number for the date", { date: 20261120, showCancelled: 1 }],
  ])("%s gives no date and the filter off", (_, value) => {
    expect(checkBoardView(value)).toEqual({ date: null, showCancelled: false });
  });
});

describe("boardQuery (the board's address for a view)", () => {
  test("the date, and cancelled=show only when the filter is on", () => {
    expect(boardQuery({ date: "2026-11-20", showCancelled: false })).toEqual({ date: "2026-11-20" });
    expect(boardQuery({ date: "2026-11-20", showCancelled: true })).toEqual({ date: "2026-11-20", cancelled: "show" });
    expect(boardQuery({ date: null, showCancelled: true })).toEqual({ cancelled: "show" });
    expect(boardQuery({ date: null, showCancelled: false })).toEqual({});
  });
});
