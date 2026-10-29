import { describe, expect, test } from "vitest";

import { checkCatalogue } from "@/domain/vehicles";

import { draftCatalogue } from "./vehicle-seed-data";

// The brands are the owner's answer of 2026-10-28 (task 17), in their order.
const OWNER_CAR_BRANDS = [
  "Maruti Suzuki",
  "Hyundai",
  "Tata",
  "Mahindra",
  "Kia",
  "Toyota",
  "Honda",
  "MG",
  "Renault",
  "Skoda",
  "Volkswagen",
  "Nissan",
];
const OWNER_TWO_WHEELER_BRANDS = [
  "Hero",
  "Honda",
  "TVS",
  "Bajaj",
  "Royal Enfield",
  "Yamaha",
  "Suzuki",
  "KTM",
  "Ather",
  "Ola Electric",
];

const brandsOf = (kind: "car" | "two-wheeler") =>
  draftCatalogue.makes.filter((make) => make.kind === kind).map((make) => make.name.en);

describe("the draft catalogue", () => {
  test("serves exactly the owner's car brands, in the owner's order", () => {
    expect(brandsOf("car")).toEqual(OWNER_CAR_BRANDS);
  });

  test("serves exactly the owner's two-wheeler brands, in the owner's order", () => {
    expect(brandsOf("two-wheeler")).toEqual(OWNER_TWO_WHEELER_BRANDS);
  });

  test("passes every check a save makes", () => {
    expect(checkCatalogue(draftCatalogue)).toEqual([]);
  });

  test("uses every price group, and has about 5 to 10 models a brand", () => {
    const used = new Set(draftCatalogue.makes.flatMap((make) => make.models.map((model) => model.categoryId)));
    expect([...used].sort()).toEqual(draftCatalogue.categories.map((category) => category.id).sort());
    for (const make of draftCatalogue.makes) {
      expect(make.models.length, make.id).toBeGreaterThanOrEqual(4);
      expect(make.models.length, make.id).toBeLessThanOrEqual(10);
    }
  });
});
