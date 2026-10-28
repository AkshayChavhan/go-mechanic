import { describe, expect, test } from "vitest";

import { VEHICLE_KINDS } from "@/domain/vehicles";

import { services } from "./services";

// The services the home page lists (plan KTD8). The names and their order are
// the owner's (features.md, item 4). The one-line summaries and the vehicle
// kinds are drafts the owner checks at the look check; if a test here fails
// after an edit, check the change with the owner.

describe("the services list", () => {
  test("is the owner's eleven services, in the owner's order", () => {
    expect(services.map(({ name }) => name.en)).toEqual([
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
    ]);
  });

  test("has unique ids", () => {
    const ids = services.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test.each(services)("$id: the id can be a page address (task 18)", ({ id }) => {
    // Lowercase words joined by hyphens. No dots: the proxy treats a dotted
    // path as a file (CLAUDE.md, "Languages").
    expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  test.each(services)("$id: an English name and a one-line English summary", ({ name, summary }) => {
    expect(name.en.trim()).not.toBe("");
    expect(summary.en.trim()).not.toBe("");
    expect(summary.en).not.toContain("\n");
  });

  test.each(services)("$id: covers at least one kind of vehicle, each named once", ({ vehicles }) => {
    expect(vehicles.length).toBeGreaterThan(0);
    expect(new Set(vehicles).size).toBe(vehicles.length);
    for (const kind of vehicles) expect(VEHICLE_KINDS).toContain(kind);
  });
});
