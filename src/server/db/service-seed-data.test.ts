import { describe, expect, test } from "vitest";

import { checkServices } from "@/domain/services";

import { draftServices } from "./service-seed-data";
import { draftCatalogue } from "./vehicle-seed-data";

// The owner's 11 services (features.md, item 4), in the owner's order.
const OWNER_SERVICES = [
  "Periodic service",
  "AC",
  "Denting and painting",
  "Battery",
  "Tyres and alignment",
  "Brakes",
  "Clutch and suspension",
  "Engine",
  "Electricals",
  "Wash and detailing",
  "Insurance claim help",
];

const servicesOnly = draftServices.filter((service) => service.kind === "service");
const packages = draftServices.filter((service) => service.kind === "package");

describe("the draft services", () => {
  test("are exactly the owner's services, in the owner's order, before the packages", () => {
    expect(servicesOnly.map((service) => service.name.en)).toEqual(OWNER_SERVICES);
    expect(draftServices.slice(0, OWNER_SERVICES.length)).toEqual(servicesOnly);
  });

  test("pass every check, against the draft price groups", () => {
    expect(checkServices(draftServices, [], draftCatalogue.categories)).toEqual([]);
  });

  test("each summary is one line", () => {
    for (const service of draftServices) expect(service.summary.en, service.id).not.toContain("\n");
  });

  test("each service lists the signs you need it", () => {
    for (const service of servicesOnly) expect(service.signs.length, service.id).toBeGreaterThan(0);
  });

  test("the five services priced after an inspection", () => {
    expect(draftServices.filter((service) => service.pricedAfterInspection).map((service) => service.id)).toEqual([
      "denting-painting",
      "clutch-suspension",
      "engine",
      "electricals",
      "insurance-claim-help",
    ]);
  });

  test("engine work, periodic service and the packages leave out electric vehicles (until the owner says)", () => {
    const leaveOut = draftServices.filter((service) => !service.fuels.includes("electric")).map((service) => service.id);
    expect(leaveOut).toEqual(["periodic-service", "engine", ...packages.map((service) => service.id)]);
  });
});

describe("the draft packages", () => {
  test("are Basic, Standard and Comprehensive for cars, then for two-wheelers", () => {
    expect(packages.map((service) => service.id)).toEqual([
      "car-basic",
      "car-standard",
      "car-comprehensive",
      "two-wheeler-basic",
      "two-wheeler-standard",
      "two-wheeler-comprehensive",
    ]);
    for (const service of packages) {
      expect(service.vehicleKinds, service.id).toEqual([service.id.startsWith("car-") ? "car" : "two-wheeler"]);
    }
  });

  test("each has a checklist, no signs, and a list price (not an inspection)", () => {
    for (const service of packages) {
      expect(service.included.length, service.id).toBeGreaterThan(0);
      expect(service.signs, service.id).toEqual([]);
      expect(service.pricedAfterInspection, service.id).toBe(false);
    }
  });
});
