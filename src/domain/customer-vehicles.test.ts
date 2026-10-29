import { describe, expect, test } from "vitest";

import { checkVehicleInput, isExpired, type VehicleInput } from "./customer-vehicles";
import type { VehicleCatalogue } from "./vehicles";

// A small catalogue: a petrol/CNG hatchback and an electric-only model.
const catalogue: VehicleCatalogue = {
  categories: [{ id: "hatchback", name: { en: "Hatchback" } }],
  makes: [
    {
      id: "car-maruti",
      kind: "car",
      name: { en: "Maruti Suzuki" },
      models: [
        { id: "car-maruti-swift", name: { en: "Swift" }, categoryId: "hatchback", fuels: ["petrol", "cng"] },
        { id: "car-maruti-evx", name: { en: "eVX" }, categoryId: "hatchback", fuels: ["electric"] },
      ],
    },
  ],
} as unknown as VehicleCatalogue;

const today = "2026-10-29";
const valid: VehicleInput = {
  modelId: "car-maruti-swift",
  fuel: "petrol",
  registration: "mh 12 ab 1234",
  pucExpiresOn: "2027-03-12",
  insuranceExpiresOn: "",
};

const problemsOf = (input: Partial<VehicleInput>) => {
  const result = checkVehicleInput({ ...valid, ...input }, catalogue, today);
  return result.ok ? [] : result.problems;
};

describe("checkVehicleInput (one vehicle a customer adds)", () => {
  test("a valid vehicle: the model, the fuel, the stored registration and the dates (an empty one is none)", () => {
    expect(checkVehicleInput(valid, catalogue, today)).toEqual({
      ok: true,
      vehicle: {
        modelId: "car-maruti-swift",
        fuel: "petrol",
        registrationNumber: "MH12AB1234",
        pucExpiresOn: "2027-03-12",
        insuranceExpiresOn: null,
      },
    });
  });

  test("no model or no fuel picked: vehicle-missing", () => {
    expect(problemsOf({ modelId: "" })).toEqual([{ field: "vehicle", problem: "vehicle-missing" }]);
    expect(problemsOf({ fuel: "" })).toEqual([{ field: "vehicle", problem: "vehicle-missing" }]);
  });

  test("an unknown model, a fuel the model doesn't offer, and a fuel that isn't one", () => {
    expect(problemsOf({ modelId: "car-maruti-nope" })).toEqual([{ field: "vehicle", problem: "vehicle-unknown-model" }]);
    expect(problemsOf({ fuel: "diesel" })).toEqual([{ field: "vehicle", problem: "vehicle-fuel-not-offered" }]);
    expect(problemsOf({ fuel: "hydrogen" })).toEqual([{ field: "vehicle", problem: "vehicle-fuel-not-offered" }]);
  });

  test("an electric vehicle has no PUC: a PUC date sent with it is dropped, not refused", () => {
    const result = checkVehicleInput({ ...valid, modelId: "car-maruti-evx", fuel: "electric" }, catalogue, today);
    expect(result).toMatchObject({ ok: true, vehicle: { fuel: "electric", pucExpiresOn: null } });
  });

  test("an electric vehicle's PUC date isn't even checked: the form hides that field, so its error could never show", () => {
    for (const pucExpiresOn of ["not a date", "1999-12-31"]) {
      const result = checkVehicleInput({ ...valid, modelId: "car-maruti-evx", fuel: "electric", pucExpiresOn }, catalogue, today);
      expect(result, pucExpiresOn).toMatchObject({ ok: true, vehicle: { pucExpiresOn: null } });
    }
  });

  test("dates: real calendar dates from 2000-01-01 to 10 years after today in India; the past is allowed", () => {
    expect(problemsOf({ pucExpiresOn: "2026-02-29" })).toEqual([{ field: "pucExpiresOn", problem: "date-invalid" }]);
    expect(problemsOf({ insuranceExpiresOn: "29-10-2026" })).toEqual([
      { field: "insuranceExpiresOn", problem: "date-invalid" },
    ]);
    expect(problemsOf({ pucExpiresOn: "1999-12-31" })).toEqual([{ field: "pucExpiresOn", problem: "date-out-of-range" }]);
    expect(problemsOf({ pucExpiresOn: "2036-10-29" })).toEqual([]);
    expect(problemsOf({ pucExpiresOn: "2036-10-30" })).toEqual([{ field: "pucExpiresOn", problem: "date-out-of-range" }]);
    expect(problemsOf({ insuranceExpiresOn: "2026-10-28" })).toEqual([]);
  });

  test("several bad fields: every problem at once, each tagged with its field", () => {
    expect(problemsOf({ fuel: "", registration: "MX12AB1234", insuranceExpiresOn: "2026-13-01" })).toEqual([
      { field: "vehicle", problem: "vehicle-missing" },
      { field: "registration", problem: "registration-unknown-state" },
      { field: "insuranceExpiresOn", problem: "date-invalid" },
    ]);
  });
});

describe("isExpired", () => {
  test("a date before today in India is expired; today and later are not", () => {
    expect(isExpired("2026-10-28", today)).toBe(true);
    expect(isExpired("2026-10-29", today)).toBe(false);
    expect(isExpired("2027-01-01", today)).toBe(false);
  });
});
