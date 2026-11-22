// GET /admin/reports/export?report=bookings&from=2026-11-01&to=2026-11-07:
// one staff report as a CSV file (task 41), the same table the page shows.
//
// The first Route Handler that reads the session. It gives every answer
// itself (plan KTD7):
// - Logged out: the proxy already sent a 307 to /login (the path is under
//   /admin). A leftover cookie without a session, a customer, a mechanic,
//   an unknown report or language all get a plain 404, with no body. Never
//   requirePermission here: its notFound() would send the HTML 404 page as
//   the "file".
// - Only AccessDeniedError is caught; anything else is a real error.
// - The file holds totals only: no customer's name, phone, plate or booking
//   code (owner, 2026-11-22). Mechanics' names appear in the workload file.
// - Reading the session and the query keeps it at request time under Cache
//   Components (node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md).

import "server-only";

import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { io } from "next/cache";
import type { NextRequest } from "next/server";

import { indiaDateOf } from "@/domain/india-time";
import { pickReportPeriod } from "@/domain/report-period";
import { isReportName, tableToCsvRows } from "@/domain/reports";
import { routing } from "@/i18n/routing";
import { systemClock } from "@/lib/clock";
import { toCsv } from "@/lib/csv";
import { AccessDeniedError, authorize } from "@/server/auth/access";
import { readReportTable } from "@/server/dal/reports";

// A staff file: never kept by a browser or a proxy, never sniffed as another type.
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

function notFound(): Response {
  return new Response(null, { status: 404, headers: PRIVATE_HEADERS });
}

export async function GET(request: NextRequest, { params }: RouteContext<"/[locale]/admin/reports/export">): Promise<Response> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return notFound();
  try {
    await authorize("reports.view");
  } catch (error) {
    if (error instanceof AccessDeniedError) return notFound();
    throw error;
  }

  const query = request.nextUrl.searchParams;
  const report = query.get("report");
  if (!isReportName(report)) return notFound();

  await io();
  const today = indiaDateOf(systemClock.now());
  // A period that falls back still downloads, for the fallback dates (the file name says which).
  const period = pickReportPeriod(
    { days: query.get("days") ?? undefined, from: query.get("from") ?? undefined, to: query.get("to") ?? undefined },
    today,
  );
  const table = await readReportTable(report, period, locale);
  if (table === null) throw new Error("A report read refused a period pickReportPeriod chose");

  const t = await getTranslations({ locale, namespace: "AdminReports" });
  const csv = toCsv(
    tableToCsvRows(
      table,
      (column) => t(`columns.${column}`),
      (label) => t(`labels.${label}`),
    ),
  );
  return new Response(csv, {
    status: 200,
    headers: {
      ...PRIVATE_HEADERS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report}-${period.from}-to-${period.to}.csv"`,
    },
  });
}
