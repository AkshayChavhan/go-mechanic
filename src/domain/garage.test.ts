import { describe, expect, test } from "vitest";

import { checkGarage, type Garage, isIndianPinCode } from "./garage";

// A valid garage: the owner's details given on 2026-10-26, copied here so
// these rules are tested on their own. Each test changes one thing.
const valid: Garage = {
  phone: "+919764750567",
  whatsapp: "+919764750567",
  address: {
    text: { en: "Mukai Chowk, Kiwale, Pune, Maharashtra" },
    postalCode: "412101",
    countryCode: "IN",
  },
  hours: {
    monday: "closed",
    tuesday: { opens: "10:00", closes: "19:00" },
    wednesday: { opens: "10:00", closes: "19:00" },
    thursday: { opens: "10:00", closes: "19:00" },
    friday: { opens: "10:00", closes: "19:00" },
    saturday: { opens: "10:00", closes: "19:00" },
    sunday: { opens: "10:00", closes: "19:00" },
  },
};

const landline = "+912012345678"; // a Pune landline: area code 20

/** The valid garage with a few fields changed. */
const garageWith = (changes: Partial<Garage>): Garage => ({ ...valid, ...changes });
const addressWith = (changes: Partial<Garage["address"]>): Garage =>
  garageWith({ address: { ...valid.address, ...changes } });

describe("checkGarage (what must be true before the garage is saved)", () => {
  test("the owner's details have no problems", () => {
    expect(checkGarage(valid)).toEqual([]);
  });

  test("the number to call may be a landline", () => {
    expect(checkGarage(garageWith({ phone: landline }))).toEqual([]);
  });

  test("WhatsApp must be a mobile: a landline is a whatsapp problem", () => {
    expect(checkGarage(garageWith({ whatsapp: landline }))).toEqual([{ field: "whatsapp" }]);
  });

  test.each([
    ["with spaces (only E.164 is stored)", "+91 97647 50567"],
    ["without +91", "9764750567"],
    ["with the 0 trunk prefix", "+9109764750567"],
    ["empty", ""],
  ])("a phone number %s is a phone problem", (_case, phone) => {
    expect(checkGarage(garageWith({ phone }))).toEqual([{ field: "phone" }]);
  });

  test.each([
    ["starting with 0", "012345"],
    ["with 5 digits", "41210"],
    ["with 7 digits", "4121011"],
    ["with a space", "412 101"],
    ["empty", ""],
  ])("a PIN code %s is a postalCode problem", (_case, postalCode) => {
    expect(checkGarage(addressWith({ postalCode }))).toEqual([{ field: "postalCode" }]);
  });

  test.each([
    ["empty", ""],
    ["only spaces", "   "],
  ])("an English address that is %s is an address problem", (_case, en) => {
    expect(checkGarage(addressWith({ text: { en } }))).toEqual([{ field: "address" }]);
  });

  test.each([
    ["missing", { en: "Mukai Chowk, Kiwale, Pune, Maharashtra" }],
    ["blank", { en: "Mukai Chowk, Kiwale, Pune, Maharashtra", hi: " " }],
  ])("a %s Hindi address is fine (localize falls back to English)", (_case, text) => {
    expect(checkGarage(addressWith({ text }))).toEqual([]);
  });

  test("hours that close before they open are an hours problem, with the weekday", () => {
    const hours = { ...valid.hours, tuesday: { opens: "10:00", closes: "09:00" } };
    expect(checkGarage(garageWith({ hours }))).toEqual([
      { field: "hours", weekday: "tuesday", problem: "closes-before-opening" },
    ]);
  });

  test("several problems come back together, in the order a form shows the fields", () => {
    const broken: Garage = {
      phone: "+91 97647 50567",
      whatsapp: landline,
      address: { text: { en: "" }, postalCode: "41210", countryCode: "IN" },
      hours: {
        ...valid.hours,
        monday: { opens: "9am", closes: "19:00" },
        tuesday: { opens: "10:00", closes: "09:00" },
      },
    };
    expect(checkGarage(broken)).toEqual([
      { field: "phone" },
      { field: "whatsapp" },
      { field: "address" },
      { field: "postalCode" },
      { field: "hours", weekday: "monday", problem: "invalid-time" },
      { field: "hours", weekday: "tuesday", problem: "closes-before-opening" },
    ]);
  });
});

describe("isIndianPinCode (a 6-digit Indian postal code)", () => {
  test.each(["412101", "110001", "999999"])("accepts %s", (pin) => {
    expect(isIndianPinCode(pin)).toBe(true);
  });

  test.each(["012345", "41210", "4121011", "412 101", " 412101", "41210a", ""])("rejects %j", (pin) => {
    expect(isIndianPinCode(pin)).toBe(false);
  });
});
