import { describe, expect, test } from "vitest";

import { asksForPickup, checkPickupInput, findPickupArea, normalizeAddress, PICKUP_RULES } from "./pickup";

describe("normalizeAddress", () => {
  test("trims and collapses spaces and line breaks", () => {
    expect(normalizeAddress("  12, MG Road\n  Chakan ")).toBe("12, MG Road Chakan");
  });
});

describe("asksForPickup", () => {
  test("nothing sent, or both fields blank: no pickup", () => {
    expect(asksForPickup(undefined)).toBe(false);
    expect(asksForPickup({ address: "  ", postalCode: "" })).toBe(false);
  });

  test("either field filled: pickup was asked for", () => {
    expect(asksForPickup({ address: "", postalCode: "412101" })).toBe(true);
    expect(asksForPickup({ address: "12, MG Road", postalCode: " " })).toBe(true);
  });
});

describe("checkPickupInput", () => {
  test("a good address and PIN code come back cleaned", () => {
    expect(checkPickupInput({ address: "  Flat 4,  Shivneri Society\nChakan ", postalCode: "412 101" })).toEqual({
      ok: true,
      pickup: { address: "Flat 4, Shivneri Society Chakan", postalCode: "412101" },
    });
  });

  test.each([
    ["blank", "   ", "address-missing"],
    ["9 characters", "a".repeat(PICKUP_RULES.addressMinLength - 1), "address-too-short"],
    ["201 characters", "a".repeat(PICKUP_RULES.addressMaxLength + 1), "address-too-long"],
  ])("an address that is %s is refused", (_case, address, problem) => {
    expect(checkPickupInput({ address, postalCode: "412101" })).toEqual({ ok: false, problems: [problem] });
  });

  test("10 and 200 characters are the limits", () => {
    expect(checkPickupInput({ address: "a".repeat(10), postalCode: "412101" }).ok).toBe(true);
    expect(checkPickupInput({ address: "a".repeat(200), postalCode: "412101" }).ok).toBe(true);
  });

  test("lengths count characters, not bytes", () => {
    expect(checkPickupInput({ address: "पुणे".repeat(50), postalCode: "412101" }).ok).toBe(true);
  });

  test.each([["41210"], ["4121011"], ["012345"], ["41A101"], [""]])("PIN code %j is refused", (postalCode) => {
    expect(checkPickupInput({ address: "12, MG Road, Chakan", postalCode })).toEqual({
      ok: false,
      problems: ["postal-code-invalid"],
    });
  });

  test("both problems come back together", () => {
    expect(checkPickupInput({ address: "", postalCode: "1" })).toEqual({
      ok: false,
      problems: ["address-missing", "postal-code-invalid"],
    });
  });
});

describe("findPickupArea", () => {
  const areas = [
    { postalCode: "412101", feePaise: 0 },
    { postalCode: "411001", feePaise: 30_000 },
  ];

  test("finds a listed PIN code, a free one too", () => {
    expect(findPickupArea(areas, "411001")).toEqual({ postalCode: "411001", feePaise: 30_000 });
    expect(findPickupArea(areas, "412101")).toEqual({ postalCode: "412101", feePaise: 0 });
  });

  test("a PIN code the garage doesn't serve is null", () => {
    expect(findPickupArea(areas, "560001")).toBeNull();
    expect(findPickupArea([], "412101")).toBeNull();
  });
});
