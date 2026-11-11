import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Section } from "@/components/site/section";
import { ServiceTile } from "@/components/site/service-tile";
import { selectPrices } from "@/content/sample-prices";
import { fromPrice, servicePath } from "@/domain/services";
import { readServicePrices, readServices } from "@/server/dal/services";

// /services (task 18): every service, each tile linking to its page. Built
// ahead of time: every read is cached, and a request-time read here fails
// `next build` (ensureStatic).
export const ensureStatic = "navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Services");
  const tBrand = await getTranslations("Brand");
  return { title: t("metaTitle", { brand: tBrand("name") }), description: t("metaDescription") };
}

/**
 * The services list. A tile shows "From ₹…" only when there's a price: under
 * `npm run dev` that's a sample, marked; the live site shows none until the
 * owner gives real prices (selectPrices()).
 */
export default async function ServicesPage() {
  const t = await getTranslations("Services");
  const services = (await readServices()).filter((service) => service.kind === "service");
  const shown = selectPrices(await readServicePrices());
  // Periodic service gets the wide tile, as on the home page.
  const wide = "periodic-service";

  return (
    <>
      <Section width="wide">
        <div className="flex max-w-2xl flex-col gap-4">
          <h1 className="type-display text-balance">{t("title")}</h1>
          <p className="type-lead text-pretty text-muted-foreground">{t("lead")}</p>
        </div>
      </Section>
      <Section tone="grey" width="wide">
        <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {services.map((service) => (
            <li key={service.id} className={service.id === wide ? "sm:col-span-2" : undefined}>
              <ServiceTile
                service={service}
                href={servicePath(service.id)}
                fromPaise={shown ? fromPrice(service, shown.items) : null}
                sample={shown?.sample ?? false}
              />
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
