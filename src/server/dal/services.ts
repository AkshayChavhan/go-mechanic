// The services, packages and real prices, read from the database.
//
// The rules of this folder (src/server/dal/, the "data-access layer"; see
// garage.ts):
// 1. It is the only code that queries the database.
// 2. Public reads need no check: anyone can see the services and their
//    prices. Both reads are cached, so the pages that show them stay
//    prebuilt.
// 3. Writes come later: task 39 adds the saves, with authorize("content.edit"),
//    and they call updateTag() with the tags below.

import "server-only";

import { asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import type { Service, ServicePrice } from "@/domain/services";
import { getDatabase } from "@/server/db";
import { servicePrices, services } from "@/server/db/schema";
import { draftServices } from "@/server/db/service-seed-data";

/** The cache tag on every cached read of the services and packages. */
export const SERVICES_TAG = "services";

/** The cache tag on every cached read of the real prices. */
export const SERVICE_PRICES_TAG = "service-prices";

/**
 * The listed services and packages, in list order (hidden ones left out).
 * Cached ('use cache') with the "max" lifetime, like readGarage(). An empty
 * table gives an empty list instead of an error.
 */
export async function readServices(): Promise<Service[]> {
  "use cache";
  cacheTag(SERVICES_TAG);
  cacheLife("max");

  const db = await getDatabase();
  return db
    .select({
      id: services.id,
      kind: services.kind,
      name: services.name,
      summary: services.summary,
      vehicleKinds: services.vehicleKinds,
      fuels: services.fuels,
      included: services.included,
      signs: services.signs,
      pricedAfterInspection: services.pricedAfterInspection,
    })
    .from(services)
    .where(eq(services.listed, true))
    .orderBy(asc(services.position), asc(services.id));
}

/**
 * The ids of the service pages to build ahead of time: the seeded services
 * (not the packages, which have no pages). For generateStaticParams only.
 *
 * Not read from the database, on purpose: `next dev` runs generateStaticParams
 * in a helper process (its static-paths worker, a jest-worker child), and in
 * a helper process getDatabase() never settles (openForThisProcess in
 * src/server/db/index.ts), so a database read there would hang the page
 * forever, with no error (seen in task 18). The seeded ids are safe to list:
 * ids never change and services are hidden, never deleted. A service added
 * later (task 39) is built on its first visit, and a hidden one gets the 404.
 */
export function serviceIdsToBuild(): string[] {
  return draftServices.filter((service) => service.kind === "service").map((service) => service.id);
}

/**
 * Every real price. Empty until the owner gives prices (task 39): pages then
 * show the samples under `npm run dev` (selectPrices() in
 * src/content/sample-prices.ts) and no price anywhere else. A price of a
 * hidden service is still returned; pages only look up the services they show.
 */
export async function readServicePrices(): Promise<ServicePrice[]> {
  "use cache";
  cacheTag(SERVICE_PRICES_TAG);
  cacheLife("max");

  const db = await getDatabase();
  return db
    .select({
      serviceId: servicePrices.serviceId,
      categoryId: servicePrices.categoryId,
      fuel: servicePrices.fuel,
      pricePaise: servicePrices.pricePaise,
    })
    .from(servicePrices)
    .orderBy(asc(servicePrices.serviceId), asc(servicePrices.categoryId), asc(servicePrices.fuel));
}
