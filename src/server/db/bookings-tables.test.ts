import { eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { BOOKING_EVENT_KINDS, BOOKING_STATUSES, LINE_PRICE_STATUSES } from "@/domain/bookings";

import { closeDatabase, createDatabase, type Database } from "./index";
import {
  bookingEventKind,
  bookingEvents,
  bookingItems,
  bookingLinePriceStatus,
  bookings,
  bookingStatus,
  customerVehicles,
  services,
  users,
  vehicleModels,
} from "./schema";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14 saw the 10-second hook limit time out under load). Database test
// files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// The booking tables' own rules (task 23), checked on a real Postgres: the
// booking save relies on them as a backstop. One in-memory database for the
// file; every test starts with two users, no vehicles and no bookings. The
// catalogue and services are the seeded ones.
let db: Database;

beforeAll(async () => {
  db = await createDatabase({ driver: "pglite", dataDir: null });
});

afterAll(async () => {
  await closeDatabase(db);
});

beforeEach(async () => {
  // Deleting a booking deletes its items and events (cascade).
  await db.delete(bookings);
  await db.delete(customerVehicles);
  await db.delete(users);
  await db.insert(users).values([user("asha", "+919876500001"), user("ravi", "+919876500002")]);
});

function user(id: string, phoneNumber: string) {
  return { id, name: "", email: `${phoneNumber.slice(1)}@phone.invalid`, phoneNumber };
}

const TOKEN = "6f1c2a52-6a8e-4c43-9a7e-0d4b5b1e2f30";

/** A booking row for `userId`: a seeded Honda City (a sedan) on petrol. */
function booking(userId: string, overrides: Partial<typeof bookings.$inferInsert> = {}): typeof bookings.$inferInsert {
  return {
    code: "K7Q4MX",
    userId,
    vehicleKind: "car",
    modelId: "car-honda-city",
    fuel: "petrol",
    categoryId: "sedan",
    registrationNumber: "MH12AB1234",
    startsAt: new Date("2027-03-12T04:30:00.000Z"),
    isEstimate: false,
    totalPaise: 150_000,
    requestToken: TOKEN,
    ...overrides,
  };
}

/** A priced line of `bookingId`: the seeded periodic service. */
function item(bookingId: string, overrides: Partial<typeof bookingItems.$inferInsert> = {}): typeof bookingItems.$inferInsert {
  return {
    bookingId,
    serviceId: "periodic-service",
    serviceKind: "service",
    name: { en: "Periodic service" },
    priceStatus: "price",
    pricePaise: 150_000,
    position: 0,
    ...overrides,
  };
}

/** Saves one booking for asha and returns its id. */
async function saveBooking(overrides: Partial<typeof bookings.$inferInsert> = {}): Promise<string> {
  const [row] = await db.insert(bookings).values(booking("asha", overrides)).returning({ id: bookings.id });
  return row.id;
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

const uniqueViolation = (constraint: string) => ({ code: "23505", constraint }); // unique_violation
const checkViolation = (constraint: string) => ({ code: "23514", constraint }); // check_violation
const restrictViolation = (constraint: string) => ({ code: "23001", constraint }); // restrict_violation

describe("the booking enums", () => {
  test("list the statuses, event kinds and line price statuses exactly as the app does", () => {
    expect(bookingStatus.enumValues).toEqual([...BOOKING_STATUSES]);
    expect(bookingEventKind.enumValues).toEqual([...BOOKING_EVENT_KINDS]);
    expect(bookingLinePriceStatus.enumValues).toEqual([...LINE_PRICE_STATUSES]);
  });
});

describe("the bookings table", () => {
  test("refuses two bookings with one code", async () => {
    await saveBooking();
    const second = booking("ravi", { requestToken: "0b8f8e0e-3c1d-4d3a-8f55-1a2b3c4d5e6f" });
    expect(await violation(db.insert(bookings).values(second))).toEqual(uniqueViolation("bookings_code_unique"));
  });

  test("refuses one request token twice for one user, and allows it for another", async () => {
    await saveBooking();
    expect(await violation(db.insert(bookings).values(booking("asha", { code: "K7Q4MY" })))).toEqual(
      uniqueViolation("bookings_user_request_token"),
    );
    await db.insert(bookings).values(booking("ravi", { code: "K7Q4MZ" }));
    expect(await db.$count(bookings)).toBe(2);
  });

  test("removing the saved vehicle keeps the booking and its vehicle copy", async () => {
    const [vehicle] = await db
      .insert(customerVehicles)
      .values({ userId: "asha", modelId: "car-honda-city", fuel: "petrol", registrationNumber: "MH12AB1234" })
      .returning({ id: customerVehicles.id });
    const id = await saveBooking({ vehicleId: vehicle.id });

    await db.delete(customerVehicles).where(eq(customerVehicles.id, vehicle.id));

    const [row] = await db
      .select({
        vehicleId: bookings.vehicleId,
        vehicleKind: bookings.vehicleKind,
        modelId: bookings.modelId,
        fuel: bookings.fuel,
        categoryId: bookings.categoryId,
        registrationNumber: bookings.registrationNumber,
      })
      .from(bookings)
      .where(eq(bookings.id, id));
    expect(row).toEqual({
      vehicleId: null,
      vehicleKind: "car",
      modelId: "car-honda-city",
      fuel: "petrol",
      categoryId: "sedan",
      registrationNumber: "MH12AB1234",
    });
  });

  test("deleting a booking deletes its items and events, and only its own", async () => {
    const first = await saveBooking();
    const [second] = await db
      .insert(bookings)
      .values(booking("ravi", { code: "K7Q4MY" }))
      .returning({ id: bookings.id });
    await db.insert(bookingItems).values([item(first), item(first, { serviceId: "ac", name: { en: "AC" }, position: 1 }), item(second.id)]);
    await db.insert(bookingEvents).values([
      { bookingId: first, kind: "booked", actorUserId: "asha" },
      { bookingId: second.id, kind: "booked", actorUserId: "ravi" },
    ]);

    await db.delete(bookings).where(eq(bookings.id, first));

    expect(await db.select({ bookingId: bookingItems.bookingId }).from(bookingItems)).toEqual([{ bookingId: second.id }]);
    expect(await db.select({ bookingId: bookingEvents.bookingId }).from(bookingEvents)).toEqual([{ bookingId: second.id }]);
  });

  test("refuses to delete a vehicle model a booking points to", async () => {
    await saveBooking();
    expect(await violation(db.delete(vehicleModels).where(eq(vehicleModels.id, "car-honda-city")))).toEqual(
      restrictViolation("bookings_model_id_vehicle_models_id_fk"),
    );
  });

  test("refuses a total of 0 or below, and allows none", async () => {
    for (const totalPaise of [0, -100]) {
      expect(await violation(db.insert(bookings).values(booking("asha", { totalPaise }))), String(totalPaise)).toEqual(
        checkViolation("bookings_total_positive"),
      );
    }
    await saveBooking({ totalPaise: null, isEstimate: true });
    expect(await db.$count(bookings)).toBe(1);
  });
});

describe("the booking_items table", () => {
  test("refuses to delete a service a booking line points to", async () => {
    await db.insert(bookingItems).values(item(await saveBooking()));
    expect(await violation(db.delete(services).where(eq(services.id, "periodic-service")))).toEqual(
      restrictViolation("booking_items_service_id_services_id_fk"),
    );
  });

  test("refuses a price of 0 or below", async () => {
    const id = await saveBooking();
    for (const pricePaise of [0, -100]) {
      expect(await violation(db.insert(bookingItems).values(item(id, { pricePaise }))), String(pricePaise)).toEqual(
        checkViolation("booking_items_price_positive"),
      );
    }
  });

  test("ties the amount to the price status: only a priced line has one", async () => {
    const id = await saveBooking({ isEstimate: true });
    expect(await violation(db.insert(bookingItems).values(item(id, { pricePaise: null })))).toEqual(
      checkViolation("booking_items_price_matches_status"),
    );
    for (const priceStatus of ["on-inspection", "no-price"] as const) {
      expect(await violation(db.insert(bookingItems).values(item(id, { priceStatus }))), priceStatus).toEqual(
        checkViolation("booking_items_price_matches_status"),
      );
    }
    await db.insert(bookingItems).values([
      item(id),
      item(id, { serviceId: "ac", name: { en: "AC" }, priceStatus: "on-inspection", pricePaise: null, position: 1 }),
      item(id, { serviceId: "battery", name: { en: "Battery" }, priceStatus: "no-price", pricePaise: null, position: 2 }),
    ]);
    expect(await db.$count(bookingItems)).toBe(3);
  });
});
