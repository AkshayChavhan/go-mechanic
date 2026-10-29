// The vehicle catalogue, read from the database.
//
// The rules of this folder (src/server/dal/, the "data-access layer"; see
// garage.ts):
// 1. It is the only code that queries the database.
// 2. Public reads need no check: anyone can see which brands and models the
//    garage works on. readVehicleCatalogue() is cached, so the pages that
//    show it stay prebuilt.
// 3. Writes come later: task 39 adds the catalogue's saves, after task 16's
//    role checks, and they call updateTag(VEHICLE_CATALOGUE_TAG).

import "server-only";

import { asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import type { VehicleCatalogue, VehicleModel } from "@/domain/vehicles";
import { getDatabase } from "@/server/db";
import { vehicleCategories, vehicleMakes, vehicleModels } from "@/server/db/schema";

/** The cache tag on every cached read of the catalogue. A save refreshes it. */
export const VEHICLE_CATALOGUE_TAG = "vehicle-catalogue";

/**
 * The listed catalogue, every list in display order: the price groups, and
 * the brands with their models inside. Hidden brands and models are left out,
 * and so is a brand whose models are all hidden (nothing to pick under it).
 *
 * Cached ('use cache') with the "max" lifetime, like readGarage(): the
 * catalogue changes only when the owner saves it. An empty catalogue (a
 * staging database not seeded yet) gives empty lists instead of an error:
 * the home page's brands row is optional, and a page that needs a vehicle
 * decides what to show without one.
 */
export async function readVehicleCatalogue(): Promise<VehicleCatalogue> {
  "use cache";
  cacheTag(VEHICLE_CATALOGUE_TAG);
  cacheLife("max");

  const db = await getDatabase();
  const [categoryRows, makeRows, modelRows] = await Promise.all([
    db
      .select({ id: vehicleCategories.id, kind: vehicleCategories.kind, name: vehicleCategories.name })
      .from(vehicleCategories)
      .orderBy(asc(vehicleCategories.position), asc(vehicleCategories.id)),
    db
      .select({ id: vehicleMakes.id, kind: vehicleMakes.kind, name: vehicleMakes.name })
      .from(vehicleMakes)
      .where(eq(vehicleMakes.listed, true))
      .orderBy(asc(vehicleMakes.position), asc(vehicleMakes.id)),
    db
      .select({
        id: vehicleModels.id,
        makeId: vehicleModels.makeId,
        name: vehicleModels.name,
        categoryId: vehicleModels.categoryId,
        fuels: vehicleModels.fuels,
      })
      .from(vehicleModels)
      .where(eq(vehicleModels.listed, true))
      .orderBy(asc(vehicleModels.position), asc(vehicleModels.id)),
  ]);

  const modelsByMake = new Map<string, VehicleModel[]>();
  for (const { makeId, ...model } of modelRows) {
    const models = modelsByMake.get(makeId) ?? [];
    models.push(model);
    modelsByMake.set(makeId, models);
  }

  return {
    categories: categoryRows,
    makes: makeRows
      .map((make) => ({ ...make, models: modelsByMake.get(make.id) ?? [] }))
      .filter((make) => make.models.length > 0),
  };
}
