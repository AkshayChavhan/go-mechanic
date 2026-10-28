// The garage's real details: what every new database starts with.
//
// The owner gave these on 2026-10-26 (task 12 in document/task/task.md). A
// new local database gets them on its first use (src/server/db/seed.ts); the
// owner changes them later from the admin screens (tasks 28 and 40), not here.
//
// Plain data, with no server-only import: the unit tests and the Playwright
// tests (e2e/) import `ownerGarage` as the values they expect on the page.

import type { Garage } from "@/domain/garage";

// `satisfies` checks this object against the Garage type (a typo or a missing
// field fails `npm run typecheck`) without forgetting the exact values.
export const ownerGarage = {
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
