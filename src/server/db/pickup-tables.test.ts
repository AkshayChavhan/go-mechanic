import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { closeDatabase, createDatabase, type Database } from "./index";
import { bookings, pickupAreas, users } from "./schema";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14 saw the 10-second hook limit time out under load). Database test
// files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// The pickup tables' own rules (task 24), on a real Postgres: the booking
// save relies on them as a backstop.
let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});
afterAll(async () => {
  await closeDatabase(db);
});

beforeEach(async () => {
  await db.delete(bookings);
  await db.delete(pickupAreas);
  await db.delete(users);
  await db.insert(users).values({ id: "asha", name: "", email: "919876500001@phone.invalid", phoneNumber: "+919876500001" });
});

/** The constraint a failed query broke. */
async function brokenConstraint(query: Promise<unknown>): Promise<string | undefined> {
  const error = await query.then(
    () => {
      throw new Error("expected the query to fail");
    },
    (failure: unknown) => failure,
  );
  if (!(error instanceof DrizzleQueryError)) throw error;
  return (error.cause as { constraint?: string }).constraint;
}

/** A booking row without pickup: a seeded Honda City on petrol. */
function booking(overrides: Partial<typeof bookings.$inferInsert> = {}): typeof bookings.$inferInsert {
  return {
    code: "K7Q4MX",
    userId: "asha",
    vehicleKind: "car",
    modelId: "car-honda-city",
    fuel: "petrol",
    categoryId: "sedan",
    registrationNumber: "MH12AB1234",
    startsAt: new Date("2027-03-12T04:30:00.000Z"),
    isEstimate: true,
    totalPaise: null,
    requestToken: "6f1c2a52-6a8e-4c43-9a7e-0d4b5b1e2f30",
    ...overrides,
  };
}

const pickup = { pickupAddress: "Flat 4, Shivneri Society, Chakan", pickupPostalCode: "412101", pickupFeePaise: 0 };

describe("pickup_areas", () => {
  test("a new database has none: no made-up area is ever seeded", async () => {
    const fresh = await createDatabase({ driver: "pglite", dataDir: null });
    try {
      expect(await fresh.select().from(pickupAreas)).toEqual([]);
    } finally {
      await closeDatabase(fresh);
    }
  });

  test("a new area is listed, and a fee of 0 (free) is allowed", async () => {
    const [area] = await db.insert(pickupAreas).values({ postalCode: "412101", feePaise: 0 }).returning();
    expect(area).toMatchObject({ postalCode: "412101", feePaise: 0, listed: true });
  });

  test.each([["012345"], ["41210"], ["4121011"], ["41A101"]])("refuses the PIN code %j", async (postalCode) => {
    expect(await brokenConstraint(db.insert(pickupAreas).values({ postalCode, feePaise: 100 }))).toBe(
      "pickup_areas_postal_code_format",
    );
  });

  test("refuses a negative fee", async () => {
    expect(await brokenConstraint(db.insert(pickupAreas).values({ postalCode: "412101", feePaise: -1 }))).toBe(
      "pickup_areas_fee_not_negative",
    );
  });
});

describe("a booking's pickup copy", () => {
  test("none at all, or all three, is allowed (a free pickup too)", async () => {
    await db.insert(bookings).values(booking());
    const [row] = await db
      .insert(bookings)
      .values(booking({ code: "K7Q4MY", requestToken: "7f1c2a52-6a8e-4c43-9a7e-0d4b5b1e2f30", ...pickup }))
      .returning();
    expect(row).toMatchObject(pickup);
  });

  test.each([
    ["no address", { ...pickup, pickupAddress: null }],
    ["no PIN code", { ...pickup, pickupPostalCode: null }],
    ["no fee", { ...pickup, pickupFeePaise: null }],
    ["only a fee", { pickupFeePaise: 5_000 }],
  ])("refuses a partial copy: %s", async (_case, overrides) => {
    expect(await brokenConstraint(db.insert(bookings).values(booking(overrides)))).toBe("bookings_pickup_complete");
  });

  test("refuses a malformed PIN code and a negative fee", async () => {
    expect(await brokenConstraint(db.insert(bookings).values(booking({ ...pickup, pickupPostalCode: "41210" })))).toBe(
      "bookings_pickup_postal_code_format",
    );
    expect(await brokenConstraint(db.insert(bookings).values(booking({ ...pickup, pickupFeePaise: -100 })))).toBe(
      "bookings_pickup_fee_not_negative",
    );
  });
});
