// The logged-in customer's bookings (task 23): the save.
//
// The rules of this folder are in garage.ts; a customer's own rows follow
// customer-vehicles.ts (authorizeUser() first, every query filtered by the
// user it returns, no user id from the caller).
//
// createMyBooking does everything in this order (plan KTD3):
// 1. authorizeUser(), then the input check, then the reads that may be
//    cached (catalogue, services, real prices) and the saved vehicle. The
//    lines are priced here, before any transaction opens: a cached read or
//    a session read inside the transaction would wait forever on PGlite.
// 2. One transaction, which first takes a lock on the customer, so two
//    confirms from them run one after the other. Then, reads only: the
//    request token (a double tap answers "duplicate"), the typed plate, the
//    future-bookings limit. Then reserveSlot. Last, the writes.
// Every answer that refuses comes before reserveSlot, so after it the only
// answer is "booked". A write that fails after it throws, and the whole
// transaction rolls back, the slot's place included. Nothing here catches.

import "server-only";

import { randomInt } from "node:crypto";

import { and, eq, gt, sql } from "drizzle-orm";

import {
  type BookingInput,
  type BookingInputProblem,
  type BookingLine,
  type BookingLineProblem,
  buildBookingLines,
  checkBookingInput,
  makeBookingCode,
  MAX_FUTURE_BOOKINGS,
} from "@/domain/bookings";
import { isUuid } from "@/domain/ids";
import type { SlotRequestProblem } from "@/domain/slots";
import { type Fuel, resolveVehicle, type VehicleKind } from "@/domain/vehicles";
import { type Clock, systemClock } from "@/lib/clock";
import { authorizeUser } from "@/server/auth/access";
import { getDatabase } from "@/server/db";
import { bookingEvents, bookingItems, bookings } from "@/server/db/schema";

import {
  findVehicleByRegistration,
  insertVehicleRow,
  type MyVehicle,
  readMyVehicleForBooking,
} from "./customer-vehicles";
import { readServicePrices, readServices } from "./services";
import { reserveSlot } from "./slots";
import { readVehicleCatalogue } from "./vehicles";

/** What can be wrong with a booking before any slot is touched. */
export type BookingSaveProblem =
  | BookingInputProblem
  | { field: "vehicle"; problem: "vehicle-unknown-model" }
  | { field: "services"; problem: BookingLineProblem["problem"]; serviceId: string };

/** The vehicle as the booking keeps it: a copy, so later changes never reach it. */
export type BookedVehicle = {
  kind: VehicleKind;
  modelId: string;
  fuel: Fuel;
  /** The price group the lines were priced for. */
  categoryId: string;
  /** The compact form: show it with formatRegistration. */
  registrationNumber: string;
};

/** A saved booking, as the confirmation shows it. */
export type BookedBooking = {
  /** Stored without the dash: show it with formatBookingCode. */
  code: string;
  startsAt: Date;
  vehicle: BookedVehicle;
  lines: BookingLine[];
  /** The priced lines added up, in paise; null when no line has a price. */
  totalPaise: number | null;
  isEstimate: boolean;
};

export type CreateBookingResult =
  | { status: "booked"; booking: BookedBooking }
  /** The same request token again (a double tap, a retry): the first booking's code. */
  | { status: "duplicate"; code: string }
  | { status: "problems"; problems: BookingSaveProblem[] }
  /** The saved vehicle isn't this customer's (or doesn't exist). */
  | { status: "not-found" }
  /** The typed number is already saved, with another model or fuel. */
  | { status: "registration-duplicate"; savedVehicle: MyVehicle }
  | { status: "too-many-bookings"; limit: number }
  | { status: "slot-problem"; problem: SlotRequestProblem | "full" };

/** The typed vehicle, resolved against the listed catalogue. */
type TypedVehicle = BookedVehicle & { saved: false };
/** A vehicle the customer saved before. */
type SavedVehicle = BookedVehicle & { saved: true; id: string };

/**
 * Books a slot for the logged-in customer. Expected answers come back as a
 * result; only an unexpected database error throws (and rolls back).
 */
export async function createMyBooking(input: BookingInput, clock: Clock = systemClock): Promise<CreateBookingResult> {
  const user = await authorizeUser();
  const checked = checkBookingInput(input);
  if (!checked.ok) return { status: "problems", problems: checked.problems };
  const { booking } = checked;
  if (booking.vehicle.saved && !isUuid(booking.vehicle.vehicleId)) return { status: "not-found" };

  // Before the transaction: these open their own queries.
  const services = await readServices();
  const prices = await readServicePrices();
  let vehicle: TypedVehicle | SavedVehicle;
  if (booking.vehicle.saved) {
    const saved = await readMyVehicleForBooking(booking.vehicle.vehicleId);
    if (!saved) return { status: "not-found" };
    vehicle = { saved: true, ...saved };
  } else {
    const resolved = resolveVehicle(await readVehicleCatalogue(), booking.vehicle.modelId, booking.vehicle.fuel);
    if (!resolved.ok) {
      const problem = resolved.problem === "unknown-model" ? "vehicle-unknown-model" : "vehicle-fuel-not-offered";
      return { status: "problems", problems: [{ field: "vehicle", problem }] };
    }
    vehicle = {
      saved: false,
      kind: resolved.vehicle.kind,
      modelId: resolved.vehicle.model.id,
      fuel: resolved.vehicle.fuel,
      categoryId: resolved.vehicle.model.categoryId,
      registrationNumber: booking.vehicle.registrationNumber,
    };
  }

  // Only real prices: the samples `npm run dev` shows never reach a booking.
  const priced = buildBookingLines(services, prices, vehicle, booking.serviceIds);
  if (!priced.ok) {
    return {
      status: "problems",
      problems: priced.problems.map(({ problem, id }) => ({ field: "services", problem, serviceId: id })),
    };
  }

  const db = await getDatabase();
  return db.transaction(async (tx): Promise<CreateBookingResult> => {
    // Waits for this customer's other confirms; released when the transaction ends.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`booking-user:${user.id}`}))`);

    // The same confirm again: the first booking's code, whatever happened since.
    const [earlier] = await tx
      .select({ code: bookings.code })
      .from(bookings)
      .where(and(eq(bookings.userId, user.id), eq(bookings.requestToken, booking.requestToken)));
    if (earlier) return { status: "duplicate", code: earlier.code };

    // A typed number the customer already saved: the same vehicle, or a clash.
    let vehicleId: string | null = vehicle.saved ? vehicle.id : null;
    if (!vehicle.saved) {
      const existing = await findVehicleByRegistration(tx, user.id, vehicle.registrationNumber);
      if (existing && (existing.modelId !== vehicle.modelId || existing.fuel !== vehicle.fuel)) {
        return { status: "registration-duplicate", savedVehicle: existing };
      }
      vehicleId = existing?.id ?? null;
    }

    const now = clock.now();
    const future = await tx.$count(
      bookings,
      and(eq(bookings.userId, user.id), eq(bookings.status, "booked"), gt(bookings.startsAt, now)),
    );
    if (future >= MAX_FUTURE_BOOKINGS) return { status: "too-many-bookings", limit: MAX_FUTURE_BOOKINGS };

    const reserved = await reserveSlot(tx, booking.startsAt, clock);
    if (!reserved.ok) return { status: "slot-problem", problem: reserved.problem };

    // From here on, only "booked" or a thrown error (which rolls back the place too).
    if (vehicleId === null) {
      vehicleId = await insertVehicleRow(
        tx,
        user.id,
        {
          modelId: vehicle.modelId,
          fuel: vehicle.fuel,
          registrationNumber: vehicle.registrationNumber,
          pucExpiresOn: null,
          insuranceExpiresOn: null,
        },
        now,
      );
      // Saved meanwhile outside this lock (the account page, another tab).
      if (!vehicleId) throw new Error("The vehicle was saved by another request during the booking");
    }

    const copy: BookedVehicle = {
      kind: vehicle.kind,
      modelId: vehicle.modelId,
      fuel: vehicle.fuel,
      categoryId: vehicle.categoryId,
      registrationNumber: vehicle.registrationNumber,
    };
    // A clash with an existing code throws: the customer's retry draws a new one.
    const code = makeBookingCode((size) => randomInt(size));
    const [row] = await tx
      .insert(bookings)
      .values({
        code,
        userId: user.id,
        vehicleId,
        vehicleKind: copy.kind,
        modelId: copy.modelId,
        fuel: copy.fuel,
        categoryId: copy.categoryId,
        registrationNumber: copy.registrationNumber,
        startsAt: booking.startsAt,
        status: "booked",
        isEstimate: priced.isEstimate,
        totalPaise: priced.totalPaise,
        requestToken: booking.requestToken,
        createdAt: now,
      })
      .returning({ id: bookings.id });
    await tx.insert(bookingItems).values(
      priced.lines.map((line) => ({
        bookingId: row.id,
        serviceId: line.serviceId,
        serviceKind: line.kind,
        name: line.name,
        priceStatus: line.priceStatus,
        pricePaise: line.pricePaise,
        position: line.position,
      })),
    );
    await tx.insert(bookingEvents).values({ bookingId: row.id, kind: "booked", actorUserId: user.id, createdAt: now });

    return {
      status: "booked",
      booking: {
        code,
        startsAt: booking.startsAt,
        vehicle: copy,
        lines: priced.lines,
        totalPaise: priced.totalPaise,
        isEstimate: priced.isEstimate,
      },
    };
  });
}
