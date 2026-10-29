import { eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { SERVICE_KINDS } from "@/domain/services";

import { closeDatabase, createDatabase, type Database } from "./index";
import { serviceKind, servicePrices, services } from "./schema";

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
