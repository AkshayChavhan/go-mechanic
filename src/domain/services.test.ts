import { describe, expect, test } from "vitest";

import {
  checkServices,
  fromPrice,
  type PricedVehicle,
  priceFor,
  type Service,
  type ServicePrice,
  servicePath,
  SERVICE_KINDS,
} from "./services";
import type { VehicleCategory } from "./vehicles";

const categories: VehicleCategory[] = [
  { id: "hatchback", kind: "car", name: { en: "Hatchback" } },
  { id: "sedan", kind: "car", name: { en: "Sedan" } },
  { id: "scooter", kind: "two-wheeler", name: { en: "Scooter" } },
];

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
    signs: [{ en: "A squeal when you brake" }],
    pricedAfterInspection: false,
    ...overrides,
  };
}

function price(overrides: Partial<ServicePrice> = {}): ServicePrice {
  return { serviceId: "brakes", categoryId: "hatchback", fuel: null, pricePaise: 150_000, ...overrides };
}

const petrolHatchback: PricedVehicle = { kind: "car", categoryId: "hatchback", fuel: "petrol" };

describe("checkServices", () => {
  test("a valid set has no problems", () => {
    const periodic = service({ id: "periodic-service", fuels: ["petrol", "diesel", "cng"] });
    const prices = [
      price(),
      price({ categoryId: "scooter", pricePaise: 60_000 }),
      price({ serviceId: "periodic-service", fuel: "petrol" }),
      price({ serviceId: "periodic-service", fuel: "diesel", pricePaise: 180_000 }),
      price({ serviceId: "periodic-service", fuel: null, pricePaise: 160_000 }),
    ];
    expect(checkServices([service(), periodic], prices, categories)).toEqual([]);
  });

  test.each([
    ["bad-id", service({ id: "Brakes" })],
    ["bad-id", service({ id: "brakes.html" })],
    ["no-vehicle-kinds", service({ vehicleKinds: [] })],
    ["repeated-vehicle-kind", service({ vehicleKinds: ["car", "car"] })],
    ["no-fuels", service({ fuels: [] })],
    ["repeated-fuel", service({ fuels: ["petrol", "petrol"] })],
    ["no-included", service({ included: [] })],
    ["blank-name", service({ name: { en: "  " } })],
    ["blank-summary", service({ summary: { en: "" } })],
    ["blank-item", service({ included: [{ en: "Check the pads" }, { en: " " }] })],
    ["blank-item", service({ signs: [{ en: "" }] })],
    ["package-vehicle-kinds", service({ kind: "package", vehicleKinds: ["car", "two-wheeler"] })],
  ] as const)("reports %s", (problem, broken) => {
    expect(checkServices([broken], [], categories)).toEqual([{ problem, id: broken.id }]);
  });

  test("reports a duplicate id", () => {
    expect(checkServices([service(), service()], [], categories)).toEqual([{ problem: "duplicate-id", id: "brakes" }]);
  });

  const onlyCars = service({ vehicleKinds: ["car"], fuels: ["petrol", "diesel"] });

  test.each([
    ["unknown-service", price({ serviceId: "towing" }), "towing/hatchback/every-fuel"],
    ["unknown-category", price({ categoryId: "truck" }), "brakes/truck/every-fuel"],
    ["category-kind", price({ categoryId: "scooter" }), "brakes/scooter/every-fuel"],
    ["fuel-not-covered", price({ fuel: "electric" }), "brakes/hatchback/electric"],
    ["bad-price", price({ pricePaise: 0 }), "brakes/hatchback/every-fuel"],
    ["bad-price", price({ pricePaise: -100 }), "brakes/hatchback/every-fuel"],
    ["bad-price", price({ pricePaise: 12.5 }), "brakes/hatchback/every-fuel"],
    ["bad-price", price({ pricePaise: Number.MAX_SAFE_INTEGER + 1 }), "brakes/hatchback/every-fuel"],
  ] as const)("reports %s for a price row", (problem, row, id) => {
    expect(checkServices([onlyCars], [row], categories)).toEqual([{ problem, id }]);
  });

  test("reports a second row for the same service, group and fuel, the every-fuel row too", () => {
    const rows = [price(), price({ pricePaise: 90_000 }), price({ fuel: "petrol" }), price({ fuel: "petrol" })];
    expect(checkServices([service()], rows, categories)).toEqual([
      { problem: "duplicate-price", id: "brakes/hatchback/every-fuel" },
      { problem: "duplicate-price", id: "brakes/hatchback/petrol" },
    ]);
  });
});

describe("priceFor", () => {
  test("a row for the exact fuel wins over the every-fuel row", () => {
    const rows = [price({ pricePaise: 150_000 }), price({ fuel: "petrol", pricePaise: 120_000 })];
    expect(priceFor(service(), rows, petrolHatchback)).toEqual({ status: "price", paise: 120_000 });
    expect(priceFor(service(), rows, { ...petrolHatchback, fuel: "diesel" })).toEqual({
      status: "price",
      paise: 150_000,
    });
  });

  test("an every-fuel row alone prices every fuel the service covers", () => {
    expect(priceFor(service(), [price()], { ...petrolHatchback, fuel: "cng" })).toEqual({
      status: "price",
      paise: 150_000,
    });
  });

  test("only rows for this service and this price group count", () => {
    const rows = [price({ categoryId: "sedan" }), price({ serviceId: "ac" })];
    expect(priceFor(service(), rows, petrolHatchback)).toEqual({ status: "no-price" });
  });

  test("a kind the service doesn't cover is not offered, even with a row", () => {
    const carsOnly = service({ vehicleKinds: ["car"] });
    expect(priceFor(carsOnly, [price({ categoryId: "scooter" })], { kind: "two-wheeler", categoryId: "scooter", fuel: "petrol" })).toEqual({
      status: "not-offered",
    });
  });

  test("a fuel the service doesn't cover is not offered (engine work on an electric car)", () => {
    const engine = service({ id: "engine", fuels: ["petrol", "diesel", "cng"] });
    expect(priceFor(engine, [price({ serviceId: "engine" })], { ...petrolHatchback, fuel: "electric" })).toEqual({
      status: "not-offered",
    });
  });

  test("a service priced after an inspection says so, even when it has rows", () => {
    expect(priceFor(service({ pricedAfterInspection: true }), [price()], petrolHatchback)).toEqual({
      status: "on-inspection",
    });
  });

  test("no row means no price yet", () => {
    expect(priceFor(service(), [], petrolHatchback)).toEqual({ status: "no-price" });
  });
});

describe("fromPrice", () => {
  test("the lowest price any covered vehicle pays", () => {
    const rows = [
      price({ pricePaise: 150_000 }),
      price({ categoryId: "sedan", fuel: "diesel", pricePaise: 210_000 }),
      price({ categoryId: "scooter", pricePaise: 60_000 }),
    ];
    expect(fromPrice(service(), rows)).toBe(60_000);
  });

  test("ignores an every-fuel row that exact-fuel rows replace for every covered fuel", () => {
    const petrolDiesel = service({ fuels: ["petrol", "diesel"] });
    const rows = [
      price({ pricePaise: 50_000 }),
      price({ fuel: "petrol", pricePaise: 120_000 }),
      price({ fuel: "diesel", pricePaise: 140_000 }),
    ];
    expect(fromPrice(petrolDiesel, rows)).toBe(120_000);
  });

  test("ignores other services' rows", () => {
    expect(fromPrice(service(), [price({ serviceId: "ac", pricePaise: 1 }), price()])).toBe(150_000);
  });

  test("is null with no rows, or for a service priced after an inspection", () => {
    expect(fromPrice(service(), [])).toBeNull();
    expect(fromPrice(service({ pricedAfterInspection: true }), [price()])).toBeNull();
  });
});

test("the service kinds", () => {
  expect(SERVICE_KINDS).toEqual(["service", "package"]);
});

test("a service's page address is its id under /services", () => {
  expect(servicePath("brakes")).toBe("/services/brakes");
});
