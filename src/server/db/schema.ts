// The database's tables, written in TypeScript with Drizzle.
//
// To change a table: edit this file, run `npm run db:generate`, and commit
// the new .sql file in src/server/db/migrations/ (with meta/) in the same
// commit. Restart `npm run dev` to apply it to your local database. Never
// edit a migration that is already merged: write a new one.
//
// Names in the database are snake_case (address_text); the TypeScript names
// are camelCase (addressText). Each column names its database name itself, so
// what you read here is what the SQL says.
//
// Rules for this file:
// - Import app code with `import type` only. drizzle-kit loads this file
//   outside Next.js, where the "@/" alias may not work at runtime; type
//   imports disappear before the file runs.
// - No `import "server-only"`: drizzle-kit and the tests read this file
//   outside Next.js. It holds no secrets and runs no queries.
// - Times are `timestamp with time zone`, stored in UTC (the database session
//   runs in UTC too: src/server/db/index.ts).

import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgEnum, pgTable, text, time, timestamp } from "drizzle-orm/pg-core";

import type { Weekday } from "@/domain/opening-hours";
import type { LocalizedText } from "@/i18n/localized-text";

/**
 * The days of the week, Monday first. The same list as WEEKDAYS in
 * src/domain/opening-hours.ts (database.test.ts checks they match); it's
 * written out here because this file may only import types.
 */
export const weekday = pgEnum("weekday", [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const satisfies readonly Weekday[]);

/**
 * The garage's contact details: exactly one row, with id 1. The CHECK makes
 * a second row impossible, so code never has to ask "which garage?".
 */
export const garageSettings = pgTable(
  "garage_settings",
  {
    id: integer("id").primaryKey().default(1),
    /** E.164 ("+919764750567"). Any Indian number; checkGarage checks it before a save. */
    phone: text("phone").notNull(),
    /** E.164, and a mobile (WhatsApp needs one). */
    whatsapp: text("whatsapp").notNull(),
    /** Street, area, city and state, per language: { en, hi? }. */
    addressText: jsonb("address_text").$type<LocalizedText>().notNull(),
    /** The 6-digit PIN code, kept as text: "412101". */
    postalCode: text("postal_code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("garage_settings_single_row", sql`${table.id} = 1`)],
);

/**
 * One row per weekday. A closed day has no times; an open day has both, and
 * opens before it closes (India time, the garage's clock). Times come back
 * from the database as "10:00:00".
 */
export const openingHours = pgTable(
  "opening_hours",
  {
    weekday: weekday("weekday").primaryKey(),
    opens: time("opens"),
    closes: time("closes"),
  },
  (table) => [
    // Spelled out on purpose. A CHECK passes when its result is NULL, so
    // "opens < closes" alone would let a row with only one time through.
    check(
      "opening_hours_closed_or_opens_before_closes",
      sql`(${table.opens} is null and ${table.closes} is null) or (${table.opens} is not null and ${table.closes} is not null and ${table.opens} < ${table.closes})`,
    ),
  ],
);
