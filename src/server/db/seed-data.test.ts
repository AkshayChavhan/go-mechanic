import { describe, expect, test } from "vitest";

import { checkGarage } from "@/domain/garage";
import { groupWeeklyHours, WEEKDAYS } from "@/domain/opening-hours";
import { checkSlotRules } from "@/domain/slots";
import { formatAddress } from "@/i18n/format";
import { formatPhoneNumber, telHref } from "@/lib/contact-links";

import { ownerGarage, ownerSlotRules } from "./seed-data";

// The owner's real details, given on 2026-10-26. If one of these tests fails
// after an edit to seed-data.ts, check the new value with the owner.

describe("the owner's phone and WhatsApp numbers", () => {
  test("are the owner's number, stored in E.164 form", () => {
    expect(ownerGarage.phone).toBe("+919764750567");
    expect(ownerGarage.whatsapp).toBe("+919764750567");
  });

  test("show and dial the way the owner expects", () => {
    expect(formatPhoneNumber(ownerGarage.phone)).toBe("+91 97647 50567");
    expect(telHref(ownerGarage.phone)).toBe("tel:+919764750567");
  });
});

describe("the owner's address", () => {
  test("is the owner's text exactly, with the PIN code kept separately", () => {
    expect(ownerGarage.address.text.en).toBe("Mukai Chowk, Kiwale, Pune, Maharashtra");
    expect(ownerGarage.address.postalCode).toBe("412101");
    expect(ownerGarage.address.countryCode).toBe("IN");
  });

  test("is shown with the PIN code at the end", () => {
    expect(formatAddress(ownerGarage.address, "en")).toBe("Mukai Chowk, Kiwale, Pune, Maharashtra 412101");
  });
});

describe("the owner's opening hours", () => {
  test("Monday is closed; every other day is 10:00 to 19:00", () => {
    expect(ownerGarage.hours.monday).toBe("closed");
    for (const weekday of WEEKDAYS.filter((day) => day !== "monday")) {
      expect(ownerGarage.hours[weekday], weekday).toEqual({ opens: "10:00", closes: "19:00" });
    }
  });

  test("group into Monday closed, then Tuesday to Sunday", () => {
    expect(groupWeeklyHours(ownerGarage.hours)).toEqual([
      { from: "monday", to: "monday", hours: "closed" },
      { from: "tuesday", to: "sunday", hours: { opens: "10:00", closes: "19:00" } },
    ]);
  });
});

describe("the whole garage", () => {
  test("passes every check a save makes (numbers, PIN code, address, hours)", () => {
    expect(checkGarage(ownerGarage)).toEqual([]);
  });
});

describe("the owner's slot rules (2026-10-28)", () => {
  test("are 1-hour slots, bookable from tomorrow up to 7 days ahead", () => {
    expect(ownerSlotRules.slotMinutes).toBe(60);
    expect(ownerSlotRules.minDaysAhead).toBe(1);
    expect(ownerSlotRules.maxDaysAhead).toBe(7);
  });

  test("hold 2 vehicles per slot: a placeholder until the owner gives the real number", () => {
    expect(ownerSlotRules.capacity).toBe(2);
  });

  test("pass every check a save makes", () => {
    expect(checkSlotRules(ownerSlotRules)).toEqual([]);
  });
});
