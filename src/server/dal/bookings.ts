// The logged-in customer's bookings (task 23): the save.
//
// The rules of this folder are in garage.ts; a customer's own rows follow
// customer-vehicles.ts (authorizeUser() first, every query filtered by the
// user it returns, no user id from the caller).
//
// createMyBooking does everything in this order (plan KTD3):
// 1. authorizeUser(), then the input check, then the reads that may be
//    cached (catalogue, services, real prices, pickup areas) and the saved
//    vehicle. The lines are priced and the pickup fee found here, before any
//    transaction opens: a cached read or a session read inside the
//    transaction would wait forever on PGlite.
// 2. One transaction, which first takes a lock on the customer, so two
//    confirms from them run one after the other. Then, reads only: the
//    request token (a double tap answers "duplicate"), the typed plate, the
//    same vehicle already booked in the same slot (a reload, also
//    "duplicate"), a pickup PIN code the garage doesn't serve (found before
//    the transaction, answered only here, so a retry after the area was
//    paused still gets "duplicate"), the future-bookings limit. Then
//    reserveSlot. Last, the writes. The same-slot check and the limit look
//    only at active bookings (booked or confirmed, ACTIVE_STATUSES, task
//    27): a cancelled or no-show booking neither blocks nor counts.
// Every answer that refuses comes before reserveSlot, so after it the only
// answer is "booked". A write that fails after it throws, and the whole
// transaction rolls back, the slot's place included. Nothing here catches.

import "server-only";

import { randomInt } from "node:crypto";

import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";

import {
  ACTIVE_STATUSES,
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
import { findPickupArea } from "@/domain/pickup";
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
import { readPickupAreas } from "./pickup";
import { readServicePrices, readServices } from "./services";
import { reserveSlot, type SlotTransaction } from "./slots";
import { readVehicleCatalogue } from "./vehicles";

/** What can be wrong with a booking before any slot is touched. */
export type BookingSaveProblem =
  | BookingInputProblem
  | { field: "vehicle"; problem: "vehicle-unknown-model" }
  | { field: "services"; problem: BookingLineProblem["problem"]; serviceId: string }
  /** The garage doesn't pick up from that PIN code (or has paused it). */
  | { field: "pickup"; problem: "pickup-not-offered" };

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

/** Pickup and drop as the booking keeps it: a copy, so a later fee change never reaches it. */
export type BookedPickup = {
  /** As typed, spaces collapsed. */
  address: string;
  postalCode: string;
  /** In paise, for pickup and drop together; 0 when free. Not part of totalPaise. */
  feePaise: number;
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
  /** Null when the customer brings the vehicle in. */
  pickup: BookedPickup | null;
};

export type CreateBookingResult =
  | { status: "booked"; booking: BookedBooking }
  /**
   * The same request token again (a double tap, a retry), or the same vehicle
   * in the same slot: no new booking. `booking` is the earlier one, as it was
   * saved, so a retry with another slot is shown the time really booked.
   */
  | { status: "duplicate"; booking: BookedBooking }
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

  // Real areas only (never the samples /contact shows under npm run dev).
  // Read here, refused inside the transaction after the duplicate checks.
  let pickup: BookedPickup | null = null;
  let pickupNotOffered = false;
  if (booking.pickup) {
    const area = findPickupArea(await readPickupAreas(), booking.pickup.postalCode);
    if (area) pickup = { ...booking.pickup, feePaise: area.feePaise };
    else pickupNotOffered = true;
  }

  const db = await getDatabase();
  return db.transaction(async (tx): Promise<CreateBookingResult> => {
    // Waits for this customer's other confirms; released when the transaction ends.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`booking-user:${user.id}`}))`);

    // The same confirm again: the first booking, whatever was posted this time.
    const [earlier] = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.userId, user.id), eq(bookings.requestToken, booking.requestToken)));
    if (earlier) return { status: "duplicate", booking: await readBookedBooking(tx, user.id, earlier.id) };

    // A typed number the customer already saved: the same vehicle, or a clash.
    let vehicleId: string | null = vehicle.saved ? vehicle.id : null;
    if (!vehicle.saved) {
      const existing = await findVehicleByRegistration(tx, user.id, vehicle.registrationNumber);
      if (existing && (existing.modelId !== vehicle.modelId || existing.fuel !== vehicle.fuel)) {
        return { status: "registration-duplicate", savedVehicle: existing };
      }
      vehicleId = existing?.id ?? null;
    }

    // The same vehicle in the same slot again, under a new token (a reload
    // makes a new one): the first booking stands, so its code comes back.
    // Only while it's active: after a cancel or a no-show, booking again is
    // a new booking.
    const [sameSlot] = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.userId, user.id),
          inArray(bookings.status, [...ACTIVE_STATUSES]),
          eq(bookings.registrationNumber, vehicle.registrationNumber),
          eq(bookings.startsAt, booking.startsAt),
        ),
      );
    if (sameSlot) return { status: "duplicate", booking: await readBookedBooking(tx, user.id, sameSlot.id) };

    if (pickupNotOffered) return { status: "problems", problems: [{ field: "pickup", problem: "pickup-not-offered" }] };

    const now = clock.now();
    const future = await tx.$count(
      bookings,
      and(eq(bookings.userId, user.id), inArray(bookings.status, [...ACTIVE_STATUSES]), gt(bookings.startsAt, now)),
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
        pickupAddress: pickup?.address ?? null,
        pickupPostalCode: pickup?.postalCode ?? null,
        pickupFeePaise: pickup?.feePaise ?? null,
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
        pickup,
      },
    };
  });
}

/** One of this customer's bookings, as the confirmation shows it. Read inside the save's transaction. */
async function readBookedBooking(tx: SlotTransaction, userId: string, bookingId: string): Promise<BookedBooking> {
  const [row] = await tx
    .select({
      code: bookings.code,
      startsAt: bookings.startsAt,
      kind: bookings.vehicleKind,
      modelId: bookings.modelId,
      fuel: bookings.fuel,
      categoryId: bookings.categoryId,
      registrationNumber: bookings.registrationNumber,
      totalPaise: bookings.totalPaise,
      isEstimate: bookings.isEstimate,
      pickupAddress: bookings.pickupAddress,
      pickupPostalCode: bookings.pickupPostalCode,
      pickupFeePaise: bookings.pickupFeePaise,
    })
    .from(bookings)
    .where(and(eq(bookings.userId, userId), eq(bookings.id, bookingId)));
  if (!row) throw new Error("The earlier booking was not found");
  const lines = await tx
    .select({
      serviceId: bookingItems.serviceId,
      kind: bookingItems.serviceKind,
      name: bookingItems.name,
      priceStatus: bookingItems.priceStatus,
      pricePaise: bookingItems.pricePaise,
      position: bookingItems.position,
    })
    .from(bookingItems)
    .where(eq(bookingItems.bookingId, bookingId))
    .orderBy(asc(bookingItems.position));
  const { code, startsAt, totalPaise, isEstimate, pickupAddress, pickupPostalCode, pickupFeePaise, ...vehicle } = row;
  // All three or none (a CHECK on the table): the earlier booking's own copy.
  const pickup =
    pickupAddress !== null && pickupPostalCode !== null && pickupFeePaise !== null
      ? { address: pickupAddress, postalCode: pickupPostalCode, feePaise: pickupFeePaise }
      : null;
  return { code, startsAt, vehicle, lines, totalPaise, isEstimate, pickup };
}
