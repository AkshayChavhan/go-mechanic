// The garage's services and packages, their prices, and the one rule that
// works out what a vehicle pays: priceFor().
//
// Pure logic: no Next.js, React or database imports. The database stores the
// services and the real prices (src/server/db/schema.ts), the data-access
// layer reads them (src/server/dal/services.ts), and the pages, the price
// finder and later the booking form (task 23) and estimates (task 34) all
// price through the functions below.
//
// A price belongs to a service, a price group (a vehicle_categories row:
// hatchback, sedan, scooter...) and a fuel. A row with no fuel prices every
// fuel the service covers; a row for one fuel wins over it. Money is integer
// paise (₹1 = 100 paise), shown with formatRupees().

import type { LocalizedText } from "@/i18n/localized-text";

import { type Fuel, isTextId, type VehicleCategory, type VehicleKind } from "./vehicles";

/** A service (brakes, AC...) or a package (Basic, Standard, Comprehensive). */
export const SERVICE_KINDS = ["service", "package"] as const;

export type ServiceKind = (typeof SERVICE_KINDS)[number];

export type Service = {
  /**
   * Made from the name and never changed once saved: "periodic-service",
   * "car-basic". A service's id is its page address (/services/brakes), so
   * lowercase words and hyphens only, never a dot.
   */
  id: string;
  kind: ServiceKind;
  name: LocalizedText;
  /** One line: what it is, in plain words. */
  summary: LocalizedText;
  /** Cars, two-wheelers or both. A package is for exactly one. */
  vehicleKinds: readonly VehicleKind[];
  /** The fuels it's offered for: engine work leaves out electric. */
  fuels: readonly Fuel[];
  /** What's included, in order. At least one. */
  included: readonly LocalizedText[];
  /** "Signs you need it". Packages have none. */
  signs: readonly LocalizedText[];
  /** True when the garage gives a price only after seeing the vehicle (denting, engine...). */
  pricedAfterInspection: boolean;
};

/** One price: a service, a price group, a fuel (null: every fuel) and the amount. */
export type ServicePrice = {
  serviceId: string;
  categoryId: string;
  fuel: Fuel | null;
  pricePaise: number;
};

/**
 * The vehicle a price is for: its kind, its model's price group and its fuel.
 * Not a model id, so a vehicle whose model is hidden later still gets a price.
 */
export type PricedVehicle = {
  kind: VehicleKind;
  categoryId: string;
  fuel: Fuel;
};

export type PriceResult =
  | { status: "price"; paise: number }
  /** The garage prices it after seeing the vehicle. */
  | { status: "on-inspection" }
  /** Offered, but the owner hasn't given a price for this group and fuel yet. */
  | { status: "no-price" }
  /** Not done for this kind of vehicle or this fuel. */
  | { status: "not-offered" };

/** The address of a service's page. */
export function servicePath(id: string): `/services/${string}` {
  return `/services/${id}`;
}

/** The row that prices this fuel in this group: the fuel's own row, else the every-fuel row. */
function findPrice(
  service: Service,
  prices: readonly ServicePrice[],
  categoryId: string,
  fuel: Fuel,
): ServicePrice | undefined {
  let everyFuel: ServicePrice | undefined;
  for (const row of prices) {
    if (row.serviceId !== service.id || row.categoryId !== categoryId) continue;
    if (row.fuel === fuel) return row;
    if (row.fuel === null) everyFuel = row;
  }
  return everyFuel;
}

/** What `vehicle` pays for `service`, or why there's no number. */
export function priceFor(service: Service, prices: readonly ServicePrice[], vehicle: PricedVehicle): PriceResult {
  if (!service.vehicleKinds.includes(vehicle.kind) || !service.fuels.includes(vehicle.fuel)) {
    return { status: "not-offered" };
  }
  if (service.pricedAfterInspection) return { status: "on-inspection" };
  const row = findPrice(service, prices, vehicle.categoryId, vehicle.fuel);
  return row ? { status: "price", paise: row.pricePaise } : { status: "no-price" };
}

/**
 * The lowest price any vehicle pays for `service` ("From ₹…" in a list), or
 * null when it has no price. Works through every priced group and covered
 * fuel with the same rule as priceFor(), so an every-fuel row that the
 * fuels' own rows all replace never counts.
 */
export function fromPrice(service: Service, prices: readonly ServicePrice[]): number | null {
  if (service.pricedAfterInspection) return null;
  const groups = new Set(prices.filter((row) => row.serviceId === service.id).map((row) => row.categoryId));
  let lowest: number | null = null;
  for (const categoryId of groups) {
    for (const fuel of service.fuels) {
      const row = findPrice(service, prices, categoryId, fuel);
      if (row && (lowest === null || row.pricePaise < lowest)) lowest = row.pricePaise;
    }
  }
  return lowest;
}

// --- Checks ------------------------------------------------------------------

/**
 * One thing wrong with the services or their prices: a code and what it's
 * about (a service id, or "service/group/fuel" for a price row), so the admin
 * screens (task 39) can show a message next to the right row.
 */
export type ServiceProblem = {
  problem:
    | "bad-id"
    | "duplicate-id"
    | "no-vehicle-kinds"
    | "repeated-vehicle-kind"
    | "package-vehicle-kinds"
    | "no-fuels"
    | "repeated-fuel"
    | "no-included"
    | "blank-name"
    | "blank-summary"
    | "blank-item"
    | "unknown-service"
    | "unknown-category"
    | "category-kind"
    | "fuel-not-covered"
    | "duplicate-price"
    | "bad-price";
  id: string;
};

/** How a price row is named in a problem: "brakes/hatchback/petrol". */
function priceKey(row: ServicePrice): string {
  return `${row.serviceId}/${row.categoryId}/${row.fuel ?? "every-fuel"}`;
}

/**
 * Everything wrong with `services` and `prices`, checked against the price
 * groups. An empty list means they can be saved.
 */
export function checkServices(
  services: readonly Service[],
  prices: readonly ServicePrice[],
  categories: readonly VehicleCategory[],
): ServiceProblem[] {
  const problems: ServiceProblem[] = [];
  const report = (problem: ServiceProblem["problem"], id: string) => problems.push({ problem, id });
  // English is required; other languages are optional (localize() falls back).
  const blank = (text: LocalizedText) => text.en.trim() === "";

  const byId = new Map<string, Service>();
  for (const service of services) {
    if (!isTextId(service.id)) report("bad-id", service.id);
    if (byId.has(service.id)) report("duplicate-id", service.id);
    byId.set(service.id, service);

    if (service.vehicleKinds.length === 0) report("no-vehicle-kinds", service.id);
    if (new Set(service.vehicleKinds).size !== service.vehicleKinds.length) {
      report("repeated-vehicle-kind", service.id);
    }
    if (service.kind === "package" && service.vehicleKinds.length > 1) report("package-vehicle-kinds", service.id);
    if (service.fuels.length === 0) report("no-fuels", service.id);
    if (new Set(service.fuels).size !== service.fuels.length) report("repeated-fuel", service.id);
    if (service.included.length === 0) report("no-included", service.id);

    if (blank(service.name)) report("blank-name", service.id);
    if (blank(service.summary)) report("blank-summary", service.id);
    if ([...service.included, ...service.signs].some(blank)) report("blank-item", service.id);
  }

  const categoryKinds = new Map(categories.map((category) => [category.id, category.kind]));
  const seen = new Set<string>();
  for (const row of prices) {
    const key = priceKey(row);
    if (seen.has(key)) report("duplicate-price", key);
    seen.add(key);

    const service = byId.get(row.serviceId);
    const kind = categoryKinds.get(row.categoryId);
    if (!service) report("unknown-service", key);
    else if (kind === undefined) report("unknown-category", key);
    else if (!service.vehicleKinds.includes(kind)) report("category-kind", key);
    else if (row.fuel !== null && !service.fuels.includes(row.fuel)) report("fuel-not-covered", key);

    if (!Number.isSafeInteger(row.pricePaise) || row.pricePaise <= 0) report("bad-price", key);
  }

  return problems;
}
