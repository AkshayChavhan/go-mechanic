import { ArrowRightIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { isLivePage } from "@/components/site/navigation";
import { sceneMark } from "@/components/site/scroll-scene-attributes";
import { Section } from "@/components/site/section";
import { ServiceTile } from "@/components/site/service-tile";
import { servicePath, type Service } from "@/domain/services";
import { VEHICLE_KINDS, type VehicleMake } from "@/domain/vehicles";
import { localize } from "@/i18n/localized-text";
import { Link } from "@/i18n/navigation";

/**
 * Periodic service, the garage's everyday job, gets a double-width tile. With
 * the other ten single tiles that's twelve cells, so every row fills at 2, 3
 * and 4 columns (plan KTD8). Phones show one column.
 */
const WIDE_TILE = "periodic-service";

/** A brand as the brands row needs it: no models. */
export type HomeBrand = Pick<VehicleMake, "id" | "kind" | "name">;

/**
 * The services grid (the bento), on the grey band. Each tile links to its
 * service page (task 18), and "All services" leads to /services. No prices
 * here: the services pages show them. The tiles don't reveal on scroll any
 * more: a link must never sit inside a reveal target (a hidden link could
 * take keyboard focus while invisible); the heading above still reveals.
 *
 * Under the grid, the brands the garage works on (task 17): names only, no
 * logos (other companies' trademarks) and no links, one quiet list per kind.
 * A kind with no brands is left out; with none at all, so is the block.
 */
export function HomeServices({ services, brands }: { services: readonly Service[]; brands: readonly HomeBrand[] }) {
  const t = useTranslations("HomePage.services");
  const tServices = useTranslations("Services");
  const locale = useLocale();
  const brandLists = VEHICLE_KINDS.map((kind) => ({
    kind,
    label: kind === "car" ? t("brands.cars") : t("brands.twoWheelers"),
    brands: brands.filter((brand) => brand.kind === kind),
  })).filter((list) => list.brands.length > 0);

  return (
    <Section tone="grey" width="wide" aria-labelledby="home-services">
      <div className="flex flex-col gap-12">
        <div {...sceneMark("reveal")} className="flex max-w-2xl flex-col gap-4">
          <h2 id="home-services" className="type-headline text-balance">
            {t("title")}
          </h2>
          <p className="type-lead text-pretty text-muted-foreground">{t("lead")}</p>
        </div>
        <div className="flex flex-col gap-6">
          <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {services.map((service) => (
              <li key={service.id} className={service.id === WIDE_TILE ? "sm:col-span-2" : undefined}>
                <ServiceTile service={service} href={servicePath(service.id)} />
              </li>
            ))}
          </ul>
          {isLivePage("/services") && (
            <Link
              href="/services"
              className="inline-flex items-center gap-2 self-start type-body text-link underline-offset-4 hover:underline pointer-coarse:min-h-11"
            >
              {tServices("allServices")}
              <ArrowRightIcon aria-hidden="true" className="size-4" />
            </Link>
          )}
        </div>
        {brandLists.length > 0 && (
          <div {...sceneMark("reveal")} className="flex flex-col gap-4 border-t border-border pt-8">
            <h3 className="type-body font-semibold">{t("brands.title")}</h3>
            {/* A label beside each list from 640px; above it on phones. */}
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-[max-content_1fr]">
              {brandLists.map((list) => (
                <div key={list.kind} className="grid gap-y-1 sm:col-span-2 sm:grid-cols-subgrid">
                  <dt className="type-callout text-muted-foreground">{list.label}</dt>
                  <dd>
                    {/* Spaced apart, with no typed separator between the names. */}
                    <ul className="flex flex-wrap gap-x-5 gap-y-1 type-callout">
                      {list.brands.map((brand) => (
                        <li key={brand.id}>{localize(brand.name, locale)}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </Section>
  );
}
