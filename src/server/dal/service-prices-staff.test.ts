import { updateTag } from "next/cache";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { priceFor } from "@/domain/services";
import { AccessDeniedError } from "@/server/auth/access";
import { getCurrentUser } from "@/server/auth/session";
import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { servicePrices, services } from "@/server/db/schema";
import { draftServices } from "@/server/db/service-seed-data";
import { eq } from "drizzle-orm";

import { listPricesForStaff, readServicePrices, saveGroupPrices } from "./services";

// The staff price editor's read and save (task 39), on a real PGlite.
// Starting and migrating PGlite takes a few seconds, much longer in a full
// run on a busy machine: database test files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  getDatabase: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
// "use cache" does nothing outside Next.js, so the cached reads really read.
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn(), updateTag: vi.fn() }));

type TestUser = { id: string; phoneNumber: string; role: "customer" | "mechanic" | "manager" | "owner" };
const asha: TestUser = { id: "asha", phoneNumber: "+919876500001", role: "customer" };
const mona: TestUser = { id: "mona", phoneNumber: "+919876500003", role: "mechanic" };
const manu: TestUser = { id: "manu", phoneNumber: "+919876500004", role: "manager" };

function logIn(user: TestUser | null) {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
}

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
  await db.delete(servicePrices);
  await db.update(services).set({ listed: true });
  logIn(manu);
});

const periodic = draftServices.find((service) => service.id === "periodic-service")!;
const dieselHatchback = { kind: "car", categoryId: "hatchback", fuel: "diesel" } as const;
const petrolHatchback = { kind: "car", categoryId: "hatchback", fuel: "petrol" } as const;

describe("who may", () => {
  test.each([
    ["logged out", null],
    ["a customer", asha],
    ["a mechanic", mona],
  ])("%s: both functions refuse before opening the database", async (_, user) => {
    logIn(user);
    await expect(listPricesForStaff()).rejects.toThrow(AccessDeniedError);
    await expect(saveGroupPrices("periodic-service", "hatchback", [])).rejects.toThrow(AccessDeniedError);
    expect(getDatabase).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  test("the owner may too", async () => {
    logIn({ id: "olga", phoneNumber: "+919876500009", role: "owner" });
    expect(await saveGroupPrices("periodic-service", "hatchback", [{ fuel: null, pricePaise: 150_000 }])).toMatchObject({
      status: "saved",
    });
  });
});

describe("saveGroupPrices", () => {
  test("saves a group price and a fuel's own price, live at once", async () => {
    const result = await saveGroupPrices("periodic-service", "hatchback", [
      { fuel: null, pricePaise: 150_000 },
      { fuel: "diesel", pricePaise: 180_000 },
    ]);
    expect(result).toEqual({
      status: "saved",
      prices: [
        { serviceId: "periodic-service", categoryId: "hatchback", fuel: "diesel", pricePaise: 180_000 },
        { serviceId: "periodic-service", categoryId: "hatchback", fuel: null, pricePaise: 150_000 },
      ],
    });
    const rows = await readServicePrices();
    expect(priceFor(periodic, rows, dieselHatchback)).toEqual({ status: "price", paise: 180_000 });
    expect(priceFor(periodic, rows, petrolHatchback)).toEqual({ status: "price", paise: 150_000 });
    expect(updateTag).toHaveBeenCalledTimes(1);
    expect(updateTag).toHaveBeenCalledWith("service-prices");
    expect(await listPricesForStaff()).toEqual(rows);
  });

  test("saving the same card again gives the same rows and the same answer", async () => {
    const entries = [{ fuel: null, pricePaise: 150_000 }, { fuel: "diesel", pricePaise: 180_000 }] as const;
    const first = await saveGroupPrices("periodic-service", "hatchback", entries);
    const second = await saveGroupPrices("periodic-service", "hatchback", entries);
    expect(second).toEqual(first);
    expect(await readServicePrices()).toHaveLength(2);
  });

  test("replaces only this service's rows for this group", async () => {
    await saveGroupPrices("periodic-service", "hatchback", [{ fuel: null, pricePaise: 150_000 }, { fuel: "diesel", pricePaise: 180_000 }]);
    await saveGroupPrices("periodic-service", "sedan", [{ fuel: null, pricePaise: 170_000 }]);
    await saveGroupPrices("brakes", "hatchback", [{ fuel: null, pricePaise: 90_000 }]);

    // The group box emptied, diesel kept: only the diesel row stays.
    await saveGroupPrices("periodic-service", "hatchback", [{ fuel: "diesel", pricePaise: 180_000 }]);
    expect(await readServicePrices()).toEqual([
      { serviceId: "brakes", categoryId: "hatchback", fuel: null, pricePaise: 90_000 },
      { serviceId: "periodic-service", categoryId: "hatchback", fuel: "diesel", pricePaise: 180_000 },
      { serviceId: "periodic-service", categoryId: "sedan", fuel: null, pricePaise: 170_000 },
    ]);

    // All blank: no price for the group, the others untouched.
    expect(await saveGroupPrices("periodic-service", "hatchback", [])).toEqual({ status: "saved", prices: [] });
    expect(await readServicePrices()).toHaveLength(2);
  });

  test("a package is priced like a service", async () => {
    expect(await saveGroupPrices("car-basic", "suv", [{ fuel: null, pricePaise: 250_000 }])).toMatchObject({ status: "saved" });
  });

  test("a service priced after an inspection takes no price", async () => {
    expect(await saveGroupPrices("denting-painting", "hatchback", [{ fuel: null, pricePaise: 1_000 }])).toEqual({
      status: "on-inspection",
    });
    expect(await readServicePrices()).toEqual([]);
    expect(updateTag).not.toHaveBeenCalled();
  });

  test.each([
    ["an unknown service", "towing", "hatchback"],
    ["a malformed id", "1; drop", "hatchback"],
    ["an unknown group", "periodic-service", "truck"],
    ["a group of a kind the service doesn't cover", "car-basic", "scooter"],
  ])("%s is not found", async (_, serviceId, categoryId) => {
    expect(await saveGroupPrices(serviceId, categoryId, [{ fuel: null, pricePaise: 1_000 }])).toEqual({ status: "not-found" });
    expect(await readServicePrices()).toEqual([]);
    expect(updateTag).not.toHaveBeenCalled();
  });

  test("a hidden service is not found", async () => {
    await db.update(services).set({ listed: false }).where(eq(services.id, "brakes"));
    expect(await saveGroupPrices("brakes", "hatchback", [{ fuel: null, pricePaise: 1_000 }])).toEqual({ status: "not-found" });
  });

  test("a fuel no model in the group runs on, or a bad amount, saves nothing", async () => {
    // No scooter in the draft catalogue runs on CNG; the package covers CNG.
    expect(await saveGroupPrices("two-wheeler-basic", "scooter", [{ fuel: "cng", pricePaise: 50_000 }])).toEqual({
      status: "problems",
      problems: [{ field: "cng", problem: "fuel-not-offered" }],
    });
    expect(
      await saveGroupPrices("periodic-service", "hatchback", [
        { fuel: null, pricePaise: 150_000 },
        { fuel: "diesel", pricePaise: 0 },
      ]),
    ).toEqual({ status: "problems", problems: [{ field: "diesel", problem: "bad-price" }] });
    expect(await readServicePrices()).toEqual([]);
    expect(updateTag).not.toHaveBeenCalled();
  });
});
