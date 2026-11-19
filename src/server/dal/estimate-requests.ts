// Requests for a free estimate (task 32): the customer's save and list, and
// the staff list that task 26's inbox page will show.
//
// The rules of this folder are in garage.ts; a customer's own rows follow
// customer-vehicles.ts (authorizeUser() first, every query filtered by the
// user it returns, no user id from the caller). Staff reads call
// authorize("estimates.manage") first.
//
// createMyEstimateRequest keeps the booking save's order (bookings.ts):
// 1. authorizeUser(), then the input check, then the reads that open their
//    own queries (the saved vehicle, the cached catalogue). What they find
//    is kept, not answered yet: a cached read or a session read inside the
//    transaction would wait forever on PGlite.
// 2. One transaction, which first takes a lock on the customer, so two
//    sends from them run one after the other. Then: the request token (a
//    double tap, or a retry after a lost answer, answers "duplicate"); only
//    after it, the refusals whose answer can change between tries (a saved
//    vehicle removed, a model the garage hid, the photo set), so a retry
//    never refuses a request that was already sent
//    (document/solutions/conventions/idempotent-save-answer-duplicate-before-refusals-that-can-change.md);
//    then the daily limit; last, the insert. Nothing here catches.

import "server-only";

import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";

import {
  checkEstimateRequestInput,
  ESTIMATE_REQUEST_RULES,
  type EstimateRequestInput,
  type EstimateRequestInputProblem,
} from "@/domain/estimate-requests";
import { can } from "@/domain/permissions";
import { type Fuel, resolveVehicle, type VehicleKind } from "@/domain/vehicles";
import type { LocalizedText } from "@/i18n/localized-text";
import { type Clock, systemClock } from "@/lib/clock";
import { authorize, authorizeUser } from "@/server/auth/access";
import { type Database, getDatabase } from "@/server/db";
import { estimateRequests, photoSets, photos, users, vehicleMakes, vehicleModels } from "@/server/db/schema";

import { readMyVehicleForBooking } from "./customer-vehicles";
import { readVehicleCatalogue } from "./vehicles";

const DAY_MS = 24 * 60 * 60 * 1000;

/** What can be wrong with a request: the input's problems, or what only the database knows. */
export type EstimateRequestSaveProblem =
  | EstimateRequestInputProblem
  | { field: "vehicle"; problem: "vehicle-unknown-model" | "vehicle-fuel-not-offered" };

export type CreateEstimateRequestResult =
  | { status: "sent"; id: string }
  /** The same form sent again (a double tap, a retry): the first request stands. */
  | { status: "duplicate"; id: string }
  | { status: "problems"; problems: EstimateRequestSaveProblem[] }
  /** The saved vehicle isn't this customer's (or no longer exists). */
  | { status: "not-found" }
  | { status: "too-many-requests"; limit: number };

/** The vehicle as the request keeps it: a copy. */
type RequestVehicle = {
  vehicleId: string | null;
  kind: VehicleKind;
  modelId: string;
  fuel: Fuel;
  registrationNumber: string | null;
};

/**
 * Sends a request for the logged-in customer. Expected answers come back as
 * a result; only an unexpected database error throws (and rolls back).
 */
export async function createMyEstimateRequest(
  input: EstimateRequestInput,
  clock: Clock = systemClock,
): Promise<CreateEstimateRequestResult> {
  const user = await authorizeUser();
  const checked = checkEstimateRequestInput(input);
  if (!checked.ok) return { status: "problems", problems: checked.problems };
  const { request } = checked;

  // Before the transaction: these open their own queries. A refusal found
  // here is kept and answered only after the duplicate check.
  let vehicle: RequestVehicle | null = null;
  let refusal: CreateEstimateRequestResult | null = null;
  if (request.vehicle.saved) {
    const saved = await readMyVehicleForBooking(request.vehicle.vehicleId);
    if (saved) {
      vehicle = { vehicleId: saved.id, kind: saved.kind, modelId: saved.modelId, fuel: saved.fuel, registrationNumber: saved.registrationNumber };
    } else refusal = { status: "not-found" };
  } else {
    const resolved = resolveVehicle(await readVehicleCatalogue(), request.vehicle.modelId, request.vehicle.fuel);
    if (resolved.ok) {
      vehicle = {
        vehicleId: null,
        kind: resolved.vehicle.kind,
        modelId: resolved.vehicle.model.id,
        fuel: resolved.vehicle.fuel,
        registrationNumber: null,
      };
    } else {
      const problem = resolved.problem === "unknown-model" ? "vehicle-unknown-model" : "vehicle-fuel-not-offered";
      refusal = { status: "problems", problems: [{ field: "vehicle", problem }] };
    }
  }

  const db = await getDatabase();
  return db.transaction(async (tx): Promise<CreateEstimateRequestResult> => {
    // Waits for this customer's other sends; released when the transaction ends.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`estimate-request-user:${user.id}`}))`);

    // The same form again: the first request stands, whatever changed since.
    const [earlier] = await tx
      .select({ id: estimateRequests.id })
      .from(estimateRequests)
      .where(and(eq(estimateRequests.userId, user.id), eq(estimateRequests.requestToken, request.requestToken)));
    if (earlier) return { status: "duplicate", id: earlier.id };

    if (refusal) return refusal;
    if (!vehicle) throw new Error("No vehicle and no refusal");

    // The photo set: the customer's own, still open, and not part of another request.
    if (request.photoSetId !== null) {
      const [set] = await tx
        .select({ id: photoSets.id, usedBy: estimateRequests.id })
        .from(photoSets)
        .leftJoin(estimateRequests, eq(estimateRequests.photoSetId, photoSets.id))
        .where(and(eq(photoSets.id, request.photoSetId), eq(photoSets.userId, user.id), isNull(photoSets.closedAt)));
      if (!set || set.usedBy !== null) {
        return { status: "problems", problems: [{ field: "photos", problem: "photos-not-found" }] };
      }
    }

    const now = clock.now();
    const recent = await tx.$count(
      estimateRequests,
      and(eq(estimateRequests.userId, user.id), gt(estimateRequests.createdAt, new Date(now.getTime() - DAY_MS))),
    );
    if (recent >= ESTIMATE_REQUEST_RULES.maxPerDay) {
      return { status: "too-many-requests", limit: ESTIMATE_REQUEST_RULES.maxPerDay };
    }

    const [row] = await tx
      .insert(estimateRequests)
      .values({
        userId: user.id,
        vehicleId: vehicle.vehicleId,
        vehicleKind: vehicle.kind,
        modelId: vehicle.modelId,
        fuel: vehicle.fuel,
        registrationNumber: vehicle.registrationNumber,
        description: request.description,
        photoSetId: request.photoSetId,
        requestToken: request.requestToken,
        createdAt: now,
      })
      .returning({ id: estimateRequests.id });
    return { status: "sent", id: row!.id };
  });
}

/** A request as the customer's list and the staff list show it. */
export type EstimateRequestRow = {
  id: string;
  createdAt: Date;
  kind: VehicleKind;
  makeName: LocalizedText;
  modelName: LocalizedText;
  fuel: Fuel;
  /** The compact form, or null when the vehicle came from the picker: show it with formatRegistration. */
  registrationNumber: string | null;
  description: string;
  /** Null when no photos were sent, or once the photo cleanup deleted them. */
  photoSetId: string | null;
  /** Photos that arrived (pending ones don't count). */
  photoCount: number;
};

/** A request as staff see it: who sent it, too. */
export type StaffEstimateRequestRow = EstimateRequestRow & {
  customerName: string;
  /** Only for staff with "customers.contact"; null for anyone else. */
  phoneNumber: string | null;
};

/** The request's columns, with the model and brand names through a join that ignores `listed`. */
const requestColumns = {
  id: estimateRequests.id,
  createdAt: estimateRequests.createdAt,
  kind: estimateRequests.vehicleKind,
  makeName: vehicleMakes.name,
  modelName: vehicleModels.name,
  fuel: estimateRequests.fuel,
  registrationNumber: estimateRequests.registrationNumber,
  description: estimateRequests.description,
  photoSetId: estimateRequests.photoSetId,
};

/** How many stored photos each set holds. */
async function storedPhotoCounts(db: Database, setIds: string[]): Promise<Map<string, number>> {
  if (setIds.length === 0) return new Map();
  const rows = await db
    .select({ setId: photos.setId, value: sql<number>`count(*)::int` })
    .from(photos)
    .where(and(inArray(photos.setId, setIds), eq(photos.status, "stored")))
    .groupBy(photos.setId);
  return new Map(rows.map((row) => [row.setId, row.value]));
}

function withPhotoCounts<Row extends { photoSetId: string | null }>(rows: Row[], counts: Map<string, number>) {
  return rows.map((row) => ({ ...row, photoCount: row.photoSetId ? (counts.get(row.photoSetId) ?? 0) : 0 }));
}

/** The logged-in customer's requests, newest first. */
export async function listMyEstimateRequests(): Promise<EstimateRequestRow[]> {
  const user = await authorizeUser();
  const db = await getDatabase();
  const rows = await db
    .select(requestColumns)
    .from(estimateRequests)
    .innerJoin(vehicleModels, eq(estimateRequests.modelId, vehicleModels.id))
    .innerJoin(vehicleMakes, eq(vehicleModels.makeId, vehicleMakes.id))
    .where(eq(estimateRequests.userId, user.id))
    .orderBy(desc(estimateRequests.createdAt), desc(estimateRequests.id));
  const counts = await storedPhotoCounts(db, rows.flatMap((row) => (row.photoSetId ? [row.photoSetId] : [])));
  return withPhotoCounts(rows, counts);
}

/**
 * Every customer's requests, newest first, for staff with
 * "estimates.manage" (manager, owner): task 26's inbox page. The phone
 * number comes only with "customers.contact". The photos open through
 * photoViewUrls(photoSetId), which checks "photos.view" itself.
 */
export async function listEstimateRequests({ limit = 50 }: { limit?: number } = {}): Promise<StaffEstimateRequestRow[]> {
  const user = await authorize("estimates.manage");
  const showPhone = can(user.role, "customers.contact");
  const db = await getDatabase();
  const rows = await db
    .select({ ...requestColumns, customerName: users.name, phoneNumber: users.phoneNumber })
    .from(estimateRequests)
    .innerJoin(users, eq(estimateRequests.userId, users.id))
    .innerJoin(vehicleModels, eq(estimateRequests.modelId, vehicleModels.id))
    .innerJoin(vehicleMakes, eq(vehicleModels.makeId, vehicleMakes.id))
    .orderBy(desc(estimateRequests.createdAt), desc(estimateRequests.id))
    .limit(limit);
  const counts = await storedPhotoCounts(db, rows.flatMap((row) => (row.photoSetId ? [row.photoSetId] : [])));
  return withPhotoCounts(rows, counts).map((row) => ({ ...row, phoneNumber: showPhone ? row.phoneNumber : null }));
}
