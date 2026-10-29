import type { Metadata } from "next";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { bookTarget } from "@/components/site/navigation";
import { CheckList } from "@/components/site/check-list";
import { Section } from "@/components/site/section";
import { ServicePrices } from "@/components/site/service-prices";
import { vehiclesKey } from "@/components/site/service-tile";
import { selectPrices } from "@/content/sample-prices";
import type { Service } from "@/domain/services";
import { localize } from "@/i18n/localized-text";
import { Link } from "@/i18n/navigation";
import { whatsappHref } from "@/lib/contact-links";
import { cn } from "@/lib/utils";
import { readGarage } from "@/server/dal/garage";
import { readServicePrices, readServices } from "@/server/dal/services";
import { readVehicleCatalogue } from "@/server/dal/vehicles";

import { HomeActions } from "../../_components/home-actions";

// /services/<id> (task 18): one service's page. Built ahead of time for every
// service (generateStaticParams), from cached reads only (ensureStatic).
export const ensureStatic = "navigation";

/** The service whose page this is. A package or an unknown id is a 404. */
async function findService(slug: string): Promise<Service> {
  const service = (await readServices()).find((candidate) => candidate.id === slug && candidate.kind === "service");
  if (!service) notFound();
  return service;
}

/**
 * Every service's id. Never empty: the seed has 11, and Cache Components fails
 * the build on an empty list (so staging must be seeded before its first
 * build, task 20). Packages have no pages of their own.
 */
export async function generateStaticParams() {
  const services = await readServices();
  return services.filter((service) => service.kind === "service").map((service) => ({ slug: service.id }));
}

// notFound() here as well as in the page, so an unknown id answers 404 with
// the 404 page's title, not this page's.
export async function generateMetadata({ params }: PageProps<"/[locale]/services/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const service = await findService(slug);
  const locale = await getLocale();
  const t = await getTranslations("Services.service");
  const tBrand = await getTranslations("Brand");
  return {
    title: t("metaTitle", { service: localize(service.name, locale), brand: tBrand("name") }),
    description: t("metaDescription", { summary: localize(service.summary, locale) }),
  };
}

/**
 * One service: what it is, what's included, the signs you need it, its price
 * (or how to get one), then one action group: Book (the one blue button) and
 * Call.
 */
export default async function ServicePage({ params }: PageProps<"/[locale]/services/[slug]">) {
  const { slug } = await params;
  const service = await findService(slug);
  const locale = await getLocale();
  const t = await getTranslations("Services");
  const tVehicles = await getTranslations("HomePage.services.vehicles");
  const tContact = await getTranslations("Contact");

  const garage = await readGarage();
  const book = bookTarget(whatsappHref(garage.whatsapp, tContact("bookingMessage")));
  const shown = selectPrices(await readServicePrices());
  const catalogue = await readVehicleCatalogue();

  const linkClass = "inline-flex items-center gap-2 text-link underline-offset-4 hover:underline pointer-coarse:min-h-11";

  return (
    <>
      <Section width="wide">
        <div className="flex max-w-2xl flex-col gap-4">
          <Link href="/services" className={cn(linkClass, "type-callout")}>
            <ArrowLeftIcon aria-hidden="true" className="size-4" />
            {t("allServices")}
          </Link>
          <h1 className="type-display text-balance">{localize(service.name, locale)}</h1>
          <p className="type-lead text-pretty text-muted-foreground">{localize(service.summary, locale)}</p>
          <p className="type-callout text-muted-foreground">{tVehicles(vehiclesKey(service.vehicleKinds))}</p>
        </div>
      </Section>

      <Section tone="grey" width="wide" aria-labelledby="service-included">
        <div className="grid gap-12 md:grid-cols-2">
          <div className="flex flex-col gap-6">
            <h2 id="service-included" className="type-title">
              {t("service.included")}
            </h2>
            <CheckList items={service.included.map((item) => localize(item, locale))} />
          </div>
          {service.signs.length > 0 && (
            <div className="flex flex-col gap-6">
              <h2 className="type-title">{t("service.signs")}</h2>
              <ul className="flex list-disc flex-col gap-3 pl-5 type-callout marker:text-muted-foreground">
                {service.signs.map((sign) => (
                  <li key={sign.en}>{localize(sign, locale)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Section>

      <Section width="wide" aria-labelledby="service-price">
        <div className="flex flex-col gap-8">
          <ServicePrices service={service} shown={shown} catalogue={catalogue} headingId="service-price" />
          {service.id === "periodic-service" && (
            <Link href="/packages" className={cn(linkClass, "type-body")}>
              {t("service.packages")}
              <ArrowRightIcon aria-hidden="true" className="size-4" />
            </Link>
          )}
        </div>
      </Section>

      <Section tone="grey" width="wide" aria-labelledby="service-actions">
        <div className="flex max-w-2xl flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h2 id="service-actions" className="type-title">
              {t("service.actionsTitle")}
            </h2>
            <p className="type-body text-pretty text-muted-foreground">{t("service.actionsLead")}</p>
          </div>
          <HomeActions book={book} phone={garage.phone} />
        </div>
      </Section>
    </>
  );
}
