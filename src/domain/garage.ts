// The garage's details (phone, WhatsApp, address, hours) and the rules they
// must pass before they're saved.
//
// Pure logic: no Next.js, React or database imports. The database stores
// these details (src/server/db/), the data-access layer reads and saves them
// (src/server/dal/garage.ts), and components get them as props.
//
// The brand name isn't here: it lives in messages/en.json (Brand.name).

import { checkWeeklyHours, type HoursProblem, type WeeklyHours, type Weekday } from "@/domain/opening-hours";
import type { LocalizedText } from "@/i18n/localized-text";
import { isIndianMobileNumber, isIndianPhoneNumber } from "@/lib/contact-links";

export type Garage = {
  /**
   * The number visitors call, in E.164 form ("+91" and 10 digits). Any Indian
   * number, a landline too. Shown with formatPhoneNumber, dialled with telHref
   * (src/lib/contact-links.ts).
   */
  phone: string;
  /**
   * The WhatsApp number, in E.164 form. Must be a mobile. Kept apart from
   * `phone`, so adding a landline later can't break WhatsApp.
   */
  whatsapp: string;
  address: {
    /**
     * Street, area, city and state, exactly as the owner wrote them. Task 42
     * splits them into parts for search engines; until then, nothing is guessed.
     */
    text: LocalizedText;
    /** The 6-digit PIN code. formatAddress (src/i18n/format.ts) adds it to the text. */
    postalCode: string;
    /** The country, as an ISO 3166 code, for search engines (task 42). */
    countryCode: "IN";
  };
  /** Opening hours, India time (Asia/Kolkata). Monday first. */
  hours: WeeklyHours;
};

/**
 * One thing wrong with a garage. Codes, not sentences, so the admin forms
 * (tasks 28 and 40) can show a translated message next to the right field.
 */
export type GarageProblem =
  | { field: "phone" | "whatsapp" | "address" | "postalCode" }
  | { field: "hours"; weekday: Weekday; problem: HoursProblem };

// Six digits, and the first is never 0: Indian PIN codes start with 1 to 9
// (the first digit is the postal region).
const INDIAN_PIN_CODE = /^[1-9]\d{5}$/;

/** A 6-digit Indian PIN code: "412101". */
export function isIndianPinCode(code: string): boolean {
  return INDIAN_PIN_CODE.test(code);
}

/**
 * Everything wrong with `garage`, in the order a form shows the fields.
 * An empty list means it can be saved.
 */
export function checkGarage(garage: Garage): GarageProblem[] {
  const problems: GarageProblem[] = [];

  // Any Indian number for calls, a landline too; WhatsApp needs a mobile.
  if (!isIndianPhoneNumber(garage.phone)) problems.push({ field: "phone" });
  if (!isIndianMobileNumber(garage.whatsapp)) problems.push({ field: "whatsapp" });
  // English is required. Other languages are optional: localize() shows
  // English when one is missing or blank.
  if (garage.address.text.en.trim() === "") problems.push({ field: "address" });
  if (!isIndianPinCode(garage.address.postalCode)) problems.push({ field: "postalCode" });

  for (const { weekday, problem } of checkWeeklyHours(garage.hours)) {
    problems.push({ field: "hours", weekday, problem });
  }

  return problems;
}
