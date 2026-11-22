import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { ReportName } from "@/domain/reports";
import type { Role } from "@/domain/roles";
import { renderWithIntl } from "@/i18n/test-utils";
import { getCurrentUser } from "@/server/auth/session";
import { readReportTable } from "@/server/dal/reports";
import messages from "../../../../../messages/en.json";

import AdminReportsPage from "./page";
import { ReportsGate } from "./reports-gate";

// The gate runs the real requirePermission; the session read and the report
// reads are stand-ins. The view is a stand-in too (its own test covers what
// it shows): here it reports what the gate passed it.
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/dal/reports", () => ({ readReportTable: vi.fn() }));
// Outside a Next.js request io() has nothing to wait for.
vi.mock("next/cache", () => ({ io: async () => {} }));
vi.mock("@/components/admin/reports-view", () => ({
  ReportsView: (props: { period: unknown; tables: { report: string }[] }) => (
    <p data-testid="view">{JSON.stringify({ period: props.period, reports: props.tables.map((table) => table.report) })}</p>
  ),
}));

/** Every message under a namespace, nested ones included. */
function wordsIn(namespace: object): string[] {
  return Object.values(namespace).flatMap((value) => (typeof value === "string" ? [value] : wordsIn(value as object)));
}

const userWith = (role: Role) => ({ id: "u1", phoneNumber: "+919876543210", role });

async function thrownBy(run: Promise<unknown>): Promise<unknown> {
  return run.then(
    () => "nothing thrown",
    (error: unknown) => error,
  );
}

// The same digests as src/server/auth/access.test.ts.
const TO_LOGIN = { digest: expect.stringMatching(/^NEXT_REDIRECT;replace;\/login\?session=ended;/) };
const NOT_FOUND = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };

const gateFor = (searchParams: Record<string, string | string[] | undefined>) =>
  ReportsGate({ locale: "en", searchParams: Promise.resolve(searchParams) });
const viewProps = () => JSON.parse(screen.getByTestId("view").textContent!);

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(readReportTable).mockReset();
  vi.mocked(readReportTable).mockImplementation(async (report: ReportName) => ({
    report,
    columns: [],
    rows: [],
    footer: [],
  }));
  // 21 Nov 2026, 18:30 UTC: already 00:00 on the 22nd in India.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-21T18:30:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ReportsGate (/admin/reports's gate)", () => {
  test("logged out (a leftover cookie): sent to /login?session=ended, nothing read", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await thrownBy(gateFor({}))).toMatchObject(TO_LOGIN);
    expect(readReportTable).not.toHaveBeenCalled();
  });

  test.each(["customer", "mechanic"] as const)("a %s: the 404 page, nothing read", async (role) => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith(role));
    expect(await thrownBy(gateFor({}))).toMatchObject(NOT_FOUND);
    expect(readReportTable).not.toHaveBeenCalled();
  });

  test("a manager with no query: the last 30 days ending today in India, all four reports", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("manager"));
    renderWithIntl(await gateFor({}));
    expect(viewProps()).toEqual({
      period: { from: "2026-10-24", to: "2026-11-22", preset: 30, note: null },
      reports: ["rating", "top-services", "workload", "bookings"],
    });
    expect(readReportTable).toHaveBeenCalledWith("bookings", expect.objectContaining({ to: "2026-11-22" }), "en");
  });

  test("an owner with a custom range gets it", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("owner"));
    renderWithIntl(await gateFor({ from: "2026-11-01", to: "2026-11-07" }));
    expect(viewProps().period).toEqual({ from: "2026-11-01", to: "2026-11-07", preset: null, note: null });
  });

  test("a reversed range: the default period with the reversed note", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("owner"));
    renderWithIntl(await gateFor({ from: "2026-11-07", to: "2026-11-01" }));
    expect(viewProps().period).toMatchObject({ preset: 30, note: "reversed" });
  });
});

describe("/admin/reports", () => {
  test("built ahead of time: only the neutral loading line, no heading and no report word", () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("owner"));
    const { container } = renderWithIntl(
      <AdminReportsPage params={Promise.resolve({ locale: "en" })} searchParams={new Promise(() => {})} />,
    );
    expect(screen.getByText(messages.Admin.loading)).toBeTruthy();
    expect(screen.queryByRole("heading")).toBeNull();
    for (const word of wordsIn(messages.AdminReports)) expect(container.textContent).not.toContain(word);
  });
});
