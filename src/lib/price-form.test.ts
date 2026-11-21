import { describe, expect, test } from "vitest";

import { priceEntries, priceFieldName, readPriceForm } from "./price-form";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe("readPriceForm", () => {
  test("reads only the boxes the card posted", () => {
    expect(readPriceForm(form({ "price-group": "1,500", "price-diesel": "", role: "owner", serviceId: "x" }))).toEqual({
      group: "1,500",
      diesel: "",
    });
    expect(priceFieldName("cng")).toBe("price-cng");
  });
});

describe("priceEntries", () => {
  test("typed amounts become paise; blank boxes are no price", () => {
    expect(priceEntries({ group: "1,500", petrol: "", diesel: "₹1,800" })).toEqual({
      ok: true,
      entries: [
        { fuel: null, pricePaise: 150_000 },
        { fuel: "diesel", pricePaise: 180_000 },
      ],
    });
    expect(priceEntries({ group: " ", diesel: "" })).toEqual({ ok: true, entries: [] });
  });

  test("every box that can't be read gets its problem, and nothing is saved", () => {
    expect(priceEntries({ group: "1.500", petrol: "1,200", diesel: "abc" })).toEqual({
      ok: false,
      problems: [
        { box: "group", problem: "not-whole" },
        { box: "diesel", problem: "not-a-number" },
      ],
    });
  });
});
