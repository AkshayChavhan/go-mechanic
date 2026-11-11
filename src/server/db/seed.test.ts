import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { closeDatabase, createDatabase, type Database } from "./index";
import { garageSettings, openingHours, slotRules, vehicleCategories, vehicleMakes, vehicleModels } from "./schema";
import { compareWithSeed, ownerSeedData, seedAll } from "./seed";

// Starting and migrating PGlite takes a few seconds, much longer in a full
// run on a busy machine (CLAUDE.md, "Database").
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});
afterAll(async () => {
  await closeDatabase(db);
});

/** Removes every seeded row, children first, then seeds the owner's data again. */
async function emptyDatabase() {
  await db.delete(vehicleModels);
  await db.delete(vehicleMakes);
  await db.delete(vehicleCategories);
  await db.delete(slotRules);
  await db.delete(openingHours);
  await db.delete(garageSettings);
}

beforeEach(async () => {
  await emptyDatabase();
  await seedAll(db);
});

describe("seedAll", () => {
  test("fills an empty database with the garage, its hours, the slot rules and the catalogue", async () => {
    await emptyDatabase();
    await seedAll(db);
    expect(await db.select().from(garageSettings)).toHaveLength(1);
    expect(await db.select().from(openingHours)).toHaveLength(7);
    expect(await db.select().from(slotRules)).toHaveLength(1);
    expect((await db.select().from(vehicleModels)).length).toBeGreaterThan(0);
    expect(await compareWithSeed(db)).toEqual([]);
  });

  test("run again, adds nothing and changes nothing", async () => {
    const models = (await db.select().from(vehicleModels)).length;
    await seedAll(db);
    expect(await db.select().from(garageSettings)).toHaveLength(1);
    expect(await db.select().from(vehicleModels)).toHaveLength(models);
    expect(await compareWithSeed(db)).toEqual([]);
  });

  test("is one transaction: a bad catalogue leaves no garage behind", async () => {
    await emptyDatabase();
    const badCatalogue = { ...ownerSeedData.catalogue, categories: [] };
    await expect(seedAll(db, { ...ownerSeedData, catalogue: badCatalogue })).rejects.toThrow(/catalogue is invalid/);
    expect(await db.select().from(garageSettings)).toEqual([]);
    expect(await db.select().from(slotRules)).toEqual([]);
  });
});

describe("compareWithSeed", () => {
  test("names a slot-rules value that differs from the seed data, and the seed doesn't fix it", async () => {
    await db.update(slotRules).set({ capacity: ownerSeedData.rules.capacity + 1 });
    await seedAll(db);
    expect(await compareWithSeed(db)).toEqual([
      `slot rules: capacity is ${ownerSeedData.rules.capacity + 1}, the seed data says ${ownerSeedData.rules.capacity}`,
    ]);
  });

  test("names a vehicle model whose price group differs", async () => {
    const [model] = await db.select().from(vehicleModels).limit(1);
    const [other] = (await db.select().from(vehicleCategories).where(eq(vehicleCategories.kind, model!.kind))).filter(
      (category) => category.id !== model!.categoryId,
    );
    await db.update(vehicleModels).set({ categoryId: other!.id }).where(eq(vehicleModels.id, model!.id));
    expect(await compareWithSeed(db)).toEqual([
      `vehicle model ${model!.id}: categoryId is "${other!.id}", the seed data says "${model!.categoryId}"`,
    ]);
  });

  test("ignores a hidden model and a model the owner added", async () => {
    const [model] = await db.select().from(vehicleModels).limit(1);
    await db.update(vehicleModels).set({ listed: false }).where(eq(vehicleModels.id, model!.id));
    await db.insert(vehicleModels).values({ ...model!, id: `${model!.makeId}-owner-added`, listed: true });
    expect(await compareWithSeed(db)).toEqual([]);
  });

  test("names changed opening hours, compared as HH:MM", async () => {
    const [day] = await db.select().from(openingHours).limit(1);
    const closed = day!.opens === null;
    await db
      .update(openingHours)
      .set(closed ? { opens: "10:00", closes: "11:00" } : { opens: null, closes: null })
      .where(eq(openingHours.weekday, day!.weekday));
    const differences = await compareWithSeed(db);
    expect(differences).toHaveLength(2);
    expect(differences[0]).toMatch(new RegExp(`^opening hours ${day!.weekday}: opens is`));
  });

  test("a database with no garage and no slot rules reports both as missing", async () => {
    await db.delete(openingHours);
    await db.delete(garageSettings);
    await db.delete(slotRules);
    expect(await compareWithSeed(db)).toEqual(expect.arrayContaining(["garage: missing", "slot rules: missing"]));
  });
});
