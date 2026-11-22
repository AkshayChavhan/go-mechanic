import { screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import type { ReportPeriod } from "@/domain/report-period";
import { bookingsTable, ratingTable, topServicesTable, workloadTable } from "@/domain/reports";
import { renderWithIntl } from "@/i18n/test-utils";
import messages from "../../../messages/en.json";

import { ReportsView } from "./reports-view";

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../messages/en.json");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "AdminReports" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const t = messages.AdminReports;
const last30: ReportPeriod = { from: "2026-10-24", to: "2026-11-22", preset: 30, note: null };

const full = [
  ratingTable([{ rating: 5, count: 2 }, { rating: 4, count: 1 }]),
  topServicesTable([{ name: "Brakes", bookings: 3 }]),
  workloadTable([
    { mechanicId: "m1", name: "Ravi", bookings: 2, completed: 1 },
    { mechanicId: "m2", name: "", bookings: 1, completed: 0 },
    { mechanicId: null, name: null, bookings: 4, completed: 0 },
  ]),
  bookingsTable([
    { startsAt: new Date("2026-11-20T05:00:00Z"), status: "booked" },
    { startsAt: new Date("2026-11-20T06:00:00Z"), status: "cancelled" },
  ]),
];
const empty = [ratingTable([]), topServicesTable([]), workloadTable([]), bookingsTable([])];

/** A report's block, found by its heading. */
const blockFor = (title: string) => screen.getByRole("heading", { level: 2, name: title }).closest("section")!;

async function view(period: ReportPeriod = last30, tables = full) {
  return renderWithIntl(await ReportsView({ locale: "en", period, tables }));
}

describe("ReportsView", () => {
  test("the heading and the dates it covers, with no note", async () => {
    await view();
    expect(screen.getByRole("heading", { level: 1, name: t.heading })).toBeTruthy();
    expect(screen.getByText(/24 Oct 2026 to 22 Nov 2026/)).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  test.each(["unreadable", "reversed", "too-long"] as const)("the %s note says why the default is shown", async (note) => {
    await view({ ...last30, note });
    // The numbers come from the code (REPORT_DEFAULT_DAYS, REPORT_MAX_DAYS), never typed into the message.
    expect(screen.getByRole("status").textContent).toBe(t.notes[note].replace("{days}", "30").replace("{max}", "366"));
  });

  test("the presets link with ?days=, the current one marked", async () => {
    await view();
    const presets = screen.getByRole("navigation", { name: t.periodLabel });
    const links = within(presets).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/admin/reports?days=7",
      "/admin/reports?days=30",
      "/admin/reports?days=90",
    ]);
    expect(within(presets).getByRole("link", { name: t.presets.last30 }).getAttribute("aria-current")).toBe("page");
    expect(within(presets).getByRole("link", { name: t.presets.last7 }).getAttribute("aria-current")).toBeNull();
  });

  test("the date form is a GET to /admin/reports, prefilled with the dates shown", async () => {
    await view({ from: "2026-11-01", to: "2026-11-07", preset: null, note: null });
    const form = screen.getByRole("form", { name: t.custom.legend });
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/admin/reports");
    expect((screen.getByLabelText(t.custom.from) as HTMLInputElement).value).toBe("2026-11-01");
    expect((screen.getByLabelText(t.custom.to) as HTMLInputElement).value).toBe("2026-11-07");
  });

  test("each report has its heading, its description and a CSV link with the resolved dates; bookings last", async () => {
    await view({ ...last30 });
    const sections = [...document.querySelectorAll("section")];
    expect(sections.map((section) => within(section).getByRole("heading", { level: 2 }).textContent)).toEqual([
      t.reports.rating.title,
      t.reports["top-services"].title,
      t.reports.workload.title,
      t.reports.bookings.title,
    ]);
    const bookings = sections.at(-1)!;
    expect(within(bookings).getByText(t.reports.bookings.description)).toBeTruthy();
    expect(within(bookings).getByRole("link", { name: "Download Bookings (CSV)" }).getAttribute("href")).toBe(
      "/admin/reports/export?report=bookings&from=2026-10-24&to=2026-11-22",
    );
  });

  test("tables: a focusable scroll box named by the caption, row headings, and the totals in tfoot", async () => {
    await view();
    const box = within(blockFor(t.reports.bookings.title)).getByRole("region", { name: t.reports.bookings.title });
    expect(box.getAttribute("tabindex")).toBe("0");
    const table = within(box).getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Day",
      "Booked",
      "Confirmed",
      "Cancelled",
      "No-show",
      "Total",
    ]);
    expect(within(table).getByRole("rowheader", { name: "20 Nov 2026" })).toBeTruthy();
    const footer = table.querySelector("tfoot")!;
    expect(footer.textContent).toBe("Total10102");
  });

  test("workload shows names, the unnamed label and Unassigned; rating ends with its average", async () => {
    await view();
    const workload = blockFor(t.reports.workload.title);
    const names = within(workload).getAllByRole("rowheader").map((cell) => cell.textContent);
    expect(names).toEqual(["Ravi", t.labels.unnamed, t.labels.unassigned]);
    const rating = blockFor(t.reports.rating.title);
    expect(rating.querySelector("tfoot")!.textContent).toBe("Total3Average4.7");
  });

  test("an empty period: each report says so, with no table and no CSV link", async () => {
    await view(last30, empty);
    expect(screen.getAllByText(t.empty)).toHaveLength(4);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("link", { name: /CSV/ })).toBeNull();
  });
});
