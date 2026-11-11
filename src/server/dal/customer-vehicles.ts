// The logged-in customer's own vehicles (task 21).
//
// The rules of this folder are in garage.ts. Rule 3 here, the one that
// keeps one customer out of another's vehicles:
// - no function takes a user id: each calls authorizeUser() on its first
//   line, before it checks its input, reads the catalogue or calls
//   getDatabase(), and uses the user it returns;
// - every query filters by that user's id, plus the vehicle's id where
//   there is one. A change that touches no row means "not found", so
//   another customer's vehicle and one that doesn't exist get the same
//   answer.
//
// Saves check the input first (checkVehicleInput, against the listed
// catalogue and India's today), then write once. Nothing here is cached:
// these reads are per user and happen at request time.

import "server-only";

import { and, asc, eq, ne } from "drizzle-orm";

import { checkVehicleInput, type VehicleInput, type VehicleInputProblem } from "@/domain/customer-vehicles";
import { type IndiaDate, indiaDateOf } from "@/domain/india-time";
import type { Fuel, VehicleKind } from "@/domain/vehicles";
import type { LocalizedText } from "@/i18n/localized-text";
import { type Clock, systemClock } from "@/lib/clock";
import { authorizeUser } from "@/server/auth/access";
import { getDatabase } from "@/server/db";
import { customerVehicles, vehicleMakes, vehicleModels } from "@/server/db/schema";

import { readVehicleCatalogue } from "./vehicles";

/** A saved vehicle, with its brand and model names from the catalogue. */
export type MyVehicle = {
  id: string;
  kind: VehicleKind;
  modelId: string;
  makeName: LocalizedText;
  modelName: LocalizedText;
  fuel: Fuel;
  /** The compact form ("MH12AB1234"): show it with formatRegistration. */
  registrationNumber: string;
  pucExpiresOn: IndiaDate | null;
  insuranceExpiresOn: IndiaDate | null;
};

/** What can be wrong with a vehicle to save: the input's problems, or a number the customer already saved. */
export type VehicleSaveProblem = VehicleInputProblem | { field: "registration"; problem: "registration-duplicate" };

const duplicate: VehicleSaveProblem = { field: "registration", problem: "registration-duplicate" };

/**
 * Whether `id` is a uuid. Postgres refuses to compare a uuid column with
 * anything else (error 22P02), so a made-up id ("1; drop", "abc") would
 * crash the query instead of being "not found".
 */
function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** The columns of a MyVehicle. The names come through a join that ignores `listed`, so a model the garage hid still shows. */
const myVehicleColumns = {
  id: customerVehicles.id,
  kind: vehicleModels.kind,
  modelId: customerVehicles.modelId,
  makeName: vehicleMakes.name,
  modelName: vehicleModels.name,
  fuel: customerVehicles.fuel,
  registrationNumber: customerVehicles.registrationNumber,
  pucExpiresOn: customerVehicles.pucExpiresOn,
  insuranceExpiresOn: customerVehicles.insuranceExpiresOn,
};

/** The logged-in customer's vehicles, oldest first. */
export async function listMyVehicles(): Promise<MyVehicle[]> {
  const user = await authorizeUser();
  const db = await getDatabase();
  return db
    .select(myVehicleColumns)
    .from(customerVehicles)
    .innerJoin(vehicleModels, eq(customerVehicles.modelId, vehicleModels.id))
    .innerJoin(vehicleMakes, eq(vehicleModels.makeId, vehicleMakes.id))
    .where(eq(customerVehicles.userId, user.id))
    .orderBy(asc(customerVehicles.createdAt), asc(customerVehicles.id));
}

/** One of the logged-in customer's vehicles, or null: another customer's id and an unknown one look the same. */
export async function readMyVehicle(id: string): Promise<MyVehicle | null> {
  const user = await authorizeUser();
  if (!isUuid(id)) return null;
  const db = await getDatabase();
  const [row] = await db
    .select(myVehicleColumns)
    .from(customerVehicles)
    .innerJoin(vehicleModels, eq(customerVehicles.modelId, vehicleModels.id))
    .innerJoin(vehicleMakes, eq(vehicleModels.makeId, vehicleMakes.id))
    .where(and(eq(customerVehicles.id, id), eq(customerVehicles.userId, user.id)));
  return row ?? null;
}

/**
 * Adds a vehicle for the logged-in customer. A number they already saved
 * comes back as "registration-duplicate": the insert skips the clash
 * ("on conflict do nothing") instead of failing, so two tabs saving the
 * same number at once give one row and one answer.
 */
export async function addMyVehicle(
  input: VehicleInput,
  clock: Clock = systemClock,
): Promise<{ status: "saved"; id: string } | { status: "problems"; problems: VehicleSaveProblem[] }> {
  const user = await authorizeUser();
  const checked = checkVehicleInput(input, await readVehicleCatalogue(), indiaDateOf(clock.now()));
  if (!checked.ok) return { status: "problems", problems: checked.problems };

  const db = await getDatabase();
  const now = clock.now();
  const [row] = await db
    .insert(customerVehicles)
    .values({ userId: user.id, ...checked.vehicle, createdAt: now, updatedAt: now })
    .onConflictDoNothing({ target: [customerVehicles.userId, customerVehicles.registrationNumber] })
    .returning({ id: customerVehicles.id });
  if (!row) return { status: "problems", problems: [duplicate] };
  return { status: "saved", id: row.id };
}

/**
 * Changes one of the logged-in customer's vehicles. The model must still be
 * listed, even if it's the one already saved: a hidden model is refused
 * until the customer picks again. (No page calls this yet: a follow-up task
 * adds the edit page.)
 */
export async function updateMyVehicle(
  id: string,
  input: VehicleInput,
  clock: Clock = systemClock,
): Promise<{ status: "saved" } | { status: "problems"; problems: VehicleSaveProblem[] } | { status: "not-found" }> {
  const user = await authorizeUser();
  if (!isUuid(id)) return { status: "not-found" };
  const checked = checkVehicleInput(input, await readVehicleCatalogue(), indiaDateOf(clock.now()));
  if (!checked.ok) return { status: "problems", problems: checked.problems };

  const db = await getDatabase();
  // Another of this customer's vehicles with the new number? The unique
  // constraint is the backstop: a race between two of their own tabs would
  // fail there instead.
  const [clash] = await db
    .select({ id: customerVehicles.id })
    .from(customerVehicles)
    .where(
      and(
        eq(customerVehicles.userId, user.id),
        eq(customerVehicles.registrationNumber, checked.vehicle.registrationNumber),
        ne(customerVehicles.id, id),
      ),
    )
    .limit(1);
  if (clash) return { status: "problems", problems: [duplicate] };

  const updated = await db
    .update(customerVehicles)
    .set({ ...checked.vehicle, updatedAt: clock.now() })
    .where(and(eq(customerVehicles.id, id), eq(customerVehicles.userId, user.id)))
    .returning({ id: customerVehicles.id });
  return updated.length === 0 ? { status: "not-found" } : { status: "saved" };
}

/**
 * Deletes one of the logged-in customer's vehicles. (No page calls this yet:
 * a follow-up task adds it, with a confirmation step.)
 */
export async function removeMyVehicle(id: string): Promise<{ status: "removed" } | { status: "not-found" }> {
  const user = await authorizeUser();
  if (!isUuid(id)) return { status: "not-found" };
  const db = await getDatabase();
  const removed = await db
    .delete(customerVehicles)
    .where(and(eq(customerVehicles.id, id), eq(customerVehicles.userId, user.id)))
    .returning({ id: customerVehicles.id });
  return removed.length === 0 ? { status: "not-found" } : { status: "removed" };
}
