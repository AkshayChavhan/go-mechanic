import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { VehicleInput } from "@/domain/customer-vehicles";
import { fixedClock } from "@/lib/clock";
import { AccessDeniedError } from "@/server/auth/access";
import { getCurrentUser } from "@/server/auth/session";
import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import { customerVehicles, users, vehicleModels } from "@/server/db/schema";

import { addMyVehicle, listMyVehicles, readMyVehicle, removeMyVehicle, updateMyVehicle } from "./customer-vehicles";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14 saw the 10-second hook limit time out under load). Database test
// files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// getDatabase is swapped for an in-memory PGlite (migrated and seeded with
// the draft catalogue, like the real one), and next/cache for spies: the
// catalogue read calls cacheTag and cacheLife, which only work inside
// Next.js. Its "use cache" line does nothing here, so every read is fresh.
vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  getDatabase: vi.fn(),
}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn(), updateTag: vi.fn() }));
// Who is logged in: Asha, unless a test says otherwise.
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));

const asha = { id: "asha", phoneNumber: "+919876500001", role: "customer" as const };
const ravi = { id: "ravi", phoneNumber: "+919876500002", role: "customer" as const };

/** Logs `user` in, as far as the data-access layer can tell. */
function logIn(user: typeof asha | null) {
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
  logIn(asha);
  await db.delete(customerVehicles);
  await db.delete(users);
  await db.update(vehicleModels).set({ listed: true });
  await db.insert(users).values(
    [asha, ravi].map(({ id, phoneNumber }) => ({ id, name: "", email: `${phoneNumber.slice(1)}@phone.invalid`, phoneNumber })),
  );
});

// 29 Oct 2026, 15:30 India time.
const clock = fixedClock(new Date("2026-10-29T10:00:00Z"));

/** A valid form post: a petrol Honda City, typed with spaces. */
function input(changes: Partial<VehicleInput> = {}): VehicleInput {
  return {
    modelId: "car-honda-city",
    fuel: "petrol",
    registration: "mh 12 ab 1234",
    pucExpiresOn: "2027-03-12",
    insuranceExpiresOn: "",
    ...changes,
  };
}

/** Adds a vehicle as `user` and returns its id. */
async function addAs(user: typeof asha, changes: Partial<VehicleInput> = {}): Promise<string> {
  logIn(user);
  const result = await addMyVehicle(input(changes), clock);
  if (result.status !== "saved") throw new Error(`expected a save, got ${JSON.stringify(result)}`);
  logIn(asha);
  return result.id;
}

/** The stored row, read straight from the database. */
async function storedRow(id: string) {
  const [row] = await db.select().from(customerVehicles).where(eq(customerVehicles.id, id));
  return row;
}

const unknownId = "6f1c1f0e-8a7c-4c1e-9d55-0b7a2a8c1e11";

describe("nobody logged in", () => {
  test.each([
    ["listMyVehicles", () => listMyVehicles()],
    ["readMyVehicle", () => readMyVehicle(unknownId)],
    ["addMyVehicle", () => addMyVehicle(input(), clock)],
    ["updateMyVehicle", () => updateMyVehicle(unknownId, input(), clock)],
    ["removeMyVehicle", () => removeMyVehicle(unknownId)],
  ])("%s throws AccessDeniedError before touching the database", async (_name, call) => {
    logIn(null);
    const error = await call().catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(AccessDeniedError);
    expect((error as AccessDeniedError).reason).toBe("signedOut");
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("a bad input still gives AccessDeniedError, not its problems: the check comes first", async () => {
    logIn(null);
    await expect(addMyVehicle(input({ registration: "" }), clock)).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(updateMyVehicle("not-a-uuid", input(), clock)).rejects.toBeInstanceOf(AccessDeniedError);
  });
});

describe("one customer can't reach another's vehicles", () => {
  test("A's list never contains B's vehicles", async () => {
    await addAs(ravi, { registration: "KA01AB0001" });
    const ashas = await addAs(asha, { registration: "MH12AB1234" });
    expect((await listMyVehicles()).map((vehicle) => vehicle.id)).toEqual([ashas]);
  });

  test("A reading B's vehicle gets null, as for an id that doesn't exist", async () => {
    const ravis = await addAs(ravi);
    expect(await readMyVehicle(ravis)).toBeNull();
    expect(await readMyVehicle(unknownId)).toBeNull();
  });

  test("A updating B's vehicle gets not-found, and B's row doesn't change", async () => {
    const ravis = await addAs(ravi);
    const before = await storedRow(ravis);
    expect(await updateMyVehicle(ravis, input({ registration: "DL3CAB0042" }), clock)).toEqual({ status: "not-found" });
    expect(await storedRow(ravis)).toEqual(before);
  });

  test("A removing B's vehicle gets not-found, and B's row stays", async () => {
    const ravis = await addAs(ravi);
    expect(await removeMyVehicle(ravis)).toEqual({ status: "not-found" });
    expect(await storedRow(ravis)).toBeDefined();
  });

  test("an id that isn't a uuid is not found, without a database error", async () => {
    expect(await readMyVehicle("not-a-uuid")).toBeNull();
    expect(await removeMyVehicle("1; drop")).toEqual({ status: "not-found" });
    expect(await updateMyVehicle("abc", input(), clock)).toEqual({ status: "not-found" });
  });
});

describe("addMyVehicle", () => {
  test("saves the vehicle for the logged-in customer, in the compact form", async () => {
    const id = await addAs(asha);
    expect(await storedRow(id)).toMatchObject({
      userId: "asha",
      modelId: "car-honda-city",
      fuel: "petrol",
      registrationNumber: "MH12AB1234",
      pucExpiresOn: "2027-03-12",
      insuranceExpiresOn: null,
      createdAt: clock.now(),
      updatedAt: clock.now(),
    });
  });

  test("an input with problems writes nothing and returns every problem", async () => {
    const result = await addMyVehicle(input({ fuel: "", registration: "MX12AB1234", pucExpiresOn: "2026-02-29" }), clock);
    expect(result).toEqual({
      status: "problems",
      problems: [
        { field: "vehicle", problem: "vehicle-missing" },
        { field: "registration", problem: "registration-unknown-state" },
        { field: "pucExpiresOn", problem: "date-invalid" },
      ],
    });
    expect(await db.$count(customerVehicles)).toBe(0);
  });

  test("a number the customer already saved, typed another way, is a duplicate", async () => {
    await addAs(asha, { registration: "MH 12 AB 1234" });
    expect(await addMyVehicle(input({ registration: "mh-12-ab-1234" }), clock)).toEqual({
      status: "problems",
      problems: [{ field: "registration", problem: "registration-duplicate" }],
    });
    expect(await db.$count(customerVehicles)).toBe(1);
  });

  test("two customers can each save the same number", async () => {
    await addAs(asha);
    await addAs(ravi);
    expect(await db.$count(customerVehicles)).toBe(2);
  });

  test("two adds of one number at once save one row; the other is a duplicate", async () => {
    // The bare database, no transaction: both checks pass, and only the
    // insert's "on conflict do nothing" stops the second row.
    const results = await Promise.all([addMyVehicle(input(), clock), addMyVehicle(input(), clock)]);
    expect(results.map((result) => result.status).sort()).toEqual(["problems", "saved"]);
    expect(await db.$count(customerVehicles)).toBe(1);
  });

  test("refuses a model the garage hid", async () => {
    await db.update(vehicleModels).set({ listed: false }).where(eq(vehicleModels.id, "car-honda-city"));
    expect(await addMyVehicle(input(), clock)).toEqual({
      status: "problems",
      problems: [{ field: "vehicle", problem: "vehicle-unknown-model" }],
    });
  });
});

describe("updateMyVehicle", () => {
  test("changes the customer's own vehicle", async () => {
    const id = await addAs(asha);
    const later = fixedClock(new Date("2026-11-02T10:00:00Z"));
    expect(await updateMyVehicle(id, input({ fuel: "diesel", pucExpiresOn: "", insuranceExpiresOn: "2027-01-31" }), later)).toEqual({
      status: "saved",
    });
    expect(await storedRow(id)).toMatchObject({
      fuel: "diesel",
      pucExpiresOn: null,
      insuranceExpiresOn: "2027-01-31",
      createdAt: clock.now(),
      updatedAt: later.now(),
    });
  });

  test("keeping the vehicle's own number is fine", async () => {
    const id = await addAs(asha);
    expect(await updateMyVehicle(id, input(), clock)).toEqual({ status: "saved" });
  });

  test("the number of another of the customer's vehicles is a duplicate", async () => {
    await addAs(asha, { registration: "MH12AB1234" });
    const second = await addAs(asha, { registration: "MH12AB0001" });
    expect(await updateMyVehicle(second, input({ registration: "MH12AB1234" }), clock)).toEqual({
      status: "problems",
      problems: [{ field: "registration", problem: "registration-duplicate" }],
    });
  });

  test("a model the garage hid since is refused, even unchanged", async () => {
    const id = await addAs(asha);
    await db.update(vehicleModels).set({ listed: false }).where(eq(vehicleModels.id, "car-honda-city"));
    expect(await updateMyVehicle(id, input(), clock)).toEqual({
      status: "problems",
      problems: [{ field: "vehicle", problem: "vehicle-unknown-model" }],
    });
  });
});

describe("removeMyVehicle", () => {
  test("deletes the customer's own vehicle", async () => {
    const id = await addAs(asha);
    expect(await removeMyVehicle(id)).toEqual({ status: "removed" });
    expect(await storedRow(id)).toBeUndefined();
  });
});

describe("listMyVehicles and readMyVehicle", () => {
  test("list oldest first, with brand and model names", async () => {
    const first = await addAs(asha, { registration: "MH12AB1234" });
    const second = await addAs(asha, { modelId: "car-tata-nexon", fuel: "electric", registration: "22BH1234AB" });
    // The second was saved with the same clock: the id breaks the tie, so
    // set a later time to test the order by time.
    await db.update(customerVehicles).set({ createdAt: new Date("2026-10-30T10:00:00Z") }).where(eq(customerVehicles.id, second));
    expect(await listMyVehicles()).toEqual([
      {
        id: first,
        kind: "car",
        modelId: "car-honda-city",
        makeName: { en: "Honda" },
        modelName: { en: "City" },
        fuel: "petrol",
        registrationNumber: "MH12AB1234",
        pucExpiresOn: "2027-03-12",
        insuranceExpiresOn: null,
      },
      {
        id: second,
        kind: "car",
        modelId: "car-tata-nexon",
        makeName: { en: "Tata" },
        modelName: { en: "Nexon" },
        fuel: "electric",
        registrationNumber: "22BH1234AB",
        // An electric vehicle has no PUC date, even when one was posted.
        pucExpiresOn: null,
        insuranceExpiresOn: null,
      },
    ]);
  });

  test("still show a vehicle whose model the garage hid after it was saved", async () => {
    const id = await addAs(asha);
    await db.update(vehicleModels).set({ listed: false }).where(eq(vehicleModels.id, "car-honda-city"));
    expect((await listMyVehicles()).map((vehicle) => vehicle.modelName)).toEqual([{ en: "City" }]);
    expect(await readMyVehicle(id)).toMatchObject({ id, modelName: { en: "City" } });
  });
});
