import { describe, expect, test } from "vitest";

import {
  bookingsTable,
  isReportName,
  ratingTable,
  tableToCsvRows,
  topServicesTable,
  workloadTable,
} from "./reports";

const n = (value: number) => ({ kind: "number", value });

describe("bookingsTable", () => {
  test("groups by the slot's India day: 18:29:59Z is the earlier day, 18:30Z the next", () => {
    const table = bookingsTable([
      { startsAt: new Date("2026-11-20T18:29:59Z"), status: "booked" },
      { startsAt: new Date("2026-11-20T18:30:00Z"), status: "confirmed" },
    ]);
    expect(table.rows.map((row) => row[0])).toEqual([
      { kind: "date", value: "2026-11-20" },
      { kind: "date", value: "2026-11-21" },
    ]);
  });

  test("counts each status per day, oldest day first, with a totals row", () => {
    const table = bookingsTable([
      { startsAt: new Date("2026-11-21T05:00:00Z"), status: "cancelled" },
      { startsAt: new Date("2026-11-19T05:00:00Z"), status: "booked" },
      { startsAt: new Date("2026-11-21T06:00:00Z"), status: "no-show" },
      { startsAt: new Date("2026-11-21T07:00:00Z"), status: "booked" },
    ]);
    expect(table.columns).toEqual(["day", "booked", "confirmed", "cancelled", "no-show", "total"]);
    expect(table.rows).toEqual([
      [{ kind: "date", value: "2026-11-19" }, n(1), n(0), n(0), n(0), n(1)],
      [{ kind: "date", value: "2026-11-21" }, n(1), n(0), n(1), n(1), n(3)],
    ]);
    expect(table.footer).toEqual([[{ kind: "label", value: "total" }, n(2), n(0), n(1), n(1), n(4)]]);
  });

  test("no bookings: no rows and no totals", () => {
    expect(bookingsTable([])).toMatchObject({ rows: [], footer: [] });
  });
});

test("topServicesTable: most booked first, a tie by name", () => {
  const table = topServicesTable([
    { name: "Wash", bookings: 2 },
    { name: "Brakes", bookings: 5 },
    { name: "AC service", bookings: 2 },
  ]);
  expect(table.rows.map((row) => row[0])).toEqual([
    { kind: "text", value: "Brakes" },
    { kind: "text", value: "AC service" },
    { kind: "text", value: "Wash" },
  ]);
});

describe("ratingTable", () => {
  test("rows run from 5 stars down to 1, then the total and the average", () => {
    const table = ratingTable([
      { rating: 4, count: 1 },
      { rating: 5, count: 1 },
    ]);
    expect(table.rows).toEqual([
      [n(5), n(1)],
      [n(4), n(1)],
      [n(3), n(0)],
      [n(2), n(0)],
      [n(1), n(0)],
    ]);
    expect(table.footer).toEqual([
      [{ kind: "label", value: "total" }, n(2)],
      [{ kind: "label", value: "average" }, { kind: "average", value: 4.5 }],
    ]);
  });

  test("no reviews: an empty report", () => {
    expect(ratingTable([])).toMatchObject({ rows: [], footer: [] });
  });
});

describe("workloadTable", () => {
  test("most bookings first, an empty name gets the unnamed label, unassigned last", () => {
    const table = workloadTable([
      { mechanicId: null, name: null, bookings: 9, completed: 0 },
      { mechanicId: "a", name: "Ravi", bookings: 2, completed: 1 },
      { mechanicId: "b", name: " ", bookings: 3, completed: 3 },
    ]);
    expect(table.rows).toEqual([
      [{ kind: "label", value: "unnamed" }, n(3), n(3)],
      [{ kind: "text", value: "Ravi" }, n(2), n(1)],
      [{ kind: "label", value: "unassigned" }, n(9), n(0)],
    ]);
  });
});

test("tableToCsvRows: headings, rows and footer as plain values", () => {
  const table = ratingTable([{ rating: 3, count: 2 }]);
  const rows = tableToCsvRows(
    table,
    (column) => column.toUpperCase(),
    (label) => `<${label}>`,
  );
  expect(rows[0]).toEqual(["STARS", "REVIEWS"]);
  expect(rows.at(-2)).toEqual(["<total>", 2]);
  expect(rows.at(-1)).toEqual(["<average>", 3]);
  expect(tableToCsvRows(bookingsTable([{ startsAt: new Date("2026-11-21T05:00:00Z"), status: "booked" }]), String, String)[1]![0]).toBe(
    "2026-11-21",
  );
});

test("isReportName", () => {
  expect(isReportName("workload")).toBe(true);
  expect(isReportName("users")).toBe(false);
  expect(isReportName(undefined)).toBe(false);
});
