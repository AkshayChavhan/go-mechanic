import { useLocale, useTranslations } from "next-intl";

import { sceneMark } from "@/components/site/scroll-scene-attributes";
import { Section } from "@/components/site/section";
import { ServiceTile } from "@/components/site/service-tile";
import type { Service } from "@/content/services";
import { VEHICLE_KINDS, type VehicleMake } from "@/domain/vehicles";
import { localize } from "@/i18n/localized-text";

/**
 * Periodic service, the garage's everyday job, gets a double-width tile. With
 * the other ten single tiles that's twelve cells, so every row fills at 2, 3
 * and 4 columns (plan KTD8). Phones show one column.
 */
const WIDE_TILE = "periodic-service";

/** A brand as the brands row needs it: no models. */
export type HomeBrand = Pick<VehicleMake, "id" | "kind" | "name">;

/**
 * The services grid (the bento), on the grey band. No prices and no links
 * until task 18 adds the service pages. The tiles reveal one after another
 * as they scroll into view (a reveal group), with motion allowed.
 *
 * Under the grid, the brands the garage works on (task 17): names only, no
 * logos (other companies' trademarks) and no links, one quiet list per kind.
 * A kind with no brands is left out; with none at all, so is the block.
 */
export function HomeServices({ services, brands }: { services: readonly Service[]; brands: readonly HomeBrand[] }) {
  const t = useTranslations("HomePage.services");
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
        <ul {...sceneMark("revealGroup")} className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {services.map((service) => (
            <li key={service.id} className={service.id === WIDE_TILE ? "sm:col-span-2" : undefined}>
              <ServiceTile service={service} />
            </li>
          ))}
        </ul>
        {brandLists.length > 0 && (
          <div {...sceneMark("reveal")} className="flex flex-col gap-4 border-t border-border pt-8">
            <h3 className="type-body font-semibold">{t("brands.title")}</h3>
            {/* A label beside each list from 640px; above it on phones. */}
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-[max-content_1fr]">
              {brandLists.map((list) => (
                <div key={list.kind} className="grid gap-1 sm:col-span-2 sm:grid-cols-subgrid">
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
