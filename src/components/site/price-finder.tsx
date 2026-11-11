"use client";

import { useLocale } from "next-intl";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { priceFor, type PricedService, type ServicePrice } from "@/domain/services";
import { EMPTY_SELECTION, findModel, type VehicleCatalogue, type VehicleSelection } from "@/domain/vehicles";
import { formatRupees } from "@/i18n/format";
import { localize } from "@/i18n/localized-text";

import { VehiclePicker, type VehiclePickerLabels } from "./vehicle-picker";

/** Every word the finder shows besides the picker's, from the Packages messages (and the Sample mark). */
export type PriceFinderLabels = {
  title: string;
  lead: string;
  /** Shown until a model and a fuel are both chosen. */
  prompt: string;
  /** "Prices for {brand} {model}, {fuel}": the finder fills in the placeholders. */
  resultsTitle: string;
  notOffered: string;
  callForPrice: string;
  sample: string;
};

/** A package as the finder needs it: how it's priced, and its name in the page's language. */
export type FinderPackage = PricedService & { name: string };

type PriceFinderProps = {
  /** The listed catalogue (readVehicleCatalogue()). */
  catalogue: VehicleCatalogue;
  pickerLabels: VehiclePickerLabels;
  labels: PriceFinderLabels;
  /** Every package, in list order: the finder shows the chosen kind's. */
  packages: readonly FinderPackage[];
  /** selectPrices()'s items: real prices, or the samples. */
  prices: readonly ServicePrice[];
  /** The prices are samples: each one gets the Sample mark. */
  sample: boolean;
};

/** "{brand} {model}" with the values put in. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/**
 * The price finder on /packages, shown only under `npm run dev` (the owner's
 * decision of 2026-10-29: the draft models stay off the live site until the
 * owner has checked them). Pick a vehicle, and it lists what each package of
 * that kind costs for its price group and fuel, through priceFor().
 *
 * A client island that reads no messages: the page passes every word, the
 * catalogue and the prices as props, so neither the Packages namespace nor
 * the sample prices' file ever ships to the browser.
 *
 * The results' title is a polite live region (role="status"): it's there from
 * the first render, so screen readers announce it each time the vehicle
 * changes, once, and then the visitor reads the list below it.
 */
export function PriceFinder({ catalogue, pickerLabels, labels, packages, prices, sample }: PriceFinderProps) {
  const locale = useLocale();
  const [selection, setSelection] = useState<VehicleSelection>(EMPTY_SELECTION);

  const found = findModel(catalogue, selection.modelId);
  const fuel = selection.fuel;
  const vehicle = found && fuel ? { kind: found.make.kind, categoryId: found.model.categoryId, fuel } : null;

  return (
    // data-sample: the finder always shows the draft vehicle models, so it is
    // sample content even once real prices exist (the Sample badge follows `sample`).
    <div data-sample="price-finder" className="flex flex-col gap-8">
      <div className="flex max-w-2xl flex-col gap-3">
        <h2 className="flex items-center gap-3 type-title">
          {labels.title}
          {sample && <Badge variant="secondary">{labels.sample}</Badge>}
        </h2>
        <p className="type-body text-pretty text-muted-foreground">{labels.lead}</p>
      </div>
      <div className="grid gap-10 md:grid-cols-2">
        <VehiclePicker catalogue={catalogue} labels={pickerLabels} name="priceFinder" onChange={setSelection} />
        <div className="flex flex-col gap-4">
          <p role="status" className="type-body font-semibold text-pretty">
            {found && fuel
              ? fill(labels.resultsTitle, {
                  brand: localize(found.make.name, locale),
                  model: localize(found.model.name, locale),
                  fuel: pickerLabels.fuels[fuel],
                })
              : labels.prompt}
          </p>
          {vehicle && (
            <ul className="flex flex-col">
              {packages
                .filter((item) => item.vehicleKinds.includes(vehicle.kind))
                .map((item) => {
                  const result = priceFor(item, prices, vehicle);
                  return (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border py-3"
                    >
                      <span className="type-callout">{item.name}</span>
                      <span className="flex items-center gap-2 type-callout font-semibold">
                        {result.status === "price"
                          ? formatRupees(result.paise, locale)
                          : result.status === "not-offered"
                            ? labels.notOffered
                            : labels.callForPrice}
                        {sample && result.status === "price" && <Badge variant="secondary">{labels.sample}</Badge>}
                      </span>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
