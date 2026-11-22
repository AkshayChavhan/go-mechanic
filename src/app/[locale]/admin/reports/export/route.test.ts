import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { bookingsTable, type ReportName, topServicesTable, workloadTable } from "@/domain/reports";
import type { Role } from "@/domain/roles";
import { getCurrentUser } from "@/server/auth/session";
import { readReportTable } from "@/server/dal/reports";

import { GET } from "./route";

// The handler runs the real authorize and table-to-CSV code; the session and
// the report reads are stand-ins (the reads have their own PGlite tests).
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/dal/reports", () => ({ readReportTable: vi.fn() }));
vi.mock("next/cache", () => ({ io: async () => {} }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../../../messages/en.json");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "AdminReports" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const userWith = (role: Role) => ({ id: "u1", phoneNumber: "+919876543210", role });

const tables = {
  bookings: bookingsTable([{ startsAt: new Date("2026-11-02T05:00:00Z"), status: "booked" }]),
  "top-services": topServicesTable([{ name: "=HYPERLINK(\"http://x\")", bookings: 2 }]),
  workload: workloadTable([{ mechanicId: "m1", name: "Ravi Kumar", bookings: 2, completed: 1 }]),
} as const;

function get(query: string, locale = "en") {
  return GET(new NextRequest(`http://localhost/admin/reports/export?${query}`), {
    params: Promise.resolve({ locale }),
  });
}

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(readReportTable).mockReset();
  vi.mocked(readReportTable).mockImplementation(async (report: ReportName) =>
    report === "rating" ? null : tables[report],
  );
});

describe("GET /admin/reports/export", () => {
  test.each([
    ["logged out (a leftover cookie)", null],
    ["a customer", userWith("customer")],
    ["a mechanic", userWith("mechanic")],
  ])("%s: a plain 404, nothing read", async (_label, user) => {
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    const response = await get("report=bookings&from=2026-11-01&to=2026-11-07");
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(readReportTable).not.toHaveBeenCalled();
  });

  test.each([["report=users"], [""]])("an unknown report (%j): 404", async (query) => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("owner"));
    expect((await get(query)).status).toBe(404);
  });

  test("an unknown language: 404", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("owner"));
    expect((await get("report=bookings", "xx")).status).toBe(404);
  });

  test("the owner gets the bookings CSV for the dates asked, as a private download", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("owner"));
    const response = await get("report=bookings&from=2026-11-01&to=2026-11-07");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="bookings-2026-11-01-to-2026-11-07.csv"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(readReportTable).toHaveBeenCalledWith(
      "bookings",
      { from: "2026-11-01", to: "2026-11-07", preset: null, note: null },
      "en",
    );
    const body = new TextDecoder("utf-8", { ignoreBOM: true }).decode(await response.arrayBuffer());
    expect(body.startsWith("﻿")).toBe(true);
    expect(body).toBe(
      '﻿"Day","Booked","Confirmed","Cancelled","No-show","Total"\r\n"2026-11-02",1,0,0,0,1\r\n"Total",1,0,0,0,1\r\n',
    );
  });

  test("a manager's workload CSV names the mechanic; top services can't run a formula", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("manager"));
    expect(await (await get("report=workload&days=7")).text()).toContain('"Ravi Kumar",2,1');
    expect(await (await get("report=top-services&days=7")).text()).toContain('"\'=HYPERLINK(""http://x"")",2');
  });

  test("no file carries a phone number", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("owner"));
    for (const report of ["bookings", "top-services", "workload"]) {
      const body = await (await get(`report=${report}`)).text();
      expect(body).not.toMatch(/\+91|\d{10}/);
    }
  });
});
