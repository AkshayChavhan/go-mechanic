import { eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { closeDatabase, createDatabase, type Database } from "./index";
import { customerVehicles, users, vehicleModels } from "./schema";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14 saw the 10-second hook limit time out under load). Database test
// files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// The table's own rules (task 21), checked on a real Postgres: the
// data-access layer relies on them as a backstop. One in-memory database for
// the file; every test starts with two users and no vehicles.
let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});

afterAll(async () => {
  await closeDatabase(db);
});

beforeEach(async () => {
  await db.delete(customerVehicles);
  await db.delete(users);
  await db.insert(users).values([user("asha", "+919876500001"), user("ravi", "+919876500002")]);
});

function user(id: string, phoneNumber: string) {
  return { id, name: "", email: `${phoneNumber.slice(1)}@phone.invalid`, phoneNumber };
}

/** A vehicle row for `userId`: a seeded Honda City on petrol. */
function vehicle(userId: string, registrationNumber = "MH12AB1234") {
  return { userId, modelId: "car-honda-city", fuel: "petrol" as const, registrationNumber };
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

describe("the customer_vehicles table", () => {
  test("refuses one registration number twice for one user, and allows it for another", async () => {
    await db.insert(customerVehicles).values(vehicle("asha"));
    expect(await violation(db.insert(customerVehicles).values(vehicle("asha")))).toEqual({
      code: "23505", // unique_violation
      constraint: "customer_vehicles_user_registration",
    });
    await db.insert(customerVehicles).values(vehicle("ravi"));
    expect(await db.$count(customerVehicles)).toBe(2);
  });

  test("refuses a registration number that isn't in the compact form", async () => {
    for (const registrationNumber of ["mh12ab1234", "MH 12 AB 1234", "MH-12-AB-1234", "MH1", "MH12ABC12345"]) {
      expect(await violation(db.insert(customerVehicles).values(vehicle("asha", registrationNumber))), registrationNumber).toEqual({
        code: "23514", // check_violation
        constraint: "customer_vehicles_registration_compact",
      });
    }
  });

  test("refuses a model that isn't in the catalogue", async () => {
    const unknown = { ...vehicle("asha"), modelId: "car-no-such-model" };
    expect(await violation(db.insert(customerVehicles).values(unknown))).toEqual({
      code: "23503", // foreign_key_violation
      constraint: "customer_vehicles_model_id_vehicle_models_id_fk",
    });
  });

  test("refuses to delete a model a vehicle uses", async () => {
    await db.insert(customerVehicles).values(vehicle("asha"));
    expect(await violation(db.delete(vehicleModels).where(eq(vehicleModels.id, "car-honda-city")))).toEqual({
      code: "23001", // restrict_violation
      constraint: "customer_vehicles_model_id_vehicle_models_id_fk",
    });
  });

  test("deleting a user deletes their vehicles, and only theirs", async () => {
    await db.insert(customerVehicles).values([vehicle("asha"), vehicle("ravi")]);
    await db.delete(users).where(eq(users.id, "asha"));
    const left = await db.select({ userId: customerVehicles.userId }).from(customerVehicles);
    expect(left).toEqual([{ userId: "ravi" }]);
  });

  test("keeps expiry dates as plain YYYY-MM-DD text, and allows none", async () => {
    await db.insert(customerVehicles).values([
      { ...vehicle("asha"), pucExpiresOn: "2027-03-12", insuranceExpiresOn: "2028-01-31" },
      vehicle("asha", "MH12AB0001"),
    ]);
    const rows = await db
      .select({ registration: customerVehicles.registrationNumber, puc: customerVehicles.pucExpiresOn, insurance: customerVehicles.insuranceExpiresOn })
      .from(customerVehicles)
      .orderBy(customerVehicles.registrationNumber);
    expect(rows).toEqual([
      { registration: "MH12AB0001", puc: null, insurance: null },
      { registration: "MH12AB1234", puc: "2027-03-12", insurance: "2028-01-31" },
    ]);
  });

  test("gives each vehicle its own uuid", async () => {
    const [first, second] = await db
      .insert(customerVehicles)
      .values([vehicle("asha"), vehicle("ravi")])
      .returning({ id: customerVehicles.id });
    expect(first.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(second.id).not.toBe(first.id);
  });
});
