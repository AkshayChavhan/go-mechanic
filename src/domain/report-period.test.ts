import { describe, expect, test } from "vitest";

import { checkReportRange, daysInPeriod, periodWindow, pickReportPeriod, reportQuery } from "./report-period";

const today = "2026-11-22";

describe("pickReportPeriod", () => {
  test("no query: the last 30 days, no note", () => {
    expect(pickReportPeriod({}, today)).toEqual({ from: "2026-10-24", to: today, preset: 30, note: null });
  });

  test.each([
    ["7", "2026-11-16"],
    ["30", "2026-10-24"],
    ["90", "2026-08-25"],
  ])("?days=%s ends today and starts on %s", (days, from) => {
    expect(pickReportPeriod({ days }, today)).toEqual({ from, to: today, preset: Number(days), note: null });
  });

  test.each([["8"], ["abc"], [["7", "30"]]])("?days=%j: the default with the unreadable note", (days) => {
    expect(pickReportPeriod({ days }, today)).toEqual({ from: "2026-10-24", to: today, preset: 30, note: "unreadable" });
  });

  test("a custom range", () => {
    expect(pickReportPeriod({ from: "2026-11-01", to: "2026-11-10" }, today)).toEqual({
      from: "2026-11-01",
      to: "2026-11-10",
      preset: null,
      note: null,
    });
  });

  test("a custom range wins over days", () => {
    expect(pickReportPeriod({ days: "7", from: "2026-11-01", to: "2026-11-02" }, today).preset).toBeNull();
  });

  test("a future end is fine: bookings sit ahead", () => {
    expect(pickReportPeriod({ from: "2026-11-22", to: "2027-01-10" }, today).to).toBe("2027-01-10");
  });

  test.each([
    [{ from: "2026-11-10", to: "2026-11-01" }, "reversed"],
    [{ from: "2026-11-01" }, "unreadable"],
    [{ to: "2026-11-01" }, "unreadable"],
    [{ from: "2026-02-30", to: "2026-03-01" }, "unreadable"],
    [{ from: ["2026-11-01", "2026-11-02"], to: "2026-11-03" }, "unreadable"],
    [{ from: "2025-01-01", to: "2026-01-02" }, "too-long"],
  ] as [Parameters<typeof pickReportPeriod>[0], string][])("%j: the default with the %s note", (query, note) => {
    const period = pickReportPeriod(query, today);
    expect(period).toEqual({ from: "2026-10-24", to: today, preset: 30, note });
  });

  test("366 days is the longest range allowed", () => {
    expect(pickReportPeriod({ from: "2025-01-01", to: "2026-01-01" }, today).note).toBeNull();
  });
});

describe("checkReportRange", () => {
  test("accepts a real range and refuses anything else", () => {
    expect(checkReportRange("2026-11-01", "2026-11-01")).toEqual({ ok: true, from: "2026-11-01", to: "2026-11-01" });
    expect(checkReportRange(42, "2026-11-01")).toEqual({ ok: false, problem: "unreadable" });
  });
});

test("daysInPeriod counts both ends, across a month and a DST-free year end", () => {
  expect(daysInPeriod("2026-11-01", "2026-11-07")).toBe(7);
  expect(daysInPeriod("2026-12-31", "2027-01-01")).toBe(2);
});

test("reportQuery always writes the resolved dates, never days", () => {
  expect(reportQuery(pickReportPeriod({ days: "7" }, today))).toEqual({ from: "2026-11-16", to: today });
});

test("periodWindow runs from India midnight on the first day to India midnight after the last", () => {
  const { start, end } = periodWindow({ from: "2026-11-01", to: "2026-11-07" });
  expect(start.toISOString()).toBe("2026-10-31T18:30:00.000Z");
  expect(end.toISOString()).toBe("2026-11-07T18:30:00.000Z");
});
