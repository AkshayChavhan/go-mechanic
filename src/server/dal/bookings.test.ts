import { randomInt, randomUUID } from "node:crypto";

import { asc, count, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { BookingInput } from "@/domain/bookings";
import { indiaInstantOn } from "@/domain/india-time";
import { fixedClock } from "@/lib/clock";
import { AccessDeniedError } from "@/server/auth/access";
import { getCurrentUser } from "@/server/auth/session";
import { closeDatabase, createDatabase, type Database, getDatabase } from "@/server/db";
import {
  bookingEvents,
  bookingItems,
  bookings,
  customerVehicles,
  servicePrices,
  slotCounters,
  slotRules,
  users,
  vehicleModels,
} from "@/server/db/schema";
import { seedSlotRules } from "@/server/db/seed";

import { createMyBooking } from "./bookings";
import { addMyVehicle, listMyVehicles } from "./customer-vehicles";

// Starting PGlite (Postgres compiled to WebAssembly) and migrating it takes a
// few seconds, and much longer when the full test run shares a busy machine
// (task 14 saw the 10-second hook limit time out under load). Database test
// files get the longer limits.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// The booking save against a real (in-memory) database, seeded like the real
// one: the garage's hours, slot rules (1-hour slots, 2 places), the draft
// catalogue and services. getDatabase is swapped for it, next/cache for
// spies (the cached reads call cacheTag and cacheLife, which only work
// inside Next.js), and the session for a fake: Asha, unless a test says
// otherwise. randomInt stays real unless a test fixes the booking code.
vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  getDatabase: vi.fn(),
}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, randomInt: vi.fn(actual.randomInt) };
});

const asha = { id: "asha", phoneNumber: "+919876500001", role: "customer" as const };
const ravi = { id: "ravi", phoneNumber: "+919876500002", role: "customer" as const };

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
  // Deleting a booking deletes its items and events (cascade).
  await db.delete(bookings);
  await db.delete(customerVehicles);
  await db.delete(slotCounters);
  await db.delete(servicePrices);
  await db.delete(users);
  await db.delete(slotRules);
  await seedSlotRules(db);
  await db.update(vehicleModels).set({ listed: true });
  await db.insert(users).values(
    [asha, ravi].map(({ id, phoneNumber }) => ({ id, name: "", email: `${phoneNumber.slice(1)}@phone.invalid`, phoneNumber })),
  );
  // A real price for the periodic service on a sedan (the Honda City's group), any fuel.
  await db.insert(servicePrices).values({ serviceId: "periodic-service", categoryId: "sedan", fuel: null, pricePaise: 250_000 });
});

// Whatever a test did, every slot's counter must equal its booked bookings.
afterEach(async () => {
  expect(await countersByStart()).toEqual(await bookedByStart());
});

// Thursday 29 Oct 2026, 15:30 India time. Bookable: Friday 30 Oct to
// Thursday 5 Nov, 10:00 to 19:00, closed on Monday 2 Nov.
const clock = fixedClock(new Date("2026-10-29T10:00:00Z"));
const friday10 = indiaInstantOn("2026-10-30", 10 * 60);
const friday11 = indiaInstantOn("2026-10-30", 11 * 60);

/** A valid confirm: a typed petrol Honda City, the periodic service and brakes, Friday 10:00. */
function input(changes: Partial<BookingInput> = {}): BookingInput {
  return {
    vehicle: { modelId: "car-honda-city", fuel: "petrol", registration: "MH 12 AB 1234" },
    serviceIds: ["periodic-service", "brakes"],
    startsAt: friday10.toISOString(),
    requestToken: randomUUID(),
    ...changes,
  };
}

/** Books as `user` (logged in for the call only). */
async function bookAs(user: typeof asha, changes: Partial<BookingInput> = {}) {
  logIn(user);
  const result = await createMyBooking(input(changes), clock);
  logIn(asha);
  return result;
}

/** Saves a vehicle for `user` and returns its id. */
async function saveVehicle(user: typeof asha, modelId = "car-honda-city", registration = "MH12AB1234"): Promise<string> {
  logIn(user);
  const result = await addMyVehicle(
    { modelId, fuel: "petrol", registration, pucExpiresOn: "", insuranceExpiresOn: "" },
    clock,
  );
  logIn(asha);
  if (result.status !== "saved") throw new Error(`expected a save, got ${JSON.stringify(result)}`);
  return result.id;
}

/** Fills `places` of the slot at `startsAt` with Ravi's bookings. */
async function fill(startsAt: Date, places: number) {
  for (let place = 0; place < places; place++) {
    const result = await bookAs(ravi, {
      vehicle: { modelId: "car-honda-city", fuel: "petrol", registration: `KA01AB${String(place).padStart(4, "0")}` },
      startsAt: startsAt.toISOString(),
    });
    expect(result).toMatchObject({ status: "booked" });
  }
}

async function counterAt(startsAt: Date): Promise<number> {
  const [row] = await db.select().from(slotCounters).where(eq(slotCounters.startsAt, startsAt));
  return row?.reserved ?? 0;
}

async function countersByStart(): Promise<Record<string, number>> {
  const rows = await db.select().from(slotCounters).orderBy(asc(slotCounters.startsAt));
  return Object.fromEntries(rows.filter((row) => row.reserved > 0).map((row) => [row.startsAt.toISOString(), row.reserved]));
}

async function bookedByStart(): Promise<Record<string, number>> {
  const rows = await db
    .select({ startsAt: bookings.startsAt, booked: count() })
    .from(bookings)
    .where(eq(bookings.status, "booked"))
    .groupBy(bookings.startsAt)
    .orderBy(asc(bookings.startsAt));
  return Object.fromEntries(rows.map((row) => [row.startsAt.toISOString(), row.booked]));
}

/** Nothing written at all: no booking, no slot taken, no vehicle beyond `vehicles`. */
async function expectNothingWritten(vehicles = 0) {
  expect(await db.$count(bookings)).toBe(0);
  expect(await db.$count(bookingItems)).toBe(0);
  expect(await db.$count(bookingEvents)).toBe(0);
  expect(await countersByStart()).toEqual({});
  expect(await db.$count(customerVehicles)).toBe(vehicles);
}

describe("who may book", () => {
  test("nobody logged in: AccessDeniedError before the database is touched, even with a bad input", async () => {
    logIn(null);
    for (const attempt of [input(), input({ serviceIds: [] }), input({ vehicle: { savedVehicleId: "not-a-uuid" } })]) {
      const error = await createMyBooking(attempt, clock).catch((failure: unknown) => failure);
      expect(error).toBeInstanceOf(AccessDeniedError);
    }
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test("A books with B's saved vehicle: not-found, and nothing is written", async () => {
    const ravis = await saveVehicle(ravi);
    expect(await createMyBooking(input({ vehicle: { savedVehicleId: ravis } }), clock)).toEqual({ status: "not-found" });
    await expectNothingWritten(1);
  });

  test("a saved vehicle id that isn't a uuid: not-found without a query", async () => {
    expect(await createMyBooking(input({ vehicle: { savedVehicleId: "1; drop" } }), clock)).toEqual({
      status: "not-found",
    });
    expect(getDatabase).not.toHaveBeenCalled();
  });
});

describe("a booking", () => {
  test("a saved vehicle and two services: booked, one place taken, the lines priced, one event", async () => {
    const vehicleId = await saveVehicle(asha);
    const result = await createMyBooking(input({ vehicle: { savedVehicleId: vehicleId } }), clock);
    expect(result).toEqual({
      status: "booked",
      booking: {
        code: expect.stringMatching(/^[A-HJKMNP-Z2-9]{6}$/),
        startsAt: friday10,
        vehicle: { kind: "car", modelId: "car-honda-city", fuel: "petrol", categoryId: "sedan", registrationNumber: "MH12AB1234" },
        lines: [
          expect.objectContaining({ serviceId: "periodic-service", priceStatus: "price", pricePaise: 250_000, position: 0 }),
          expect.objectContaining({ serviceId: "brakes", priceStatus: "no-price", pricePaise: null, position: 1 }),
        ],
        totalPaise: 250_000,
        isEstimate: true,
      },
    });
    expect(await counterAt(friday10)).toBe(1);

    const [row] = await db.select().from(bookings);
    expect(row).toMatchObject({ userId: asha.id, vehicleId, status: "booked", totalPaise: 250_000, isEstimate: true });
    const items = await db.select().from(bookingItems).orderBy(asc(bookingItems.position));
    expect(items.map(({ serviceId, priceStatus, pricePaise }) => ({ serviceId, priceStatus, pricePaise }))).toEqual([
      { serviceId: "periodic-service", priceStatus: "price", pricePaise: 250_000 },
      { serviceId: "brakes", priceStatus: "no-price", pricePaise: null },
    ]);
    const events = await db.select().from(bookingEvents);
    expect(events).toEqual([expect.objectContaining({ bookingId: row.id, kind: "booked", actorUserId: asha.id })]);
  });

  test("a new typed vehicle: booked, and the vehicle is saved to the account", async () => {
    expect(await createMyBooking(input(), clock)).toMatchObject({ status: "booked" });
    const vehicles = await listMyVehicles();
    expect(vehicles).toEqual([expect.objectContaining({ modelId: "car-honda-city", registrationNumber: "MH12AB1234" })]);
    const [row] = await db.select().from(bookings);
    expect(row.vehicleId).toBe(vehicles[0].id);
  });

  test("a saved vehicle whose model the garage hid since still books, priced by its group", async () => {
    const vehicleId = await saveVehicle(asha);
    await db.update(vehicleModels).set({ listed: false }).where(eq(vehicleModels.id, "car-honda-city"));
    expect(await createMyBooking(input({ vehicle: { savedVehicleId: vehicleId } }), clock)).toMatchObject({
      status: "booked",
      booking: { totalPaise: 250_000, vehicle: { categoryId: "sedan" } },
    });
  });

  test("problems in the input or the services: answered, nothing written", async () => {
    expect(await createMyBooking(input({ serviceIds: [] }), clock)).toEqual({
      status: "problems",
      problems: [{ field: "services", problem: "nothing-chosen" }],
    });
    expect(await createMyBooking(input({ serviceIds: ["car-basic", "brakes"] }), clock)).toEqual({
      status: "problems",
      problems: [{ field: "services", problem: "package-with-services", serviceId: "car-basic" }],
    });
    expect(
      await createMyBooking(input({ vehicle: { modelId: "car-nope", fuel: "petrol", registration: "MH12AB1234" } }), clock),
    ).toEqual({ status: "problems", problems: [{ field: "vehicle", problem: "vehicle-unknown-model" }] });
    await expectNothingWritten();
  });
});

describe("a typed registration the customer already saved", () => {
  test("same model and fuel: booked with the saved vehicle, no second vehicle row", async () => {
    const vehicleId = await saveVehicle(asha);
    expect(await createMyBooking(input(), clock)).toMatchObject({ status: "booked" });
    expect(await db.$count(customerVehicles)).toBe(1);
    const [row] = await db.select().from(bookings);
    expect(row.vehicleId).toBe(vehicleId);
  });

  test("another model: registration-duplicate naming the saved one, nothing written", async () => {
    const vehicleId = await saveVehicle(asha, "car-honda-amaze");
    const result = await createMyBooking(input(), clock);
    expect(result).toEqual({
      status: "registration-duplicate",
      savedVehicle: expect.objectContaining({ id: vehicleId, modelId: "car-honda-amaze", modelName: expect.anything() }),
    });
    await expectNothingWritten(1);
  });

  test("another customer's vehicle with the same number doesn't count: booked with a new vehicle", async () => {
    await saveVehicle(ravi, "car-honda-amaze");
    expect(await createMyBooking(input(), clock)).toMatchObject({ status: "booked" });
    expect(await db.$count(customerVehicles)).toBe(2);
  });
});

describe("the slot", () => {
  test("full: slot-problem full, no booking, no vehicle row, the counter unchanged", async () => {
    await fill(friday10, 2);
    const before = await db.$count(customerVehicles);
    expect(await createMyBooking(input(), clock)).toEqual({ status: "slot-problem", problem: "full" });
    expect(await counterAt(friday10)).toBe(2);
    expect(await db.$count(bookings, eq(bookings.userId, asha.id))).toBe(0);
    expect(await db.$count(customerVehicles)).toBe(before);
  });

  test.each([
    ["outside-window", indiaInstantOn("2026-11-20", 10 * 60)],
    ["outside-window", indiaInstantOn("2026-10-29", 17 * 60)],
    ["not-a-slot", indiaInstantOn("2026-10-30", 10 * 60 + 30)],
    // Monday 2 Nov: closed every week, so it has no slots at all.
    ["not-a-slot", indiaInstantOn("2026-11-02", 10 * 60)],
  ])("%s (%s): slot-problem, nothing written", async (problem, startsAt) => {
    expect(await createMyBooking(input({ startsAt: startsAt.toISOString() }), clock)).toEqual({
      status: "slot-problem",
      problem,
    });
    await expectNothingWritten();
  });

  test("two customers book the last place one after the other: one booked, one full", async () => {
    await fill(friday10, 1);
    expect(await bookAs(asha)).toMatchObject({ status: "booked" });
    expect(await bookAs(ravi, { vehicle: { modelId: "car-honda-city", fuel: "petrol", registration: "DL3CAB0042" } })).toEqual({
      status: "slot-problem",
      problem: "full",
    });
    expect(await counterAt(friday10)).toBe(2);
  });

  test("a save that fails after taking the place rolls it back: the counter is unchanged", async () => {
    // Ravi's booking gets the code AAAAAA; Asha's next one draws it too, and
    // the unique code refuses it after reserveSlot has taken her place.
    vi.mocked(randomInt).mockImplementation((() => 0) as unknown as typeof randomInt);
    try {
      await fill(friday11, 1);
      // 23505: the unique code.
      await expect(createMyBooking(input(), clock)).rejects.toMatchObject({ cause: { code: "23505" } });
    } finally {
      vi.mocked(randomInt).mockReset();
    }
    expect(await counterAt(friday10)).toBe(0);
    expect(await db.$count(bookings, eq(bookings.userId, asha.id))).toBe(0);
    expect(await db.$count(customerVehicles, eq(customerVehicles.userId, asha.id))).toBe(0);
  });
});

describe("at most 3 future bookings", () => {
  const slots = [10, 11, 12, 13].map((hour) => indiaInstantOn("2026-10-31", hour * 60));

  test("a fourth future booking: too-many-bookings, the counter unchanged", async () => {
    for (const slot of slots.slice(0, 3)) {
      expect(await createMyBooking(input({ startsAt: slot.toISOString() }), clock)).toMatchObject({ status: "booked" });
    }
    expect(await createMyBooking(input({ startsAt: slots[3].toISOString() }), clock)).toEqual({
      status: "too-many-bookings",
      limit: 3,
    });
    expect(await counterAt(slots[3])).toBe(0);
  });

  test("a booking whose slot has passed doesn't count", async () => {
    for (const slot of slots.slice(0, 3)) {
      expect(await createMyBooking(input({ startsAt: slot.toISOString() }), clock)).toMatchObject({ status: "booked" });
    }
    // Move the first one into the past (its counter row moves with it, so the
    // counters still match the bookings).
    const past = indiaInstantOn("2026-10-28", 10 * 60);
    await db.update(bookings).set({ startsAt: past }).where(eq(bookings.startsAt, slots[0]));
    await db.update(slotCounters).set({ startsAt: past }).where(eq(slotCounters.startsAt, slots[0]));
    expect(await createMyBooking(input({ startsAt: slots[3].toISOString() }), clock)).toMatchObject({ status: "booked" });
  });
});

describe("the same confirm twice (the request token)", () => {
  test("the second answer is duplicate with the first booking's code; one booking, one place", async () => {
    const requestToken = randomUUID();
    const first = await createMyBooking(input({ requestToken }), clock);
    if (first.status !== "booked") throw new Error(`expected a booking, got ${JSON.stringify(first)}`);
    expect(await createMyBooking(input({ requestToken }), clock)).toEqual({ status: "duplicate", code: first.booking.code });
    expect(await db.$count(bookings)).toBe(1);
    expect(await counterAt(friday10)).toBe(1);
  });

  test("when the first took the slot's last place: still duplicate, not full", async () => {
    await fill(friday10, 1);
    const requestToken = randomUUID();
    const first = await createMyBooking(input({ requestToken }), clock);
    if (first.status !== "booked") throw new Error(`expected a booking, got ${JSON.stringify(first)}`);
    expect(await createMyBooking(input({ requestToken }), clock)).toEqual({ status: "duplicate", code: first.booking.code });
  });

  test("a retried third booking answers duplicate, not too-many-bookings", async () => {
    const slots = [10, 11, 12].map((hour) => indiaInstantOn("2026-10-31", hour * 60));
    const requestToken = randomUUID();
    await createMyBooking(input({ startsAt: slots[0].toISOString() }), clock);
    await createMyBooking(input({ startsAt: slots[1].toISOString() }), clock);
    const third = await createMyBooking(input({ startsAt: slots[2].toISOString(), requestToken }), clock);
    if (third.status !== "booked") throw new Error(`expected a booking, got ${JSON.stringify(third)}`);
    expect(await createMyBooking(input({ startsAt: slots[2].toISOString(), requestToken }), clock)).toEqual({
      status: "duplicate",
      code: third.booking.code,
    });
    expect(await db.$count(bookings)).toBe(3);
  });

  test("the same token from another customer is a different booking", async () => {
    const requestToken = randomUUID();
    expect(await bookAs(asha, { requestToken })).toMatchObject({ status: "booked" });
    expect(await bookAs(ravi, { requestToken })).toMatchObject({ status: "booked" });
    expect(await counterAt(friday10)).toBe(2);
  });
});

describe("the same vehicle in the same slot again (a new token, after a reload)", () => {
  test("answers duplicate with the first booking's code; one booking, one place", async () => {
    const first = await createMyBooking(input(), clock);
    if (first.status !== "booked") throw new Error(`expected a booking, got ${JSON.stringify(first)}`);
    expect(await createMyBooking(input({ requestToken: randomUUID() }), clock)).toEqual({
      status: "duplicate",
      code: first.booking.code,
    });
    expect(await db.$count(bookings)).toBe(1);
    expect(await counterAt(friday10)).toBe(1);
  });

  test("the same vehicle in another slot, or another vehicle in the same slot, is a new booking", async () => {
    expect(await createMyBooking(input(), clock)).toMatchObject({ status: "booked" });
    expect(
      await createMyBooking(input({ requestToken: randomUUID(), startsAt: friday11.toISOString() }), clock),
    ).toMatchObject({ status: "booked" });
    expect(
      await createMyBooking(
        input({
          requestToken: randomUUID(),
          vehicle: { modelId: "car-honda-city", fuel: "petrol", registration: "KA01AB0009" },
        }),
        clock,
      ),
    ).toMatchObject({ status: "booked" });
    expect(await counterAt(friday10)).toBe(2);
  });
});

test("after a mix of answers, every slot's counter equals its booked bookings", async () => {
  const token = randomUUID();
  await bookAs(asha, { requestToken: token });
  await bookAs(asha, { requestToken: token });
  await bookAs(ravi, { vehicle: { modelId: "car-honda-city", fuel: "petrol", registration: "KA01AB0001" } });
  await bookAs(ravi, { vehicle: { modelId: "car-honda-city", fuel: "petrol", registration: "KA01AB0002" } });
  await bookAs(asha, { startsAt: friday11.toISOString() });
  await bookAs(asha, { serviceIds: [] });
  expect(await countersByStart()).toEqual({ [friday10.toISOString()]: 2, [friday11.toISOString()]: 1 });
  expect(await bookedByStart()).toEqual(await countersByStart());
  expect(await db.$count(bookings, eq(bookings.userId, asha.id))).toBe(2);
});
