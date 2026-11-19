import { useLocale } from "next-intl";
import { Suspense } from "react";

import { AdminLoading } from "@/components/admin/admin-loading";
import { Section } from "@/components/site/section";

import { BookingsGate } from "./bookings-gate";

// /admin/bookings: one India day's bookings for staff (task 26), today by
// default, another day with ?date=2026-11-20. Built ahead of time with only
// the loading line: the page hands searchParams to the gate unawaited, since
// awaiting it here would make the whole page wait for the request. No
// metadata of its own: the layout's title is the brand alone, so a
// customer's <head> holds no staff word.
export default function AdminBookingsPage({ searchParams }: PageProps<"/[locale]/admin/bookings">) {
  const locale = useLocale();
  return (
    <Section width="wide">
      <Suspense fallback={<AdminLoading />}>
        <BookingsGate locale={locale} searchParams={searchParams} />
      </Suspense>
    </Section>
  );
}
