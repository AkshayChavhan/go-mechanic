import { useTranslations } from "next-intl";

import { sceneMark } from "@/components/site/scroll-scene-attributes";
import { Section } from "@/components/site/section";
import { ServiceTile } from "@/components/site/service-tile";
import type { Service } from "@/content/services";

/**
 * Periodic service, the garage's everyday job, gets a double-width tile. With
 * the other ten single tiles that's twelve cells, so every row fills at 2, 3
 * and 4 columns (plan KTD8). Phones show one column.
 */
const WIDE_TILE = "periodic-service";

/**
 * The services grid (the bento), on the grey band. No prices and no links
 * until task 18 adds the service pages. The tiles reveal one after another
 * as they scroll into view (a reveal group), with motion allowed.
 */
export function HomeServices({ services }: { services: readonly Service[] }) {
  const t = useTranslations("HomePage.services");

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
      </div>
    </Section>
  );
}
