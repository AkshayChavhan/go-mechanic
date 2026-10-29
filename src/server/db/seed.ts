// Puts the owner's garage, slot rules and the draft vehicle catalogue into a
// new database.
//
// Runs on every start of a local (PGlite) database, right after the
// migrations (src/server/db/index.ts). It only fills what's missing: once the
// garage row exists, it never changes it, so the owner's later edits survive
// restarts. The same goes for the slot rules row, seeded on its own so a
// database made before task 22 gets it on its next start, and for the vehicle
// catalogue (task 17), which gains only the rows it doesn't have. A real
// Postgres (staging, production) is never seeded by the app; task 20 does that
// on purpose, slot rules and catalogue included.

import "server-only";

import { checkGarage, type Garage } from "@/domain/garage";
import { WEEKDAYS, type WeeklyHours } from "@/domain/opening-hours";
import { checkSlotRules, type SlotRules } from "@/domain/slots";
import { checkCatalogue, type VehicleCatalogue } from "@/domain/vehicles";

import type { Database } from "./index";
import { garageSettings, openingHours, slotRules, vehicleCategories, vehicleMakes, vehicleModels } from "./schema";
import { ownerGarage, ownerSlotRules } from "./seed-data";
import { draftCatalogue } from "./vehicle-seed-data";

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

/**
 * The rows for `catalogue`. Each list's position is its place in the file;
 * created_at, updated_at and listed use their defaults.
 */
export function vehicleCatalogueRows(catalogue: VehicleCatalogue) {
  return {
    categories: catalogue.categories.map(
      (category, index): typeof vehicleCategories.$inferInsert => ({ ...category, position: index + 1 }),
    ),
    makes: catalogue.makes.map(
      ({ id, kind, name }, index): typeof vehicleMakes.$inferInsert => ({ id, kind, name, position: index + 1 }),
    ),
    models: catalogue.makes.flatMap((make) =>
      make.models.map(
        (model, index): typeof vehicleModels.$inferInsert => ({
          id: model.id,
          makeId: make.id,
          categoryId: model.categoryId,
          kind: make.kind,
          name: model.name,
          fuels: [...model.fuels],
          position: index + 1,
        }),
      ),
    ),
  };
}

/**
 * Adds the rows of `catalogue` (the draft by default) that the database
 * doesn't have yet, matched by id. It never changes or removes a row that's
 * already there, so the owner's edits and hidden rows survive restarts, and a
 * model added to the draft later reaches existing databases too. Any other
 * correction to the draft (a renamed id, a changed fuel list or price group, a
 * removed model) reaches an existing local database only after
 * `npm run db:reset`; a renamed id would otherwise sit next to the old row.
 *
 * Checks the catalogue first and throws on any problem, so a typo in
 * vehicle-seed-data.ts fails loudly. One transaction, one insert per table:
 * every start of a local or build database runs this, and a slow start could
 * push a cached read past the dev server's 10-second probe.
 */
export async function seedVehicleCatalogue(db: Database, catalogue: VehicleCatalogue = draftCatalogue): Promise<void> {
  const problems = checkCatalogue(catalogue);
  if (problems.length > 0) {
    throw new Error(`The seed vehicle catalogue is invalid: ${JSON.stringify(problems)}`);
  }

  const rows = vehicleCatalogueRows(catalogue);
  await db.transaction(async (tx) => {
    // Drizzle refuses an insert with no rows, so an empty list is skipped.
    if (rows.categories.length > 0) await tx.insert(vehicleCategories).values(rows.categories).onConflictDoNothing();
    if (rows.makes.length > 0) await tx.insert(vehicleMakes).values(rows.makes).onConflictDoNothing();
    if (rows.models.length > 0) await tx.insert(vehicleModels).values(rows.models).onConflictDoNothing();
  });
}
