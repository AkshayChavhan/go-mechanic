import { eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { FUELS, VEHICLE_KINDS } from "@/domain/vehicles";

import { closeDatabase, createDatabase, type Database } from "./index";
import { fuel, vehicleCategories, vehicleKind, vehicleMakes, vehicleModels } from "./schema";

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
