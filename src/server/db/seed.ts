// Puts the owner's garage and slot rules into a new database.
//
// Runs on every start of a local (PGlite) database, right after the
// migrations (src/server/db/index.ts). It only fills what's missing: once the
// garage row exists, it never changes it, so the owner's later edits survive
// restarts. The same goes for the slot rules row, seeded on its own so a
// database made before task 22 gets it on its next start. A real Postgres
// (staging, production) is never seeded by the app; task 20 does that on
// purpose, slot rules included.

import "server-only";

import { checkGarage, type Garage } from "@/domain/garage";
import { WEEKDAYS, type WeeklyHours } from "@/domain/opening-hours";
import { checkSlotRules, type SlotRules } from "@/domain/slots";

import type { Database } from "./index";
import { garageSettings, openingHours, slotRules } from "./schema";
import { ownerGarage, ownerSlotRules } from "./seed-data";

/** The garage_settings row for `garage` (id, created_at and updated_at use their defaults). */
export function garageSettingsRow(garage: Garage): typeof garageSettings.$inferInsert {
  return {
    phone: garage.phone,
    whatsapp: garage.whatsapp,
    addressText: garage.address.text,
    postalCode: garage.address.postalCode,
  };
}

/** The seven opening_hours rows for `hours`: no times on a closed day. */
export function openingHoursRows(hours: WeeklyHours): (typeof openingHours.$inferInsert)[] {
  return WEEKDAYS.map((weekday) => {
    const day = hours[weekday];
    return day === "closed"
      ? { weekday, opens: null, closes: null }
      : { weekday, opens: day.opens, closes: day.closes };
  });
}

/**
 * Inserts `garage` (the owner's details by default) when the database has no
 * garage yet. Checks it first and throws if checkGarage finds a problem, so a
 * typo in seed-data.ts fails loudly instead of reaching the site.
 * All in one transaction: the row and its hours go in together, or not at all.
 */
export async function seedGarage(db: Database, garage: Garage = ownerGarage): Promise<void> {
  const problems = checkGarage(garage);
  if (problems.length > 0) {
    throw new Error(`The seed garage is invalid: ${JSON.stringify(problems)}`);
  }

  await db.transaction(async (tx) => {
    // "on conflict do nothing": if row 1 already exists, insert nothing and
    // return no rows, instead of failing.
    const inserted = await tx
      .insert(garageSettings)
      .values(garageSettingsRow(garage))
      .onConflictDoNothing()
      .returning({ id: garageSettings.id });
    // The garage was already there: its hours are the owner's, keep them.
    if (inserted.length === 0) return;

    await tx.insert(openingHours).values(openingHoursRows(garage.hours));
  });
}

/** The slot_rules row for `rules` (id, created_at and updated_at use their defaults). */
export function slotRulesRow(rules: SlotRules): typeof slotRules.$inferInsert {
  return {
    slotMinutes: rules.slotMinutes,
    capacity: rules.capacity,
    minDaysAhead: rules.minDaysAhead,
    maxDaysAhead: rules.maxDaysAhead,
  };
}

/**
 * Inserts `rules` (the owner's by default) when the database has no slot
 * rules yet, and never changes a row that's there. Checks them first and
 * throws if checkSlotRules finds a problem, so a typo in seed-data.ts fails
 * loudly. Separate from seedGarage, so the tests that delete and re-seed the
 * garage don't touch it.
 */
export async function seedSlotRules(db: Database, rules: SlotRules = ownerSlotRules): Promise<void> {
  const problems = checkSlotRules(rules);
  if (problems.length > 0) {
    throw new Error(`The seed slot rules are invalid: ${JSON.stringify(problems)}`);
  }
  await db.insert(slotRules).values(slotRulesRow(rules)).onConflictDoNothing();
}
