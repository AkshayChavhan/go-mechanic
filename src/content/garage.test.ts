import { describe, expect, test } from "vitest";

import { checkWeeklyHours, groupWeeklyHours, WEEKDAYS } from "@/domain/opening-hours";
import { formatAddress } from "@/i18n/format";
import { formatPhoneNumber, isIndianMobileNumber, isIndianPhoneNumber, telHref } from "@/lib/contact-links";

import { garage } from "./garage";

// The owner's real details, given on 2026-10-26. If one of these tests fails
// after an edit to garage.ts, check the new value with the owner.

describe("the garage's phone and WhatsApp numbers", () => {
  test("are the owner's number, stored in E.164 form", () => {
    expect(garage.phone).toBe("+919764750567");
    expect(garage.whatsapp).toBe("+919764750567");
  });

  test("are valid: any Indian number for calls, a mobile for WhatsApp", () => {
    expect(isIndianPhoneNumber(garage.phone)).toBe(true);
    expect(isIndianMobileNumber(garage.whatsapp)).toBe(true);
  });

  test("show and dial the way the owner expects", () => {
    expect(formatPhoneNumber(garage.phone)).toBe("+91 97647 50567");
    expect(telHref(garage.phone)).toBe("tel:+919764750567");
  });
});

describe("the garage's address", () => {
  test("is the owner's text exactly, with the PIN code kept separately", () => {
    expect(garage.address.text.en).toBe("Mukai Chowk, Kiwale, Pune, Maharashtra");
    expect(garage.address.postalCode).toBe("412101");
    expect(garage.address.countryCode).toBe("IN");
  });

  test("is shown with the PIN code at the end", () => {
    expect(formatAddress(garage.address, "en")).toBe("Mukai Chowk, Kiwale, Pune, Maharashtra 412101");
  });
});

describe("the garage's opening hours", () => {
  test("Monday is closed; every other day is 10:00 to 19:00", () => {
    expect(garage.hours.monday).toBe("closed");
    for (const weekday of WEEKDAYS.filter((day) => day !== "monday")) {
      expect(garage.hours[weekday], weekday).toEqual({ opens: "10:00", closes: "19:00" });
    }
  });

  test("pass validation", () => {
    expect(checkWeeklyHours(garage.hours)).toEqual([]);
  });

  test("group into Monday closed, then Tuesday to Sunday", () => {
    expect(groupWeeklyHours(garage.hours)).toEqual([
      { from: "monday", to: "monday", hours: "closed" },
      { from: "tuesday", to: "sunday", hours: { opens: "10:00", closes: "19:00" } },
    ]);
  });
});
