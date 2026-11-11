import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { servicePrices, services } from "@/server/db/schema";
import { seedServices } from "@/server/db/seed";
import { draftServices } from "@/server/db/service-seed-data";

import { readServicePrices, readServices, SERVICE_PRICES_TAG, SERVICES_TAG, serviceIdsToBuild } from "./services";

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

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getDatabase).mockResolvedValue(db);
  // Back to the draft services and no prices, whatever the last test changed.
  await db.delete(servicePrices);
  await db.delete(services);
  await seedServices(db);
});

describe("readServices", () => {
  test("gives the draft services and packages back, in the draft's order", async () => {
    expect(await readServices()).toEqual(draftServices);
  });

  test("leaves out a hidden service", async () => {
    await db.update(services).set({ listed: false }).where(eq(services.id, "battery"));
    expect((await readServices()).map((service) => service.id)).not.toContain("battery");
  });

  test("gives an empty list for an empty table, without throwing", async () => {
    await db.delete(services);
    expect(await readServices()).toEqual([]);
  });

  test("is cached under its own tag for the longest time", async () => {
    await readServices();
    expect(SERVICES_TAG).toBe("services");
    expect(cacheTag).toHaveBeenCalledWith(SERVICES_TAG);
    expect(cacheLife).toHaveBeenCalledWith("max");
  });
});

describe("serviceIdsToBuild", () => {
  test("lists the seeded services' ids, in order, no package, without opening the database", () => {
    vi.mocked(getDatabase).mockClear();
    expect(serviceIdsToBuild()).toEqual(
      draftServices.filter((service) => service.kind === "service").map((service) => service.id),
    );
    expect(serviceIdsToBuild()).toHaveLength(11);
    expect(getDatabase).not.toHaveBeenCalled();
  });
});

describe("readServicePrices", () => {
  test("is empty today: the seed writes no prices", async () => {
    expect(await readServicePrices()).toEqual([]);
  });

  test("gives the real prices, an every-fuel row as fuel null", async () => {
    await db.insert(servicePrices).values([
      { serviceId: "brakes", categoryId: "sedan", fuel: null, pricePaise: 150_000 },
      { serviceId: "brakes", categoryId: "hatchback", fuel: "diesel", pricePaise: 130_000 },
    ]);
    expect(await readServicePrices()).toEqual([
      { serviceId: "brakes", categoryId: "hatchback", fuel: "diesel", pricePaise: 130_000 },
      { serviceId: "brakes", categoryId: "sedan", fuel: null, pricePaise: 150_000 },
    ]);
  });

  test("is cached under its own tag for the longest time", async () => {
    await readServicePrices();
    expect(SERVICE_PRICES_TAG).toBe("service-prices");
    expect(cacheTag).toHaveBeenCalledWith(SERVICE_PRICES_TAG);
    expect(cacheLife).toHaveBeenCalledWith("max");
  });
});
