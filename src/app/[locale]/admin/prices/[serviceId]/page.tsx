import { useLocale } from "next-intl";
import { Suspense } from "react";

import { AdminLoading } from "@/components/admin/admin-loading";
import { Section } from "@/components/site/section";

import { ServicePricesGate } from "./service-prices-gate";

// /admin/prices/[serviceId]: one service's or package's prices, a card per
// price group (task 39). No generateStaticParams: under `npm run dev` it runs
// in a helper process, where a database read hangs (CLAUDE.md "Database"), and
// a staff page needs nothing built ahead of time but the loading line. The id
// is read inside <Suspense>, by the gate, after the access check
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
// dynamic-routes.md, "Without generateStaticParams").
export default function AdminServicePricesPage({ params }: PageProps<"/[locale]/admin/prices/[serviceId]">) {
  const locale = useLocale();
  return (
    <Section width="wide">
      <Suspense fallback={<AdminLoading />}>
        <ServicePricesGate locale={locale} params={params} />
      </Suspense>
    </Section>
  );
}
