// The services, packages and real prices, read from the database.
//
// The rules of this folder (src/server/dal/, the "data-access layer"; see
// garage.ts):
// 1. It is the only code that queries the database.
// 2. Public reads need no check: anyone can see the services and their
//    prices. Both reads are cached, so the pages that show them stay
//    prebuilt.
// 3. Staff work (task 39's price editor) starts with authorize("content.edit")
//    and reads live. Only saveGroupPrices writes prices; it calls updateTag()
//    with the tag below, so the public pages show the new price at once.

import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";

import {
  checkGroupPrices,
  type GroupPriceEntry,
  type GroupPriceProblem,
  groupFuels,
  type Service,
  type ServicePrice,
} from "@/domain/services";
import { type Fuel, isTextId } from "@/domain/vehicles";
import { authorize } from "@/server/auth/access";
import { type Database, getDatabase } from "@/server/db";
import { servicePrices, services } from "@/server/db/schema";
import { draftServices } from "@/server/db/service-seed-data";

import { readVehicleCatalogue } from "./vehicles";

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
 * Every real price. Empty until staff save one (task 39's editor): pages then
 * show the samples under `npm run dev` (selectPrices() in
 * src/content/sample-prices.ts) and no price anywhere else. A price of a
 * hidden service is still returned; pages only look up the services they show.
 */
export async function readServicePrices(): Promise<ServicePrice[]> {
  "use cache";
  cacheTag(SERVICE_PRICES_TAG);
  cacheLife("max");

  const db = await getDatabase();
  return selectPriceRows(db);
}

// --- Staff: the price editor (task 39) ----------------------------------------

/** Every real price, read live for the staff editor (never cached), for "content.edit". */
export async function listPricesForStaff(): Promise<ServicePrice[]> {
  await authorize("content.edit");
  const db = await getDatabase();
  return selectPriceRows(db);
}

export type SaveGroupPricesResult =
  /** Saved and live: this service's rows for the group now, and the fuels the group is shown for (groupFuels). */
  | { status: "saved"; prices: ServicePrice[]; fuels: Fuel[] }
  /** No listed service or package with that id, or no such group for its vehicle kinds. */
  | { status: "not-found" }
  /** The garage prices this service after seeing the vehicle. */
  | { status: "on-inspection" }
  | { status: "problems"; problems: BoxPriceProblem[] };

/** A problem with one typed box (the whole-card ones become their own answers). */
export type BoxPriceProblem = GroupPriceProblem & { problem: "fuel-not-offered" | "bad-price" | "repeated" };

function isBoxProblem(problem: GroupPriceProblem): problem is BoxPriceProblem {
  return problem.problem !== "on-inspection" && problem.problem !== "category-kind";
}

/**
 * Replaces one price group's prices for one service or package with
 * `entries` (empty: no price for that group), for "content.edit". Call from
 * a Server Action: it calls updateTag().
 *
 * Saving the same entries again gives the same rows and the same answer, so
 * a retry needs no request token. The transaction first takes an advisory
 * lock on the service and group: without it, two overlapping saves of one
 * card on Postgres would both delete, and the second insert would hit the
 * unique constraint. With it, the last save wins. (PGlite runs one
 * transaction at a time, so its tests can't show the race; task 20 can.)
 */
export async function saveGroupPrices(
  serviceId: string,
  categoryId: string,
  entries: readonly GroupPriceEntry[],
): Promise<SaveGroupPricesResult> {
  await authorize("content.edit");
  if (!isTextId(serviceId) || !isTextId(categoryId)) return { status: "not-found" };

  // Cached reads before the transaction: each opens its own query, and PGlite
  // would wait forever for a connection the transaction holds.
  const [listed, catalogue] = await Promise.all([readServices(), readVehicleCatalogue()]);
  const service = listed.find((row) => row.id === serviceId);
  const category = catalogue.categories.find((row) => row.id === categoryId);
  if (!service || !category) return { status: "not-found" };

  const problems = checkGroupPrices(service, category, catalogue, entries);
  if (problems.some((problem) => problem.problem === "on-inspection")) return { status: "on-inspection" };
  if (problems.some((problem) => problem.problem === "category-kind")) return { status: "not-found" };
  if (problems.length > 0) return { status: "problems", problems: problems.filter(isBoxProblem) };

  const db = await getDatabase();
  const prices = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`service-price:${serviceId}:${categoryId}`}))`);
    const group = and(eq(servicePrices.serviceId, serviceId), eq(servicePrices.categoryId, categoryId));
    await tx.delete(servicePrices).where(group);
    if (entries.length > 0) {
      await tx
        .insert(servicePrices)
        .values(entries.map((entry) => ({ serviceId, categoryId, fuel: entry.fuel, pricePaise: entry.pricePaise })));
    }
    return selectPriceRows(tx, group);
  });
  updateTag(SERVICE_PRICES_TAG);
  return { status: "saved", prices, fuels: groupFuels(catalogue, categoryId, service) };
}

type Reader = Pick<Database, "select">;

/** The price rows (all, or those matching `where`), in a fixed order. */
function selectPriceRows(db: Reader, where?: ReturnType<typeof and>): Promise<ServicePrice[]> {
  return db
    .select({
      serviceId: servicePrices.serviceId,
      categoryId: servicePrices.categoryId,
      fuel: servicePrices.fuel,
      pricePaise: servicePrices.pricePaise,
    })
    .from(servicePrices)
    .where(where)
    .orderBy(asc(servicePrices.serviceId), asc(servicePrices.categoryId), asc(servicePrices.fuel));
}
