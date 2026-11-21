import { ArrowLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { groupFuels, groupPriceRow, type Service, type ServicePrice } from "@/domain/services";
import type { VehicleCatalogue } from "@/domain/vehicles";
import type { Locale } from "@/i18n/config";
import { formatRupeeAmount, rupeeSymbol } from "@/i18n/format";
import { localize } from "@/i18n/localized-text";
import { Link } from "@/i18n/navigation";
import type { PriceFormValues } from "@/lib/price-form";
import { savePrices } from "@/server/actions/prices";

import { PriceGroupForm } from "./price-group-form";
import { serviceTitle } from "./price-list";

type ServicePriceEditorProps = {
  locale: Locale;
  service: Service;
  prices: readonly ServicePrice[];
  catalogue: VehicleCatalogue;
};

/**
 * /admin/prices/[serviceId] (task 39): one service's or package's prices, a
 * card per price group of its vehicle kinds. A group none of whose listed
 * models runs on a fuel the service covers gets a note instead of a card
 * (the public price table leaves it out too). A service priced after an
 * inspection gets a note and no cards. Rendered by the page's gate, after
 * the access check.
 */
export async function ServicePriceEditor({ locale, service, prices, catalogue }: ServicePriceEditorProps) {
  const t = await getTranslations({ locale, namespace: "AdminPrices" });
  const tFuels = await getTranslations({ locale, namespace: "Vehicles.fuels" });
  const title = await serviceTitle(service, locale);
  const amount = (row: ServicePrice | undefined) => (row ? formatRupeeAmount(row.pricePaise, locale) : "");

  const groups = catalogue.categories
    .filter((category) => service.vehicleKinds.includes(category.kind))
    .map((category) => {
      const fuels = groupFuels(catalogue, category.id, service);
      const rows = prices.filter((row) => row.serviceId === service.id && row.categoryId === category.id);
      const rowFor = (fuel: ServicePrice["fuel"]) => rows.find((row) => row.fuel === fuel);
      const initial: PriceFormValues = { group: amount(rowFor(null)) };
      if (fuels.length >= 2) {
        for (const fuel of fuels) initial[fuel] = amount(rowFor(fuel));
      } else if (fuels.length === 1) {
        // One fuel only, so no fold: the box shows what that fuel pays (its own
        // row wins, as in priceFor). Showing the every-fuel row instead would let
        // a Save without a change replace the price customers pay (task 39 review).
        initial.group = amount(groupPriceRow(rows, fuels[0]!));
      }
      return { category, fuels, initial };
    });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex max-w-2xl flex-col gap-3">
        <Button asChild variant="link" className="-ml-3 w-fit">
          <Link href="/admin/prices">
            <ArrowLeftIcon data-icon="inline-start" />
            {t("back")}
          </Link>
        </Button>
        <h1 className="type-headline text-balance">{title}</h1>
        {service.pricedAfterInspection && (
          <p className="type-body text-pretty text-muted-foreground">{t("onInspectionNote")}</p>
        )}
      </div>
      {!service.pricedAfterInspection && (
        <div className="grid max-w-4xl items-start gap-4 md:grid-cols-2">
          {groups.map(({ category, fuels, initial }) => {
            const name = localize(category.name, locale);
            return fuels.length === 0 ? (
              <section key={category.id} aria-label={name} className="flex flex-col gap-2 rounded-xl bg-card p-5">
                <h2 className="type-title">{name}</h2>
                <p className="type-callout text-pretty text-muted-foreground">{t("notOffered")}</p>
              </section>
            ) : (
              <PriceGroupForm
                key={category.id}
                action={savePrices.bind(null, locale, service.id, category.id)}
                heading={name}
                fuels={fuels.map((fuel) => ({ fuel, label: tFuels(fuel) }))}
                initial={initial}
                labels={{
                  groupLabel: t("groupLabel"),
                  groupHint: t("groupHint"),
                  fuelsSummary: t("fuelsSummary"),
                  fuelsHint: t("fuelsHint"),
                  save: t("save", { group: name }),
                  saving: t("saving"),
                  saved: t("saved"),
                  connection: t("connection"),
                  currency: rupeeSymbol(locale),
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
