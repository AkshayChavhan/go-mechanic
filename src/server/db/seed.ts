// Puts the owner's garage into a new database.
//
// Runs on every start of a local (PGlite) database, right after the
// migrations (src/server/db/index.ts). It only fills what's missing: once the
// garage row exists, it never changes it, so the owner's later edits survive
// restarts. A real Postgres (staging, production) is never seeded by the app;
// task 20 does that on purpose.

import "server-only";

import { checkGarage, type Garage } from "@/domain/garage";
import { WEEKDAYS, type WeeklyHours } from "@/domain/opening-hours";

import type { Database } from "./index";
import { garageSettings, openingHours } from "./schema";
import { ownerGarage } from "./seed-data";

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
