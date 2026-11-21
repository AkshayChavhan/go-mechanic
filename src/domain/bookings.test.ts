import { describe, expect, test } from "vitest";

import {
  BOOKING_CODE_ALPHABET,
  ACTIVE_STATUSES,
  BOOKING_EVENT_KINDS,
  BOOKING_STATUSES,
  type BookingInput,
  type BookingStatus,
  buildBookingLines,
  CANCEL_REASON_RULES,
  canChangeStatus,
  checkBookingInput,
  checkCancelInput,
  formatBookingCode,
  LINE_PRICE_STATUSES,
  makeBookingCode,
  MAX_FUTURE_BOOKINGS,
  PLACE_HOLDING_STATUSES,
} from "./bookings";
import type { PricedVehicle, Service, ServicePrice } from "./services";

const TOKEN = "3f2b8c1e-9a4d-4e6f-b7a1-2c3d4e5f6a7b";
const SLOT = "2027-03-12T04:30:00.000Z";

/** A valid booking for a typed vehicle; each test changes what it needs. */
function input(overrides: Partial<BookingInput> = {}): BookingInput {
  return {
    vehicle: { modelId: "car-honda-city", fuel: "petrol", registration: "mh 12 ab 42" },
    serviceIds: ["brakes"],
    startsAt: SLOT,
    requestToken: TOKEN,
    ...overrides,
  };
}

describe("checkBookingInput: pickup and drop (task 24)", () => {
  test("an address and PIN code come back cleaned", () => {
    const checked = checkBookingInput(input({ pickup: { address: " 12, MG Road,\n Chakan ", postalCode: "412 101" } }));
    expect(checked.ok && checked.booking.pickup).toEqual({ address: "12, MG Road, Chakan", postalCode: "412101" });
  });

  test("both fields blank: no pickup, and no problem", () => {
    const checked = checkBookingInput(input({ pickup: { address: "  ", postalCode: "" } }));
    expect(checked.ok && checked.booking.pickup).toBeNull();
  });

  test("only the PIN code filled: the address is missing", () => {
    expect(checkBookingInput(input({ pickup: { address: "", postalCode: "412101" } }))).toEqual({
      ok: false,
      problems: [{ field: "pickup", problem: "address-missing" }],
    });
  });

  test("a bad address and a bad slot come back together", () => {
    expect(checkBookingInput(input({ startsAt: "soon", pickup: { address: "Chakan", postalCode: "41210" } }))).toEqual({
      ok: false,
      problems: [
        { field: "slot", problem: "slot-invalid" },
        { field: "pickup", problem: "address-too-short" },
        { field: "pickup", problem: "postal-code-invalid" },
      ],
    });
  });
});

describe("checkBookingInput", () => {
  test("a typed vehicle: the registration is stored in its compact form", () => {
    expect(checkBookingInput(input())).toEqual({
      ok: true,
      booking: {
        vehicle: { saved: false, modelId: "car-honda-city", fuel: "petrol", registrationNumber: "MH12AB0042" },
        serviceIds: ["brakes"],
        startsAt: new Date(SLOT),
        requestToken: TOKEN,
        pickup: null,
      },
    });
  });

  test("a saved vehicle is passed on by its id", () => {
    const result = checkBookingInput(input({ vehicle: { savedVehicleId: "a-saved-id" } }));
    expect(result.ok && result.booking.vehicle).toEqual({ saved: true, vehicleId: "a-saved-id" });
  });

  test.each([
    ["an empty saved id", { savedVehicleId: " " }, { field: "vehicle", problem: "vehicle-missing" }],
    ["no model", { modelId: "", fuel: "petrol", registration: "MH12AB1234" }, { field: "vehicle", problem: "vehicle-missing" }],
    ["an unknown fuel", { modelId: "car-honda-city", fuel: "steam", registration: "MH12AB1234" }, { field: "vehicle", problem: "vehicle-fuel-not-offered" }],
    ["a bad registration", { modelId: "car-honda-city", fuel: "petrol", registration: "MX12AB1234" }, { field: "registration", problem: "registration-unknown-state" }],
    ["no registration", { modelId: "car-honda-city", fuel: "petrol", registration: "" }, { field: "registration", problem: "registration-missing" }],
  ] as const)("%s is a vehicle problem", (_, vehicle, problem) => {
    expect(checkBookingInput(input({ vehicle }))).toEqual({ ok: false, problems: [problem] });
  });

  test("no services: nothing-chosen", () => {
    expect(checkBookingInput(input({ serviceIds: [] }))).toEqual({
      ok: false,
      problems: [{ field: "services", problem: "nothing-chosen" }],
    });
  });

  test("eleven services: too-many", () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `service-${i}`);
    expect(checkBookingInput(input({ serviceIds: eleven }))).toEqual({
      ok: false,
      problems: [{ field: "services", problem: "too-many" }],
    });
  });

  test("the same id twice counts once, so ten plus a repeat is still allowed", () => {
    const ten = Array.from({ length: 10 }, (_, i) => `service-${i}`);
    const result = checkBookingInput(input({ serviceIds: [...ten, "service-0"] }));
    expect(result.ok && result.booking.serviceIds).toEqual(ten);
  });

  test("a slot start that isn't a date: slot-invalid", () => {
    expect(checkBookingInput(input({ startsAt: "tomorrow" }))).toEqual({
      ok: false,
      problems: [{ field: "slot", problem: "slot-invalid" }],
    });
  });

  test.each(["", "not-a-uuid", `${TOKEN}x`])("a token that isn't a uuid (%j): bad-token", (requestToken) => {
    expect(checkBookingInput(input({ requestToken }))).toEqual({
      ok: false,
      problems: [{ field: "token", problem: "bad-token" }],
    });
  });

  test("every problem is reported at once", () => {
    const result = checkBookingInput({
      vehicle: { modelId: "", fuel: "", registration: "" },
      serviceIds: [],
      startsAt: "",
      requestToken: "",
    });
    expect(result).toEqual({
      ok: false,
      problems: [
        { field: "vehicle", problem: "vehicle-missing" },
        { field: "registration", problem: "registration-missing" },
        { field: "services", problem: "nothing-chosen" },
        { field: "slot", problem: "slot-invalid" },
        { field: "token", problem: "bad-token" },
      ],
    });
  });
});

/** A service with every field filled in; each test changes what it needs. */
function service(overrides: Partial<Service> = {}): Service {
  return {
    id: "brakes",
    kind: "service",
    name: { en: "Brakes" },
    summary: { en: "Brake pads, discs and fluid." },
    vehicleKinds: ["car", "two-wheeler"],
    fuels: ["petrol", "diesel", "cng", "electric"],
    included: [{ en: "Check the pads" }],
    signs: [],
    pricedAfterInspection: false,
    ...overrides,
  };
}

const services: Service[] = [
  service(),
  service({ id: "ac", name: { en: "AC service" }, vehicleKinds: ["car"] }),
  service({ id: "denting", name: { en: "Denting" }, pricedAfterInspection: true }),
  service({ id: "car-basic", kind: "package", name: { en: "Basic" }, vehicleKinds: ["car"] }),
  service({ id: "two-wheeler-basic", kind: "package", name: { en: "Basic" }, vehicleKinds: ["two-wheeler"] }),
];

const prices: ServicePrice[] = [
  { serviceId: "brakes", categoryId: "hatchback", fuel: null, pricePaise: 150_000 },
  { serviceId: "ac", categoryId: "hatchback", fuel: "petrol", pricePaise: 249_900 },
];

const petrolHatchback: PricedVehicle = { kind: "car", categoryId: "hatchback", fuel: "petrol" };

describe("buildBookingLines", () => {
  test("two priced services: two lines, the total is their sum, not an estimate", () => {
    expect(buildBookingLines(services, prices, petrolHatchback, ["brakes", "ac"])).toEqual({
      ok: true,
      lines: [
        { serviceId: "brakes", kind: "service", name: { en: "Brakes" }, priceStatus: "price", pricePaise: 150_000, position: 0 },
        { serviceId: "ac", kind: "service", name: { en: "AC service" }, priceStatus: "price", pricePaise: 249_900, position: 1 },
      ],
      totalPaise: 399_900,
      isEstimate: false,
    });
  });

  test("a priced service and one priced after inspection: the total counts the priced line, and it's an estimate", () => {
    const result = buildBookingLines(services, prices, petrolHatchback, ["brakes", "denting"]);
    expect(result).toMatchObject({ ok: true, totalPaise: 150_000, isEstimate: true });
    expect(result.ok && result.lines[1]).toMatchObject({ serviceId: "denting", priceStatus: "on-inspection", pricePaise: null });
  });

  test("no real prices: every line is no-price and the total is null", () => {
    const result = buildBookingLines(services, [], petrolHatchback, ["brakes", "ac"]);
    expect(result).toMatchObject({ ok: true, totalPaise: null, isEstimate: true });
    expect(result.ok && result.lines.map((line) => [line.priceStatus, line.pricePaise])).toEqual([
      ["no-price", null],
      ["no-price", null],
    ]);
  });

  test("a package on its own is one line", () => {
    const result = buildBookingLines(services, prices, petrolHatchback, ["car-basic"]);
    expect(result.ok && result.lines).toEqual([
      { serviceId: "car-basic", kind: "package", name: { en: "Basic" }, priceStatus: "no-price", pricePaise: null, position: 0 },
    ]);
  });

  test("the same id twice makes one line", () => {
    const result = buildBookingLines(services, prices, petrolHatchback, ["brakes", "brakes"]);
    expect(result.ok && result.lines.length).toBe(1);
  });

  test("a package plus a service: package-with-services", () => {
    expect(buildBookingLines(services, prices, petrolHatchback, ["car-basic", "brakes"])).toEqual({
      ok: false,
      problems: [{ problem: "package-with-services", id: "car-basic" }],
    });
  });

  test("an unknown or hidden service (not in the listed services): unknown-service", () => {
    expect(buildBookingLines(services, prices, petrolHatchback, ["brakes", "hidden-one"])).toEqual({
      ok: false,
      problems: [{ problem: "unknown-service", id: "hidden-one" }],
    });
  });

  test("a two-wheeler package on a car: not-offered", () => {
    expect(buildBookingLines(services, prices, petrolHatchback, ["two-wheeler-basic"])).toEqual({
      ok: false,
      problems: [{ problem: "not-offered", id: "two-wheeler-basic" }],
    });
  });
});

describe("booking codes", () => {
  test("the alphabet leaves out look-alikes (I, L, O, 0, 1) and has 31 characters", () => {
    expect(BOOKING_CODE_ALPHABET).toBe("ABCDEFGHJKMNPQRSTUVWXYZ23456789");
    expect(BOOKING_CODE_ALPHABET).not.toMatch(/[ILO01]/);
  });

  test("a fixed random source gives a known code", () => {
    const picks = [9, 28, 13, 25, 10, 20];
    let next = 0;
    expect(makeBookingCode(() => picks[next++])).toBe("K7Q4MX");
  });

  test("every character comes from the alphabet", () => {
    for (let round = 0; round < 50; round++) {
      const code = makeBookingCode((size) => Math.floor(Math.random() * size));
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  test("it is shown in two groups of three", () => {
    expect(formatBookingCode("K7Q4MX")).toBe("K7Q-4MX");
  });
});

describe("the lists the database enums are built from", () => {
  test("their values", () => {
    expect(BOOKING_STATUSES).toEqual(["booked", "confirmed", "cancelled", "no-show"]);
    expect(BOOKING_EVENT_KINDS).toEqual(["booked", "job-update", "status-change", "rescheduled", "assigned"]);
    expect(LINE_PRICE_STATUSES).toEqual(["price", "on-inspection", "no-price"]);
    expect(MAX_FUTURE_BOOKINGS).toBe(3);
  });
});

describe("the two sets of statuses (task 27)", () => {
  test("a no-show still holds its place, but isn't active", () => {
    expect(PLACE_HOLDING_STATUSES).toEqual(["booked", "confirmed", "no-show"]);
    expect(ACTIVE_STATUSES).toEqual(["booked", "confirmed"]);
  });
});

describe("canChangeStatus (task 27)", () => {
  // The facts the save reads from the locked booking row.
  const notStarted = { jobStarted: false, slotStarted: false };
  const slotPassed = { jobStarted: false, slotStarted: true };
  const jobStarted = { jobStarted: true, slotStarted: true };

  test.each([
    ["booked", "confirmed", notStarted],
    ["booked", "cancelled", notStarted],
    ["confirmed", "cancelled", notStarted],
    ["booked", "no-show", slotPassed],
    ["confirmed", "no-show", slotPassed],
    ["no-show", "confirmed", slotPassed],
  ] as const)("%s -> %s is allowed", (from, to, facts) => {
    expect(canChangeStatus(from, to, facts)).toEqual({ ok: true });
  });

  test("every other pair is refused, whatever the facts", () => {
    const allowed = new Set([
      "booked>confirmed",
      "booked>cancelled",
      "confirmed>cancelled",
      "booked>no-show",
      "confirmed>no-show",
      "no-show>confirmed",
    ]);
    for (const from of BOOKING_STATUSES) {
      for (const to of BOOKING_STATUSES) {
        if (allowed.has(`${from}>${to}`)) continue;
        for (const facts of [notStarted, slotPassed, jobStarted]) {
          expect(canChangeStatus(from, to, facts), `${from} -> ${to}`).toEqual({ ok: false, problem: "not-allowed" });
        }
      }
    }
  });

  test("cancel and no-show are refused once the job has started", () => {
    expect(canChangeStatus("confirmed", "cancelled", jobStarted)).toEqual({ ok: false, problem: "job-started" });
    expect(canChangeStatus("booked", "no-show", jobStarted)).toEqual({ ok: false, problem: "job-started" });
  });

  test("confirm works with a started job and a passed slot: a mechanic may start first", () => {
    expect(canChangeStatus("booked", "confirmed", jobStarted)).toEqual({ ok: true });
  });

  test("cancel works after the slot has passed (a customer phones the next day)", () => {
    expect(canChangeStatus("booked", "cancelled", slotPassed)).toEqual({ ok: true });
  });

  test("no-show before the slot starts is too early", () => {
    expect(canChangeStatus("booked", "no-show", notStarted)).toEqual({ ok: false, problem: "too-early" });
  });

  test("arrived after all works whatever the slot time", () => {
    const from: BookingStatus = "no-show";
    expect(canChangeStatus(from, "confirmed", notStarted)).toEqual({ ok: true });
  });
});

describe("checkCancelInput (task 27)", () => {
  test("the limits", () => {
    expect(CANCEL_REASON_RULES).toEqual({ minLength: 3, maxLength: 200 });
  });

  test("two characters are too short; three are enough", () => {
    expect(checkCancelInput("no")).toEqual({ ok: false, problem: "reason-too-short" });
    expect(checkCancelInput("ill")).toEqual({ ok: true, reason: "ill" });
  });

  test("200 characters are accepted; 201 are too long (an emoji counts once)", () => {
    expect(checkCancelInput("a".repeat(200))).toEqual({ ok: true, reason: "a".repeat(200) });
    expect(checkCancelInput("a".repeat(199) + "🚗")).toEqual({ ok: true, reason: "a".repeat(199) + "🚗" });
    expect(checkCancelInput("a".repeat(201))).toEqual({ ok: false, problem: "reason-too-long" });
  });

  test("spaces around and at line ends are cleaned before counting", () => {
    expect(checkCancelInput("   ab  \r\n ")).toEqual({ ok: false, problem: "reason-too-short" });
    expect(checkCancelInput("  Customer phoned  \r\n to cancel ")).toEqual({
      ok: true,
      reason: "Customer phoned\n to cancel",
    });
  });
});
