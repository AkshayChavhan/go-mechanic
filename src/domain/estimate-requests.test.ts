import { describe, expect, test } from "vitest";

import {
  checkEstimateRequestInput,
  ESTIMATE_REQUEST_RULES,
  type EstimateRequestInput,
  normalizeDescription,
} from "./estimate-requests";

const TOKEN = "3f2b8c4e-1d2a-4b6c-9e8f-0a1b2c3d4e5f";
const SET = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const VEHICLE = "11111111-2222-4333-8444-555555555555";

function input(overrides: Partial<EstimateRequestInput> = {}): EstimateRequestInput {
  return {
    vehicle: { savedVehicleId: VEHICLE },
    description: "Brakes squeal when I stop",
    photoSetId: "",
    requestToken: TOKEN,
    ...overrides,
  };
}

describe("normalizeDescription", () => {
  test("trims, keeps line breaks, drops spaces at line ends and Windows line breaks", () => {
    expect(normalizeDescription("  Squeal  \r\nOnly when cold \n\n")).toBe("Squeal\nOnly when cold");
  });
});

describe("checkEstimateRequestInput", () => {
  test("a saved vehicle and a 10-character description pass, trimmed", () => {
    const result = checkEstimateRequestInput(input({ description: "  0123456789  " }));
    expect(result).toEqual({
      ok: true,
      request: { vehicle: { saved: true, vehicleId: VEHICLE }, description: "0123456789", photoSetId: null, requestToken: TOKEN },
    });
  });

  test("a typed vehicle with a model and a valid fuel passes", () => {
    const result = checkEstimateRequestInput(input({ vehicle: { modelId: " car-honda-city ", fuel: "petrol" } }));
    expect(result.ok && result.request.vehicle).toEqual({ saved: false, modelId: "car-honda-city", fuel: "petrol" });
  });

  test.each([
    [{ modelId: "", fuel: "petrol" }, "vehicle-missing"],
    [{ modelId: "car-honda-city", fuel: " " }, "vehicle-missing"],
    [{ savedVehicleId: "  " }, "vehicle-missing"],
    [{ modelId: "car-honda-city", fuel: "steam" }, "vehicle-fuel-not-offered"],
  ] as const)("vehicle %o gives %s", (vehicle, problem) => {
    expect(checkEstimateRequestInput(input({ vehicle }))).toEqual({ ok: false, problems: [{ field: "vehicle", problem }] });
  });

  test.each([
    ["   \n  ", "description-missing"],
    ["123456789", "description-too-short"],
    ["x".repeat(ESTIMATE_REQUEST_RULES.descriptionMaxLength + 1), "description-too-long"],
  ])("description %j gives %s", (description, problem) => {
    expect(checkEstimateRequestInput(input({ description }))).toEqual({
      ok: false,
      problems: [{ field: "description", problem }],
    });
  });

  test("lengths count characters: 1,000 emoji pass, 9 emoji are too short", () => {
    expect(checkEstimateRequestInput(input({ description: "🚗".repeat(1000) })).ok).toBe(true);
    expect(checkEstimateRequestInput(input({ description: "🚗".repeat(9) })).ok).toBe(false);
  });

  test("a photo set id is kept, lowercased; one that isn't a uuid gives photos-not-found", () => {
    const result = checkEstimateRequestInput(input({ photoSetId: ` ${SET.toUpperCase()} ` }));
    expect(result.ok && result.request.photoSetId).toBe(SET);
    expect(checkEstimateRequestInput(input({ photoSetId: "abc" }))).toEqual({
      ok: false,
      problems: [{ field: "photos", problem: "photos-not-found" }],
    });
  });

  test("a request token that isn't a uuid is a bad request", () => {
    expect(checkEstimateRequestInput(input({ requestToken: "" }))).toEqual({
      ok: false,
      problems: [{ field: "form", problem: "bad-request" }],
    });
  });

  test("several problems come back together", () => {
    const result = checkEstimateRequestInput(
      input({ vehicle: { modelId: "", fuel: "" }, description: "short", photoSetId: "x", requestToken: "y" }),
    );
    expect(result).toEqual({
      ok: false,
      problems: [
        { field: "vehicle", problem: "vehicle-missing" },
        { field: "description", problem: "description-too-short" },
        { field: "photos", problem: "photos-not-found" },
        { field: "form", problem: "bad-request" },
      ],
    });
  });
});
