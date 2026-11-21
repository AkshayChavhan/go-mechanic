import { useLocale } from "next-intl";
import { Suspense } from "react";

import { AdminLoading } from "@/components/admin/admin-loading";
import { Section } from "@/components/site/section";

import { PricesGate } from "./prices-gate";

// /admin/prices: every service and package, to pick one to price (task 39).
// Built ahead of time with only the loading line; PricesGate checks the
// login and content.edit inside <Suspense>. No metadata of its own: the
// layout's title is the brand alone, so a customer's <head> holds no staff word.
export default function AdminPricesPage() {
  const locale = useLocale();
  return (
    <Section width="wide">
      <Suspense fallback={<AdminLoading />}>
        <PricesGate locale={locale} />
      </Suspense>
    </Section>
  );
}
