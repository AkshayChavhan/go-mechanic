import { eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { FUELS, VEHICLE_KINDS } from "@/domain/vehicles";

import { closeDatabase, createDatabase, type Database } from "./index";
import { fuel, vehicleCategories, vehicleKind, vehicleMakes, vehicleModels } from "./schema";
import { seedVehicleCatalogue } from "./seed";
import { draftCatalogue } from "./vehicle-seed-data";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14 saw the 10-second hook limit time out under load). Database test
// files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

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

describe("the catalogue's enums", () => {
  test("list the vehicle kinds exactly as the app does", () => {
    expect(vehicleKind.enumValues).toEqual([...VEHICLE_KINDS]);
  });

  test("list the fuels exactly as the app does, in the picker's order", () => {
    expect(fuel.enumValues).toEqual([...FUELS]);
  });
});

describe("the catalogue's tables", () => {
  // Rows with ids of their own ("test-..."), so the draft catalogue the seed
  // puts in doesn't get in the way.
  let db: Database;

  beforeAll(async () => {
    db = await createDatabase({ driver: "pglite", dataDir: null });
  });

  afterAll(async () => {
    await closeDatabase(db);
  });

  beforeEach(async () => {
    await db.delete(vehicleModels).where(eq(vehicleModels.makeId, "car-test"));
    await db.delete(vehicleModels).where(eq(vehicleModels.makeId, "two-wheeler-test"));
    await db.delete(vehicleMakes).where(eq(vehicleMakes.id, "car-test"));
    await db.delete(vehicleMakes).where(eq(vehicleMakes.id, "two-wheeler-test"));
    await db.delete(vehicleCategories).where(eq(vehicleCategories.id, "test-car-group"));
    await db.delete(vehicleCategories).where(eq(vehicleCategories.id, "test-scooter-group"));

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

/**
 * Every id in each catalogue table, sorted, plus the model rows without their
 * timestamps (two databases seeded a moment apart differ only there).
 */
async function snapshot(db: Database) {
  const sortIds = (rows: { id: string }[]) => rows.map((row) => row.id).sort();
  const { id, makeId, categoryId, kind, name, fuels, position, listed } = vehicleModels;
  return {
    categories: sortIds(await db.select({ id: vehicleCategories.id }).from(vehicleCategories)),
    makes: sortIds(await db.select({ id: vehicleMakes.id }).from(vehicleMakes)),
    models: await db
      .select({ id, makeId, categoryId, kind, name, fuels, position, listed })
      .from(vehicleModels)
      .orderBy(id),
  };
}

const draftModelCount = draftCatalogue.makes.reduce((count, make) => count + make.models.length, 0);

describe("seeding the catalogue", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createDatabase({ driver: "pglite", dataDir: null });
  });

  afterAll(async () => {
    await closeDatabase(db);
  });

  test("a new database holds every draft price group, brand and model", async () => {
    const { categories, makes, models } = await snapshot(db);
    expect(categories).toEqual(draftCatalogue.categories.map((category) => category.id).sort());
    expect(makes).toEqual(draftCatalogue.makes.map((make) => make.id).sort());
    expect(models).toHaveLength(draftModelCount);
    const city = models.find((model) => model.id === "car-honda-city");
    expect(city).toMatchObject({ makeId: "car-honda", kind: "car", categoryId: "sedan", listed: true });
  });

  test("two separate databases give every row the same id (each build worker seeds its own)", async () => {
    const other = await createDatabase({ driver: "pglite", dataDir: null });
    try {
      expect(await snapshot(other)).toEqual(await snapshot(db));
    } finally {
      await closeDatabase(other);
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
