import { io } from "next/cache";

import { ReportsView } from "@/components/admin/reports-view";
import { indiaDateOf } from "@/domain/india-time";
import { pickReportPeriod } from "@/domain/report-period";
import { REPORT_NAMES, type ReportTable } from "@/domain/reports";
import type { Locale } from "@/i18n/config";
import { systemClock } from "@/lib/clock";
import { requirePermission } from "@/server/auth/access";
import { readReportTable } from "@/server/dal/reports";

type ReportsGateProps = {
  locale: Locale;
  /** The page's searchParams, still a promise: only this part waits for the request. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The part of /admin/reports that waits for the request (task 41). The page
 * puts it inside <Suspense>. In this order:
 *
 * 1. The access check (reports.view: manager, owner), before anything else,
 *    so a customer or a mechanic gets the 404 page and no report word
 *    reaches them.
 * 2. `await io()`, then today's India date: read fresh for each request,
 *    never frozen into the page built ahead of time.
 * 3. The period from the query, through pickReportPeriod (it trusts nothing).
 * 4. The four reports' tables, read live.
 */
export async function ReportsGate({ locale, searchParams }: ReportsGateProps) {
  await requirePermission(locale, "reports.view");
  await io();
  const today = indiaDateOf(systemClock.now());
  const query = await searchParams;
  const period = pickReportPeriod({ days: query.days, from: query.from, to: query.to }, today);

  const tables = await Promise.all(REPORT_NAMES.map((report) => readReportTable(report, period, locale)));
  if (tables.some((table) => table === null)) throw new Error("A report read refused a period pickReportPeriod chose");

  return <ReportsView locale={locale} period={period} tables={tables as ReportTable[]} />;
}
