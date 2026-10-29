// The garage's details, read from and saved to the database.
//
// Three rules for this folder (src/server/dal/, the "data-access layer"):
// 1. It is the only code that queries the database. Pages and components
//    call these functions; they never import @/server/db themselves.
// 2. Public reads need no check: anyone can see the garage's phone and
//    hours. readGarage() is cached, so the pages that show them stay
//    prebuilt (`○ /en` in the build's route list).
// 3. Every other function checks who is asking on its first line, before it
//    checks its input, calls getDatabase() or opens a transaction
//    (src/server/auth/access.ts). The check reads the session itself, so no
//    caller can hand it a made-up user, and a forgotten check in a page
//    can't open the data:
//    - staff work calls authorize(permission): saveGarage needs
//      "garage.edit" (owner or manager);
//    - a customer's own data calls authorizeUser() and filters the query by
//      the returned user's id, never a user id from its caller.
//    Three kinds of function don't check, by design:
//    - public reads, cached or live (readGarage, readAvailableSlots);
//    - writes made during a login, before a session exists (login-codes.ts,
//      consents.ts, users.ts): only the login service calls them, and
//      nothing in them comes from a browser;
//    - functions that take the caller's transaction (reserveSlot,
//      releaseSlot, moveSlot): the function that opens the transaction
//      checks before it opens it. A session read is a query, and inside an
//      open transaction it would wait forever on PGlite.
//    Tasks 28 and 40 call saveGarage from a Server Action that calls
//    requireUser(locale) first.

import "server-only";

import { eq } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";

import { checkGarage, type Garage, type GarageProblem } from "@/domain/garage";
import { type DayHours, WEEKDAYS, type WeeklyHours } from "@/domain/opening-hours";
import { type Clock, systemClock } from "@/lib/clock";
import { authorize } from "@/server/auth/access";
import { getDatabase } from "@/server/db";
import { garageSettings, openingHours } from "@/server/db/schema";
import { garageSettingsRow, openingHoursRows } from "@/server/db/seed";

/** The cache tag on every cached read of the garage. A save refreshes it. */
export const GARAGE_TAG = "garage";

/** One opening_hours row, as the database returns it. */
type HoursRow = typeof openingHours.$inferSelect;

/**
 * One day's hours from its row. The database writes a time with seconds
 * ("10:00:00"); the app uses "10:00". A day with no row, or without both
 * times, is closed: a wrong "Closed" beats a page that crashes, and every
 * save writes all seven days anyway.
 */
function dayHours(row: HoursRow | undefined): DayHours {
  if (!row?.opens || !row.closes) return "closed";
  return { opens: row.opens.slice(0, 5), closes: row.closes.slice(0, 5) };
}

/**
 * The week's hours from the opening_hours rows, a missing or half-filled day
 * counting as closed. The slot engine (slots.ts) reads hours through this
 * too, so the open badge and the slots never disagree about a bad row.
 */
export function weeklyHours(rows: HoursRow[]): WeeklyHours {
  const byWeekday = new Map(rows.map((row) => [row.weekday, row]));
  return Object.fromEntries(WEEKDAYS.map((weekday) => [weekday, dayHours(byWeekday.get(weekday))])) as WeeklyHours;
}

/**
 * The garage's phone, WhatsApp, address and hours.
 *
 * Cached ('use cache') with the "max" lifetime: Next.js keeps the answer for
 * up to 30 days before it checks again, which is right for details that
 * change only when the owner saves them. A save refreshes it at once
 * (updateTag in saveGarage). Throws when the database has no garage, so a
 * build against an empty database fails loudly instead of showing nothing.
 */
export async function readGarage(): Promise<Garage> {
  "use cache";
  cacheTag(GARAGE_TAG);
  cacheLife("max");

  const db = await getDatabase();
  const [settingsRows, hoursRows] = await Promise.all([
    db.select().from(garageSettings).where(eq(garageSettings.id, 1)),
    db.select().from(openingHours),
  ]);
  const settings = settingsRows[0];
  if (!settings) {
    throw new Error(
      "The garage's details are missing: the garage_settings table has no row. " +
        "Locally, stop `npm run dev`, run `npm run db:reset` and start it again.",
    );
  }

  return {
    phone: settings.phone,
    whatsapp: settings.whatsapp,
    address: {
      text: settings.addressText,
      postalCode: settings.postalCode,
      // One garage, in India: the column would always say the same.
      countryCode: "IN",
    },
    hours: weeklyHours(hoursRows),
  };
}

export type SaveGarageResult = { ok: true } | { ok: false; problems: GarageProblem[] };

/**
 * Saves the garage's details, or says what's wrong with them.
 *
 * 0. authorize("garage.edit"): only the owner or a manager. Anyone else gets
 *    AccessDeniedError, before anything is read, checked or written.
 * 1. checkGarage: on any problem, nothing is written and the problems come
 *    back as codes (a form turns them into messages).
 * 2. One transaction: the garage row (updated_at from `clock`) and all seven
 *    hours rows. Either everything is saved or nothing is.
 * 3. updateTag("garage"): the next page load reads the new details.
 *
 * Database errors aren't caught: they reach the caller as they are.
 * updateTag only works inside a Server Action, which is where tasks 28 and
 * 40 call this from (see rule 3 at the top of this file).
 */
export async function saveGarage(garage: Garage, clock: Clock = systemClock): Promise<SaveGarageResult> {
  await authorize("garage.edit");
  const problems = checkGarage(garage);
  if (problems.length > 0) return { ok: false, problems };

  const db = await getDatabase();
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(garageSettings)
      .set({ ...garageSettingsRow(garage), updatedAt: clock.now() })
      .where(eq(garageSettings.id, 1))
      .returning({ id: garageSettings.id });
    // A save never creates the garage: the seed (or task 20) does. Throwing
    // here rolls the transaction back, so the hours stay as they were.
    if (updated.length === 0) throw new Error("Can't save the garage: the garage_settings table has no row.");

    await tx.delete(openingHours);
    await tx.insert(openingHours).values(openingHoursRows(garage.hours));
  });

  updateTag(GARAGE_TAG);
  return { ok: true };
}
