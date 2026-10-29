import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { FUELS, VEHICLE_KINDS } from "@/domain/vehicles";

import { lockPathFor } from "./folder-lock";
import { closeDatabase, createDatabase, type Database } from "./index";
import { fuel, garageSettings, vehicleCategories, vehicleKind, vehicleMakes, vehicleModels } from "./schema";
import { seedVehicleCatalogue } from "./seed";
import { draftCatalogue } from "./vehicle-seed-data";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14 saw the 10-second hook limit time out under load). Database test
// files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// One in-memory database for the whole file, put back to the draft catalogue
// before every test. Two tests open databases of their own, because a second
// database is what they check: one compares two databases' ids, the other
// closes and reopens a database in a folder, as `npm run dev` does.
let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});

afterAll(async () => {
  await closeDatabase(db);
});

/** Deletes every catalogue row (models first: brands and groups refuse to go while models point to them). */
async function emptyCatalogue(database: Database) {
  await database.delete(vehicleModels);
  await database.delete(vehicleMakes);
  await database.delete(vehicleCategories);
}

beforeEach(async () => {
  await emptyCatalogue(db);
  await seedVehicleCatalogue(db);
});

/** The Postgres error behind a failed query: its code and the constraint it broke. */
async function violation(query: Promise<unknown>): Promise<{ code?: string; constraint?: string }> {
  const error = await query.then(
    () => {
      throw new Error("expected the query to fail");
    },
    (failure: unknown) => failure,
  );
  // Only a failed query counts; anything else is a bug in the test.
  if (!(error instanceof DrizzleQueryError)) throw error;
  const { code, constraint } = error.cause as { code?: string; constraint?: string };
  return { code, constraint };
}

/**
 * Every id in each catalogue table, sorted, plus the model rows without their
 * timestamps (two databases seeded a moment apart differ only there).
 */
async function snapshot(database: Database) {
  const sortIds = (rows: { id: string }[]) => rows.map((row) => row.id).sort();
  const { id, makeId, categoryId, kind, name, fuels, position, listed } = vehicleModels;
  return {
    categories: sortIds(await database.select({ id: vehicleCategories.id }).from(vehicleCategories)),
    makes: sortIds(await database.select({ id: vehicleMakes.id }).from(vehicleMakes)),
    models: await database
      .select({ id, makeId, categoryId, kind, name, fuels, position, listed })
      .from(vehicleModels)
      .orderBy(id),
  };
}

const draftModelCount = draftCatalogue.makes.reduce((count, make) => count + make.models.length, 0);

describe("the catalogue's enums", () => {
  test("list the vehicle kinds exactly as the app does", () => {
    expect(vehicleKind.enumValues).toEqual([...VEHICLE_KINDS]);
  });

  test("list the fuels exactly as the app does, in the picker's order", () => {
    expect(fuel.enumValues).toEqual([...FUELS]);
  });
});

describe("the catalogue's tables", () => {
  // Rows with ids of their own ("test-..."), next to the draft catalogue.
  beforeEach(async () => {
    await db.insert(vehicleCategories).values([
      { id: "test-car-group", kind: "car", name: { en: "Test car group" }, position: 100 },
      { id: "test-scooter-group", kind: "two-wheeler", name: { en: "Test scooter group" }, position: 101 },
    ]);
    await db.insert(vehicleMakes).values([
      { id: "car-test", kind: "car", name: { en: "Test cars" }, position: 100 },
      { id: "two-wheeler-test", kind: "two-wheeler", name: { en: "Test two-wheelers" }, position: 100 },
    ]);
  });

  /** A valid car model for the test brand, with some fields changed. */
  const carModel = (changes: Partial<typeof vehicleModels.$inferInsert> = {}) => ({
    id: "car-test-one",
    makeId: "car-test",
    categoryId: "test-car-group",
    kind: "car" as const,
    name: { en: "One" },
    fuels: ["petrol" as const],
    position: 1,
    ...changes,
  });

  test("keep a model's fuels as a list of fuels", async () => {
    await db.insert(vehicleModels).values(carModel({ fuels: ["petrol", "cng"] }));
    const [row] = await db.select().from(vehicleModels).where(eq(vehicleModels.id, "car-test-one"));
    expect(row?.fuels).toEqual(["petrol", "cng"]);
    expect(row?.listed).toBe(true);
  });

  test("refuse a model whose kind isn't its brand's", async () => {
    const model = carModel({ makeId: "two-wheeler-test", id: "two-wheeler-test-one" });
    expect(await violation(db.insert(vehicleModels).values(model))).toEqual({
      code: "23503", // foreign_key_violation
      constraint: "vehicle_models_make_kind_fkey",
    });
  });

  test("refuse a car model in a two-wheeler price group", async () => {
    expect(await violation(db.insert(vehicleModels).values(carModel({ categoryId: "test-scooter-group" })))).toEqual({
      code: "23503",
      constraint: "vehicle_models_category_kind_fkey",
    });
  });

  test("refuse a model with no fuels", async () => {
    expect(await violation(db.insert(vehicleModels).values(carModel({ fuels: [] })))).toEqual({
      code: "23514", // check_violation
      constraint: "vehicle_models_has_fuels",
    });
  });

  test("refuse a blank English name, and a name with no English at all", async () => {
    expect(await violation(db.insert(vehicleModels).values(carModel({ name: { en: "  " } })))).toEqual({
      code: "23514",
      constraint: "vehicle_models_english_name",
    });
    const noEnglish = { hi: "एक" } as unknown as { en: string };
    expect(
      await violation(
        db.insert(vehicleMakes).values({ id: "car-nameless", kind: "car", name: noEnglish, position: 1 }),
      ),
    ).toEqual({ code: "23514", constraint: "vehicle_makes_english_name" });
  });

  test("refuse to delete a brand that still has models", async () => {
    await db.insert(vehicleModels).values(carModel());
    // ON DELETE RESTRICT answers with restrict_violation (23001), not the
    // foreign_key_violation (23503) an insert gets.
    expect(await violation(db.delete(vehicleMakes).where(eq(vehicleMakes.id, "car-test")))).toEqual({
      code: "23001",
      constraint: "vehicle_models_make_kind_fkey",
    });
  });
});

describe("seeding the catalogue", () => {
  test("a new database holds every draft price group, brand and model", async () => {
    const fresh = await createDatabase({ driver: "pglite", dataDir: null });
    try {
      const { categories, makes, models } = await snapshot(fresh);
      expect(categories).toEqual(draftCatalogue.categories.map((category) => category.id).sort());
      expect(makes).toEqual(draftCatalogue.makes.map((make) => make.id).sort());
      expect(models).toHaveLength(draftModelCount);
      const city = models.find((model) => model.id === "car-honda-city");
      expect(city).toMatchObject({ makeId: "car-honda", kind: "car", categoryId: "sedan", listed: true });

      // Each build worker seeds its own database, so a second one must give
      // every row the same id.
      expect(await snapshot(fresh)).toEqual(await snapshot(db));
    } finally {
      await closeDatabase(fresh);
    }
  });

  test("seeding again adds nothing and changes nothing", async () => {
    const before = await snapshot(db);
    await seedVehicleCatalogue(db);
    expect(await snapshot(db)).toEqual(before);
  });

  test("keeps the owner's edits and hidden rows, and puts back a draft row that's missing", async () => {
    await db.update(vehicleModels).set({ name: { en: "City e:HEV" } }).where(eq(vehicleModels.id, "car-honda-city"));
    await db.update(vehicleModels).set({ listed: false }).where(eq(vehicleModels.id, "car-honda-jazz"));
    await db.delete(vehicleModels).where(eq(vehicleModels.id, "car-honda-amaze"));

    await seedVehicleCatalogue(db);

    const rows = await db.select().from(vehicleModels).where(eq(vehicleModels.makeId, "car-honda"));
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get("car-honda-city")?.name).toEqual({ en: "City e:HEV" });
    expect(byId.get("car-honda-jazz")?.listed).toBe(false);
    expect(byId.get("car-honda-amaze")).toMatchObject({ name: { en: "Amaze" }, listed: true });
  });

  test("checks the catalogue first: a model with no fuels throws and nothing is written", async () => {
    const [first, ...rest] = draftCatalogue.makes;
    const broken = {
      ...draftCatalogue,
      makes: [
        { ...first!, models: [...first!.models, { id: `${first!.id}-new`, name: { en: "New" }, categoryId: "suv", fuels: [] }] },
        ...rest,
      ],
    };
    await expect(seedVehicleCatalogue(db, broken)).rejects.toThrow("The seed vehicle catalogue is invalid");
    const [row] = await db.select().from(vehicleModels).where(eq(vehicleModels.id, `${first!.id}-new`));
    expect(row).toBeUndefined();
  });
});

describe("a local database in a folder (what npm run dev uses)", () => {
  let dataDir: string;

  beforeAll(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "gomechanic-catalogue-"));
  });
  afterAll(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(lockPathFor(dataDir), { force: true });
  });

  test("gets the catalogue when it's opened again, even though it already has the garage", async () => {
    // The state of every local database made before task 17: the garage is
    // there, the catalogue tables are empty. seedGarage stops early on such a
    // database, so only createDatabase's own seedVehicleCatalogue call can
    // fill them.
    const before = await createDatabase({ driver: "pglite", dataDir });
    try {
      await emptyCatalogue(before);
      expect(await before.$count(garageSettings)).toBe(1);
      expect(await before.$count(vehicleModels)).toBe(0);
    } finally {
      await closeDatabase(before);
    }

    const after = await createDatabase({ driver: "pglite", dataDir });
    try {
      expect(await after.$count(vehicleCategories)).toBe(draftCatalogue.categories.length);
      expect(await after.$count(vehicleMakes)).toBe(draftCatalogue.makes.length);
      expect(await after.$count(vehicleModels)).toBe(draftModelCount);
    } finally {
      await closeDatabase(after);
    }
  });
});
