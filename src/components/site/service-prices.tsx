import { useLocale, useTranslations } from "next-intl";

import { priceFor, type Service, type ServicePrice } from "@/domain/services";
import { FUELS, type Fuel, type VehicleCatalogue, type VehicleKind } from "@/domain/vehicles";
import { formatRupees } from "@/i18n/format";
import { localize } from "@/i18n/localized-text";
import type { Shown } from "@/lib/samples";

import { SampleBadge } from "./sample-badge";

/** The fuels that the models of one price group run on and the service covers, in FUELS order. */
function groupFuels(catalogue: VehicleCatalogue, categoryId: string, service: Service): Fuel[] {
  const fuels = new Set(
    catalogue.makes.flatMap((make) =>
      make.models.filter((model) => model.categoryId === categoryId).flatMap((model) => model.fuels),
    ),
  );
  return FUELS.filter((fuel) => fuels.has(fuel) && service.fuels.includes(fuel));
}

type ServicePricesProps = {
  service: Service;
  /** selectPrices(): the real prices, the samples under `npm run dev`, or null. */
  shown: Shown<ServicePrice> | null;
  /** For the price groups and which fuels each one's models run on. */
  catalogue: VehicleCatalogue;
  /** The id of the block's h2, for the section's aria-labelledby. */
  headingId: string;
};

/**
 * A service page's price block. Text only: the page's one action group, below
 * it, holds the buttons.
 * - Priced after an inspection: says so, whatever prices exist.
 * - No prices for this service (the live site until the owner gives them):
 *   "Call or WhatsApp us".
 * - Prices: one table per vehicle kind, a row per price group, with a line
 *   per fuel when the fuels' prices differ. Samples carry data-sample and the
 *   Sample badge. Price group names show only here, and only under
 *   `npm run dev` until real prices exist (task 39 decides about the live site).
 */
export function ServicePrices({ service, shown, catalogue, headingId }: ServicePricesProps) {
  const t = useTranslations("Services.price");
  const tFuels = useTranslations("Vehicles.fuels");
  const tKinds = useTranslations("HomePage.services.vehicles");
  const locale = useLocale();
  const kindLabel = (kind: VehicleKind) => (kind === "car" ? tKinds("car") : tKinds("twoWheeler"));
  const fuelLabel = (fuel: Fuel) => tFuels(fuel);

  // Real prices can exist for some services and not yet for this one: then
  // this page asks to call too, as its tile and its package card do.
  const ownPrices = shown !== null && shown.items.some((row) => row.serviceId === service.id);

  const heading = (
    <h2 id={headingId} className="flex items-center gap-3 type-title">
      {t("title")}
      {ownPrices && shown?.sample && !service.pricedAfterInspection && <SampleBadge />}
    </h2>
  );

  if (service.pricedAfterInspection || shown === null || !ownPrices) {
    return (
      <div className="flex max-w-2xl flex-col gap-3">
        {heading}
        <p className="type-body text-pretty text-muted-foreground">
          {service.pricedAfterInspection ? t("onInspection") : t("callForPrice")}
        </p>
      </div>
    );
  }

  const tables = service.vehicleKinds.map((kind) => ({
    kind,
    rows: catalogue.categories
      .filter((category) => category.kind === kind)
      .map((category) => {
        const fuels = groupFuels(catalogue, category.id, service);
        const results = fuels.map((fuel) => ({
          fuel,
          result: priceFor(service, shown.items, { kind, categoryId: category.id, fuel }),
        }));
        const text = (result: (typeof results)[number]["result"]) =>
          result.status === "price" ? formatRupees(result.paise, locale) : t("noPrice");
        const distinct = new Set(results.map(({ result }) => text(result)));
        return {
          id: category.id,
          name: localize(category.name, locale),
          // One price for every fuel: just the price. Otherwise a line per fuel.
          lines:
            distinct.size === 1
              ? [...distinct]
              : results.map(({ fuel, result }) => t("fuelPrice", { fuel: fuelLabel(fuel), price: text(result) })),
        };
      })
      .filter((row) => row.lines.length > 0),
  }));

  return (
    <div data-sample={shown.sample ? "service-prices" : undefined} className="flex flex-col gap-6">
      <div className="flex max-w-2xl flex-col gap-3">
        {heading}
        <p className="type-body text-pretty text-muted-foreground">{t("byType")}</p>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        {tables
          .filter((table) => table.rows.length > 0)
          .map((table) => (
            <div key={table.kind} className="overflow-x-auto">
              <table className="w-full type-callout">
                <caption className="pb-2 text-left type-body font-semibold">{kindLabel(table.kind)}</caption>
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 text-left font-normal">
                      {t("typeHeader")}
                    </th>
                    <th scope="col" className="py-2 text-right font-normal">
                      {t("priceHeader")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row) => (
                    <tr key={row.id} className="border-b border-border align-top">
                      <th scope="row" className="py-3 pr-4 text-left font-normal">
                        {row.name}
                      </th>
                      <td className="py-3 text-right font-semibold">
                        {row.lines.map((line) => (
                          <span key={line} className="block">
                            {line}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </div>
  );
}
