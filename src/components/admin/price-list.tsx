import { ChevronRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { groupFuels, type Service, type ServicePrice } from "@/domain/services";
import type { VehicleCatalogue, VehicleKind } from "@/domain/vehicles";
import type { Locale } from "@/i18n/config";
import { localize } from "@/i18n/localized-text";
import { Link } from "@/i18n/navigation";

/** The address of a service's or package's price page in the staff area. */
export function adminPricePath(serviceId: string): `/admin/prices/${string}` {
  return `/admin/prices/${serviceId}`;
}

/**
 * The price groups `service` can be priced for: those of its vehicle kinds
 * whose listed models run on a fuel it covers, in catalogue order.
 */
export function pricedGroups(service: Service, catalogue: VehicleCatalogue) {
  return catalogue.categories.filter(
    (category) => service.vehicleKinds.includes(category.kind) && groupFuels(catalogue, category.id, service).length > 0,
  );
}

/** "Basic service, for cars": a package's name says which vehicles it's for (a package covers one kind). */
export async function serviceTitle(service: Service, locale: Locale): Promise<string> {
  const name = localize(service.name, locale);
  if (service.kind !== "package") return name;
  const t = await getTranslations({ locale, namespace: "AdminPrices" });
  const kind: VehicleKind = service.vehicleKinds[0] ?? "car";
  return t("packageName", { name, kind: kind === "car" ? t("kinds.car") : t("kinds.twoWheeler") });
}

type PriceListProps = {
  locale: Locale;
  services: readonly Service[];
  prices: readonly ServicePrice[];
  catalogue: VehicleCatalogue;
};

/**
 * /admin/prices (task 39): every service and package the site lists, each a
 * 44px row linking to its price page, with how many of its vehicle types
 * have a price. Rendered by the page's gate, after the access check.
 */
export async function PriceList({ locale, services, prices, catalogue }: PriceListProps) {
  const t = await getTranslations({ locale, namespace: "AdminPrices" });

  const status = (service: Service) => {
    if (service.pricedAfterInspection) return t("listStatus.onInspection");
    const groups = pricedGroups(service, catalogue);
    const priced = groups.filter((group) =>
      prices.some((row) => row.serviceId === service.id && row.categoryId === group.id),
    ).length;
    return priced === 0 ? t("listStatus.none") : t("listStatus.priced", { count: priced, total: groups.length });
  };

  const lists = [
    { key: "services", heading: t("servicesHeading"), items: services.filter((service) => service.kind === "service") },
    { key: "packages", heading: t("packagesHeading"), items: services.filter((service) => service.kind === "package") },
  ].filter((list) => list.items.length > 0);

  const rows = await Promise.all(
    lists.map(async (list) => ({
      ...list,
      items: await Promise.all(
        list.items.map(async (service) => ({ id: service.id, title: await serviceTitle(service, locale), status: status(service) })),
      ),
    })),
  );

  return (
    <div className="flex flex-col gap-10">
      <div className="flex max-w-2xl flex-col gap-3">
        <h1 className="type-headline text-balance">{t("heading")}</h1>
        <p className="type-body text-pretty text-muted-foreground">{t("intro")}</p>
      </div>
      {rows.map((list) => (
        <section key={list.key} aria-labelledby={`prices-${list.key}`} className="flex max-w-2xl flex-col gap-3">
          <h2 id={`prices-${list.key}`} className="type-title">
            {list.heading}
          </h2>
          <ul className="flex flex-col divide-y divide-border rounded-xl bg-card">
            {list.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={adminPricePath(item.id)}
                  className="flex min-h-11 items-center justify-between gap-4 px-4 py-3 outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex flex-col">
                    <span className="type-body font-medium">{item.title}</span>
                    <span className="type-callout text-muted-foreground">{item.status}</span>
                  </span>
                  <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
