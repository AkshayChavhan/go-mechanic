import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { vehicleCategories, vehicleMakes, vehicleModels } from "@/server/db/schema";
import { seedVehicleCatalogue } from "@/server/db/seed";
import { draftCatalogue } from "@/server/db/vehicle-seed-data";

import { readVehicleCatalogue, VEHICLE_CATALOGUE_TAG } from "./vehicles";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14 saw the 10-second hook limit time out under load). Database test
// files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// getDatabase is swapped for an in-memory PGlite (migrated and seeded, like
// the real one), and next/cache for spies: cacheTag and cacheLife only work
// inside a Next.js render. "use cache" does nothing outside Next.js, so every
// call here really reads.
vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  getDatabase: vi.fn(),
}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn(), updateTag: vi.fn() }));

let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});
afterAll(async () => {
  await closeDatabase(db);
});

/** Empties the catalogue (models first: the brands refuse to go while they have models). */
async function emptyCatalogue() {
  await db.delete(vehicleModels);
  await db.delete(vehicleMakes);
  await db.delete(vehicleCategories);
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getDatabase).mockResolvedValue(db);
  // Back to the draft catalogue, whatever the last test changed.
  await emptyCatalogue();
  await seedVehicleCatalogue(db);
});

describe("readVehicleCatalogue", () => {
  test("gives the draft catalogue back, every list in the draft's order", async () => {
    expect(await readVehicleCatalogue()).toEqual(draftCatalogue);
  });

  test("has Honda once under cars and once under two-wheelers, each with its own models", async () => {
    const { makes } = await readVehicleCatalogue();
    const hondas = makes.filter((make) => make.name.en === "Honda");
    expect(hondas.map((make) => [make.id, make.kind])).toEqual([
      ["car-honda", "car"],
      ["two-wheeler-honda", "two-wheeler"],
    ]);
    expect(hondas[1]!.models.map((model) => model.id)).toContain("two-wheeler-honda-activa");
  });

  test("leaves out a hidden model, a hidden brand, and a brand whose models are all hidden", async () => {
    await db.update(vehicleModels).set({ listed: false }).where(eq(vehicleModels.id, "car-honda-jazz"));
    await db.update(vehicleMakes).set({ listed: false }).where(eq(vehicleMakes.id, "car-nissan"));
    await db.update(vehicleModels).set({ listed: false }).where(eq(vehicleModels.makeId, "two-wheeler-ather"));

    const { makes } = await readVehicleCatalogue();
    const ids = makes.map((make) => make.id);
    expect(ids).not.toContain("car-nissan");
    expect(ids).not.toContain("two-wheeler-ather");
    const honda = makes.find((make) => make.id === "car-honda");
    expect(honda?.models.map((model) => model.id)).not.toContain("car-honda-jazz");
  });

  test("orders by position, as the owner will set it", async () => {
    await db.update(vehicleMakes).set({ position: 0 }).where(eq(vehicleMakes.id, "car-nissan"));
    const { makes } = await readVehicleCatalogue();
    expect(makes[0]!.id).toBe("car-nissan");
  });

  test("gives a model's fuels as a list", async () => {
    const { makes } = await readVehicleCatalogue();
    const nexon = makes.flatMap((make) => make.models).find((model) => model.id === "car-tata-nexon");
    expect(nexon?.fuels).toEqual(["petrol", "diesel", "cng", "electric"]);
  });

  test("gives empty lists for an empty catalogue, without throwing", async () => {
    await emptyCatalogue();
    expect(await readVehicleCatalogue()).toEqual({ categories: [], makes: [] });
  });

  test("is cached under its own tag for the longest time", async () => {
    await readVehicleCatalogue();
    expect(cacheTag).toHaveBeenCalledWith(VEHICLE_CATALOGUE_TAG);
    expect(VEHICLE_CATALOGUE_TAG).toBe("vehicle-catalogue");
    expect(cacheLife).toHaveBeenCalledWith("max");
  });
});
