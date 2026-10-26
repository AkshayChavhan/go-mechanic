// The garage's details: phone, WhatsApp, address and opening hours.
//
// The owner gave these on 2026-10-26. Until task 14 moves them into the
// database, this file is the one place to change them.
//
// Only SiteChrome reads this file. Every other component gets the values as
// props, so task 14 swaps one reader, and /dev/design can show the components
// with demo data. Components may import the `Garage` type, never `garage`.
//
// The brand name isn't here: it lives in messages/en.json (Brand.name).

import type { WeeklyHours } from "@/domain/opening-hours";
import type { LocalizedText } from "@/i18n/localized-text";

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

// `satisfies` checks this object against the Garage type (a typo or a missing
// field fails `npm run typecheck`) without forgetting the exact values.
export const garage = {
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
} satisfies Garage;
