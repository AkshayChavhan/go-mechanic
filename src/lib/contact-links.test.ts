import { describe, expect, test } from "vitest";

import messages from "../../messages/en.json";
import {
  formatPhoneNumber,
  isIndianMobileNumber,
  isIndianPhoneNumber,
  parseIndianMobile,
  telHref,
  toAsciiDigits,
  whatsappHref,
} from "./contact-links";

// Numbers are stored in E.164 form: "+", the country code (91 for India),
// then the number itself, with no spaces.
const garageNumber = "+919764750567";
const landline = "+912027654321"; // a Pune landline: area code 20, then the number
const foreign = "+14155550123"; // a US number

/** The text a wa.me link will type into WhatsApp, decoded the way a browser would. */
const messageIn = (href: string) => new URL(href).searchParams.get("text");

describe("formatPhoneNumber (how a number is shown on the page)", () => {
  test("groups an Indian mobile the usual way", () => {
    expect(formatPhoneNumber(garageNumber)).toBe("+91 97647 50567");
  });

  test.each([
    ["a landline", landline],
    ["a foreign number", foreign],
    ["a number with spaces already", "+91 97647 50567"],
    ["an empty value", ""],
    ["text that isn't a number", "call us"],
  ])("shows %s as stored, without throwing", (_case, stored) => {
    expect(formatPhoneNumber(stored)).toBe(stored);
  });
});

describe("telHref (the link that dials)", () => {
  test("is exactly tel: plus the stored number", () => {
    expect(telHref(garageNumber)).toBe("tel:+919764750567");
  });

  test("drops spaces and dashes that slipped into a stored number", () => {
    expect(telHref("+91 97647-50567")).toBe("tel:+919764750567");
  });
});

describe("whatsappHref (the link that opens a WhatsApp chat)", () => {
  test("points at wa.me with the number as digits only", () => {
    expect(whatsappHref(garageNumber, "Hello")).toMatch(/^https:\/\/wa\.me\/919764750567\?text=/);
  });

  test("carries the message, apostrophe and new line included", () => {
    const message = "Hi, I'd like to book a service.\nCar: Maruti Swift";
    const href = whatsappHref(garageNumber, message);
    expect(messageIn(href)).toBe(message);
    // Spaces and the new line are encoded, so the link stays one valid URL.
    expect(href).not.toMatch(/\s/);
  });

  test.each(["whatsappMessage", "bookingMessage"] as const)(
    "carries the real %s from messages/en.json unchanged",
    (key) => {
      const message = messages.Contact[key];
      expect(messageIn(whatsappHref(garageNumber, message))).toBe(message);
    },
  );
});

describe("isIndianPhoneNumber and isIndianMobileNumber (checks for saving a number)", () => {
  test("accept the garage's number for calls and for WhatsApp", () => {
    expect(isIndianPhoneNumber(garageNumber)).toBe(true);
    expect(isIndianMobileNumber(garageNumber)).toBe(true);
  });

  test("a landline is fine for calls, but WhatsApp needs a mobile", () => {
    expect(isIndianPhoneNumber(landline)).toBe(true);
    expect(isIndianMobileNumber(landline)).toBe(false);
  });

  test("an Indian mobile number never starts with 5", () => {
    expect(isIndianMobileNumber("+915764750567")).toBe(false);
  });

  test.each([
    ["a foreign number", foreign],
    ["one digit short", "+91976475056"],
    ["one digit too many", "+9197647505670"],
    ["no + in front", "919764750567"],
    ["spaces inside", "+91 97647 50567"],
    ["a 0 in front of the number", "+910976475056"],
    ["empty", ""],
  ])("reject %s", (_case, number) => {
    expect(isIndianPhoneNumber(number)).toBe(false);
    expect(isIndianMobileNumber(number)).toBe(false);
  });
});

describe("parseIndianMobile (what someone typed on the login page)", () => {
  test.each([
    ["10 digits with a space", "98765 43210"],
    ["10 digits", "9876543210"],
    ["a leading 0 and a dash", "098765-43210"],
    ["91 in front", "919876543210"],
    ["+91 and spaces", "+91 98765 43210"],
    ["dots and brackets", "(98765).43210"],
    ["Devanagari digits", "९८७६५४३२१०"],
    ["spaces around it", "  98765 43210 "],
  ])("reads %s as +919876543210", (_case, typed) => {
    expect(parseIndianMobile(typed)).toBe("+919876543210");
  });

  test.each([
    ["a number starting with 5", "5876543210"],
    ["a landline", "020 2765 4321"],
    ["9 digits", "987654321"],
    ["11 digits", "98765432101"],
    ["a US number", "+1 2025550123"],
    ["letters", "98765abcde"],
    ["an empty string", ""],
    ["+91 twice", "+91+919876543210"],
  ])("rejects %s", (_case, typed) => {
    expect(parseIndianMobile(typed)).toBeNull();
  });

  test("toAsciiDigits leaves other text alone", () => {
    expect(toAsciiDigits("कोड १२३ abc 456")).toBe("कोड 123 abc 456");
  });
});
