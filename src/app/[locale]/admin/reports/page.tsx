import { useLocale } from "next-intl";
import { Suspense } from "react";

import { AdminLoading } from "@/components/admin/admin-loading";
import { Section } from "@/components/site/section";

import { ReportsGate } from "./reports-gate";

// /admin/reports: the staff reports for a period (task 41), the last 30 days
// by default, ?days=7 or 90, or ?from=...&to=... Built ahead of time with
// only the loading line: the page hands searchParams to the gate unawaited,
// since awaiting it here would make the whole page wait for the request. No
// metadata of its own: the layout's title is the brand alone, so a
// customer's <head> holds no staff word.
export default function AdminReportsPage({ searchParams }: PageProps<"/[locale]/admin/reports">) {
  const locale = useLocale();
  return (
    <Section width="wide">
      <Suspense fallback={<AdminLoading />}>
        <ReportsGate locale={locale} searchParams={searchParams} />
      </Suspense>
    </Section>
  );
}
