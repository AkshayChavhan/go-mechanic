import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { asc, eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { SERVICE_KINDS } from "@/domain/services";

import { lockPathFor } from "./folder-lock";
import { closeDatabase, createDatabase, type Database } from "./index";
import { garageSettings, serviceKind, servicePrices, services } from "./schema";
import { seedServices } from "./seed";
import { draftServices } from "./service-seed-data";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14 saw the 10-second hook limit time out under load). Database test
// files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// One in-memory database for the whole file. Each test starts with one test
// service of its own and no prices; the seeded services stay as they are.
let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});

afterAll(async () => {
  await closeDatabase(db);
});

beforeEach(async () => {
  await db.delete(servicePrices);
  await db.delete(services).where(eq(services.id, "test-service"));
  await db.insert(services).values(serviceRow());
});

function serviceRow(overrides: Partial<typeof services.$inferInsert> = {}): typeof services.$inferInsert {
  return {
    id: "test-service",
    kind: "service",
    name: { en: "Test service" },
    summary: { en: "A service for the tests." },
    vehicleKinds: ["car", "two-wheeler"],
    fuels: ["petrol", "diesel"],
    included: [{ en: "One check" }],
    signs: [{ en: "One sign" }],
    position: 999,
    ...overrides,
  };
}

function priceRow(overrides: Partial<typeof servicePrices.$inferInsert> = {}): typeof servicePrices.$inferInsert {
  return { serviceId: "test-service", categoryId: "hatchback", fuel: null, pricePaise: 150_000, ...overrides };
}

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

const checkViolation = (constraint: string) => ({ code: "23514", constraint }); // check_violation

describe("the services table", () => {
  test("lists the service kinds exactly as the app does", () => {
    expect(serviceKind.enumValues).toEqual([...SERVICE_KINDS]);
  });

  test("keeps the lists as lists and the texts as objects", async () => {
    const [row] = await db.select().from(services).where(eq(services.id, "test-service"));
    expect(row).toMatchObject({
      vehicleKinds: ["car", "two-wheeler"],
      fuels: ["petrol", "diesel"],
      included: [{ en: "One check" }],
      signs: [{ en: "One sign" }],
      pricedAfterInspection: false,
      listed: true,
    });
  });

  const broken: [string, Partial<typeof services.$inferInsert>][] = [
    ["services_has_vehicle_kinds", { vehicleKinds: [] }],
    ["services_package_one_kind", { kind: "package", vehicleKinds: ["car", "two-wheeler"] }],
    ["services_has_fuels", { fuels: [] }],
    ["services_english_name", { name: { en: "  " } }],
    ["services_english_name", { name: { hi: "सेवा" } as never }],
    ["services_english_summary", { summary: { en: "" } }],
    ["services_included_list", { included: [] }],
    ["services_included_list", { included: { en: "Not a list" } as never }],
    ["services_signs_list", { signs: { en: "Not a list" } as never }],
  ];
  test.each(broken)("refuses a row that breaks %s", async (constraint, overrides) => {
    const row = serviceRow({ id: "broken-service", ...overrides });
    expect(await violation(db.insert(services).values(row))).toEqual(checkViolation(constraint));
  });
});

describe("the service_prices table", () => {
  test("keeps an every-fuel row and a row for one fuel side by side", async () => {
    await db.insert(servicePrices).values([priceRow(), priceRow({ fuel: "petrol", pricePaise: 120_000 })]);
    expect(await db.$count(servicePrices)).toBe(2);
  });

  test("refuses a second every-fuel row for the same service and group (NULLS NOT DISTINCT)", async () => {
    await db.insert(servicePrices).values(priceRow());
    expect(await violation(db.insert(servicePrices).values(priceRow({ pricePaise: 90_000 })))).toEqual({
      code: "23505", // unique_violation
      constraint: "service_prices_service_category_fuel",
    });
  });

  test("refuses a price of 0", async () => {
    expect(await violation(db.insert(servicePrices).values(priceRow({ pricePaise: 0 })))).toEqual(
      checkViolation("service_prices_positive"),
    );
  });

  test("refuses a price for an unknown price group or service", async () => {
    expect(await violation(db.insert(servicePrices).values(priceRow({ categoryId: "truck" })))).toEqual({
      code: "23503", // foreign_key_violation
      constraint: "service_prices_category_id_vehicle_categories_id_fk",
    });
    expect(await violation(db.insert(servicePrices).values(priceRow({ serviceId: "towing" })))).toEqual({
      code: "23503",
      constraint: "service_prices_service_id_services_id_fk",
    });
  });

  test("refuses to delete a service that has prices", async () => {
    await db.insert(servicePrices).values(priceRow());
    // ON DELETE RESTRICT answers with restrict_violation (23001), not the
    // foreign_key_violation (23503) an insert gets.
    expect(await violation(db.delete(services).where(eq(services.id, "test-service")))).toEqual({
      code: "23001",
      constraint: "service_prices_service_id_services_id_fk",
    });
  });
});

/** Every seeded service row without its timestamps, in list order. */
async function seededRows(database: Database) {
  const { id, kind, name, summary, vehicleKinds, fuels, included, signs, pricedAfterInspection, position, listed } =
    services;
  const rows = await database
    .select({ id, kind, name, summary, vehicleKinds, fuels, included, signs, pricedAfterInspection, position, listed })
    .from(services)
    .orderBy(asc(services.position));
  return rows.filter((row) => row.id !== "test-service");
}

describe("seeding the services", () => {
  test("a new database holds every draft service and package, in order, and no prices", async () => {
    const rows = await seededRows(db);
    expect(rows.map((row) => row.id)).toEqual(draftServices.map((service) => service.id));
    expect(rows.find((row) => row.id === "engine")).toMatchObject({
      kind: "service",
      fuels: ["petrol", "diesel", "cng"],
      pricedAfterInspection: true,
      listed: true,
    });
    expect(await db.$count(servicePrices)).toBe(0);
  });

  test("seeding again adds nothing and changes nothing", async () => {
    const before = await seededRows(db);
    await seedServices(db);
    expect(await seededRows(db)).toEqual(before);
  });

  test("keeps the owner's edits and hidden rows, and puts back a draft row that's missing", async () => {
    await db.update(services).set({ name: { en: "AC repair" } }).where(eq(services.id, "ac"));
    await db.update(services).set({ listed: false }).where(eq(services.id, "battery"));
    await db.delete(services).where(eq(services.id, "brakes"));

    await seedServices(db);

    const byId = new Map((await seededRows(db)).map((row) => [row.id, row]));
    expect(byId.get("ac")?.name).toEqual({ en: "AC repair" });
    expect(byId.get("battery")?.listed).toBe(false);
    expect(byId.get("brakes")).toMatchObject({ name: { en: "Brakes" }, listed: true });

    // Put the edits back for the other tests.
    await db.update(services).set({ name: { en: "AC" } }).where(eq(services.id, "ac"));
    await db.update(services).set({ listed: true }).where(eq(services.id, "battery"));
  });

  test("checks the services first: a broken one throws and nothing is written", async () => {
    const broken = [...draftServices, { ...draftServices[0]!, id: "new-service", included: [] }];
    await expect(seedServices(db, broken)).rejects.toThrow("The seed services are invalid");
    expect(await db.select().from(services).where(eq(services.id, "new-service"))).toEqual([]);
  });
});

describe("a local database in a folder (what npm run dev uses)", () => {
  let dataDir: string;

  beforeAll(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "gomechanic-services-"));
  });
  afterAll(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(lockPathFor(dataDir), { force: true });
  });

  test("gets the services when it's opened again, even though it already has the garage", async () => {
    // The state of every local database made before task 18: the garage is
    // there, the services table is empty (the migration just made it).
    const before = await createDatabase({ driver: "pglite", dataDir });
    try {
      await before.delete(services);
      expect(await before.$count(garageSettings)).toBe(1);
    } finally {
      await closeDatabase(before);
    }

    const after = await createDatabase({ driver: "pglite", dataDir });
    try {
      expect(await after.$count(services)).toBe(draftServices.length);
    } finally {
      await closeDatabase(after);
    }
  });
});
