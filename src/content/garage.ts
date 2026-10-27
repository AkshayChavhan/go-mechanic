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

// The Garage type and its rules live in src/domain/garage.ts. The type is
// re-exported here so the components that import it from this file keep
// working until task 14 deletes this file (the database takes over).
import type { Garage } from "@/domain/garage";

export type { Garage };

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
