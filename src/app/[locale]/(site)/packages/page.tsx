import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { bookTarget } from "@/components/site/navigation";
import { PackageCard } from "@/components/site/package-card";
import { PriceFinder } from "@/components/site/price-finder";
import { SampleBadge } from "@/components/site/sample-badge";
import { Section } from "@/components/site/section";
import { vehiclePickerLabels } from "@/components/site/vehicle-picker-labels";
import { selectPrices } from "@/content/sample-prices";
import { fromPrice } from "@/domain/services";
import { VEHICLE_KINDS } from "@/domain/vehicles";
import { formatRupees } from "@/i18n/format";
import { localize } from "@/i18n/localized-text";
import { whatsappHref } from "@/lib/contact-links";
import { showSamples } from "@/lib/samples";
import { readGarage } from "@/server/dal/garage";
import { readServicePrices, readServices } from "@/server/dal/services";
import { readVehicleCatalogue } from "@/server/dal/vehicles";

import { HomeActions } from "../_components/home-actions";

// /packages (task 18): Basic, Standard and Comprehensive, for cars and for
// two-wheelers. The menu calls it "Packages" (Nav.prices) until real prices
// exist. Built ahead of time from cached reads (ensureStatic).
export const ensureStatic = "navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Packages");
  const tBrand = await getTranslations("Brand");
  return { title: t("metaTitle", { brand: tBrand("name") }), description: t("metaDescription") };
}

/** Each kind's section: its anchor (#cars) and heading. */
const kindSections = {
  car: { id: "cars", title: "cars" },
  "two-wheeler": { id: "two-wheelers", title: "twoWheelers" },
} as const;

/**
 * The packages page. Each card ends with a price line: "From ₹…" when there's
 * a price (a marked sample under `npm run dev`), else how to ask for one.
 * Under `npm run dev` only, a price finder (PriceFinder) comes first; it
 * never renders on the live site, so the draft models never reach it.
 */
export default async function PackagesPage() {
  const t = await getTranslations("Packages");
  const tServices = await getTranslations("Services");
  const tHome = await getTranslations("HomePage");
  const tContact = await getTranslations("Contact");
  const locale = await getLocale();

  const packages = (await readServices()).filter((service) => service.kind === "package");
  const shown = selectPrices(await readServicePrices());
  const garage = await readGarage();
  const book = bookTarget(whatsappHref(garage.whatsapp, tContact("bookingMessage")));

  const sections = VEHICLE_KINDS.map((kind) => ({
    kind,
    ...kindSections[kind],
    packages: packages.filter((item) => item.vehicleKinds.includes(kind)),
  })).filter((section) => section.packages.length > 0);

  // The finder needs the catalogue and the picker's words: read only when it shows.
  const finder =
    showSamples() && shown
      ? { catalogue: await readVehicleCatalogue(), pickerLabels: await vehiclePickerLabels() }
      : null;

  /** A card's price line: text only, never a button (the page's one action group is at the end). */
  const priceLine = (paise: number | null) =>
    paise !== null && shown ? (
      <p
        data-sample={shown.sample ? "package-price" : undefined}
        className="flex items-center gap-2 type-body font-semibold"
      >
        {tServices("from", { price: formatRupees(paise, locale) })}
        {shown.sample && <SampleBadge />}
      </p>
    ) : (
      <p className="type-callout text-muted-foreground">{t("callForPrice")}</p>
    );

  // Tones alternate down the page: white, grey, white...
  const tone = (index: number) => (index % 2 === 0 ? "white" : "grey");
  const first = finder ? 2 : 1;

  return (
    <>
      <Section width="wide">
        <div className="flex max-w-2xl flex-col gap-4">
          <h1 className="type-display text-balance">{t("title")}</h1>
          <p className="type-lead text-pretty text-muted-foreground">{t("lead")}</p>
          {sections.length > 1 && (
            <nav aria-label={t("jumpTo")}>
              <ul className="flex flex-wrap gap-x-6">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="inline-flex items-center type-body text-link underline-offset-4 hover:underline pointer-coarse:min-h-11"
                    >
                      {t(section.title)}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </Section>

      {finder && shown && (
        <Section tone="grey" width="wide">
          <PriceFinder
            catalogue={finder.catalogue}
            pickerLabels={finder.pickerLabels}
            labels={{
              title: t("finder.title"),
              lead: t("finder.lead"),
              prompt: t("finder.prompt"),
              resultsTitle: t.raw("finder.resultsTitle") as string,
              notOffered: t("finder.notOffered"),
              callForPrice: t("finder.callForPrice"),
              sample: tHome("sample"),
            }}
            packages={packages.map(({ id, vehicleKinds, fuels, pricedAfterInspection, name }) => ({
              id,
              vehicleKinds,
              fuels,
              pricedAfterInspection,
              name: localize(name, locale),
            }))}
            prices={shown.items}
            sample={shown.sample}
          />
        </Section>
      )}

      {sections.map((section, index) => (
        <Section
          key={section.id}
          id={section.id}
          tone={tone(first + index)}
          width="wide"
          aria-labelledby={`${section.id}-title`}
        >
          <div className="flex flex-col gap-8">
            <h2 id={`${section.id}-title`} className="type-headline text-balance">
              {t(section.title)}
            </h2>
            {/* One column on phones, the three side by side from 768px. */}
            <ul className="grid gap-4 md:grid-cols-3">
              {section.packages.map((item) => (
                <li key={item.id}>
                  <PackageCard
                    name={localize(item.name, locale)}
                    summary={localize(item.summary, locale)}
                    included={item.included.map((line) => localize(line, locale))}
                    price={priceLine(shown ? fromPrice(item, shown.items) : null)}
                  />
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ))}

      <Section tone={tone(first + sections.length)} width="wide" aria-labelledby="packages-actions">
        <div className="flex max-w-2xl flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h2 id="packages-actions" className="type-title">
              {t("actionsTitle")}
            </h2>
            <p className="type-body text-pretty text-muted-foreground">{t("actionsLead")}</p>
          </div>
          <HomeActions book={book} phone={garage.phone} />
        </div>
      </Section>
    </>
  );
}
