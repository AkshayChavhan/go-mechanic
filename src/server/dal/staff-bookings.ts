// The bookings board's read (task 26): one India day's bookings, for staff.
//
// The rules of this folder are in garage.ts. Staff reads call
// authorize(permission) on their first line, before the input check and
// before getDatabase(). Like listEstimateRequests, the customer's phone
// number (and here the pickup address) comes only with "customers.contact".
// Live, never cached: a new booking must show at once. The customer's save
// stays alone in bookings.ts, whose fixed order CLAUDE.md guards.

import "server-only";

import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";

import type { BookingLine, BookingStatus } from "@/domain/bookings";
import { addDays, indiaInstantOn, parseIndiaDate } from "@/domain/india-time";
import { can } from "@/domain/permissions";
import type { Fuel, VehicleKind } from "@/domain/vehicles";
import type { LocalizedText } from "@/i18n/localized-text";
import { authorize } from "@/server/auth/access";
import { getDatabase } from "@/server/db";
import { bookingItems, bookings, users, vehicleMakes, vehicleModels } from "@/server/db/schema";

/** A booking as the staff board shows it: the booking's own copies, with names from the catalogue. */
export type StaffBookingRow = {
  id: string;
  /** As stored, without the dash: show it with formatBookingCode. */
  code: string;
  startsAt: Date;
  status: BookingStatus;
  vehicle: {
    kind: VehicleKind;
    makeName: LocalizedText;
    modelName: LocalizedText;
    fuel: Fuel;
    /** The compact form ("MH12AB0042"): show it with formatRegistration. */
    registrationNumber: string;
  };
  /** In the order the customer chose them. */
  lines: BookingLine[];
  /** The sum of the priced lines, in paise; null when no line has a price. */
  totalPaise: number | null;
  pickup: {
    included: boolean;
    /** Only for staff with "customers.contact"; null for anyone else, and without pickup. */
    address: string | null;
    postalCode: string | null;
    /** Null without pickup; 0 when free. */
    feePaise: number | null;
  };
  customerName: string;
  /** Only for staff with "customers.contact"; null for anyone else. */
  phoneNumber: string | null;
};

export type ListBookingsOnResult = { ok: true; bookings: StaffBookingRow[] } | { ok: false; problem: "invalid-date" };

/**
 * The bookings whose slot falls on `date` (an India date, "YYYY-MM-DD"),
 * earliest first, for staff with "bookings.manage" (manager, owner).
 */
export async function listBookingsOn(date: string): Promise<ListBookingsOnResult> {
  const user = await authorize("bookings.manage");
  const day = parseIndiaDate(date);
  if (day === null) return { ok: false, problem: "invalid-date" };
  const showContact = can(user.role, "customers.contact");

  const db = await getDatabase();
  // India midnight to the next India midnight (18:30 UTC to 18:30 UTC).
  // The model and brand joins ignore `listed`: a hidden model keeps its name here.
  const rows = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      startsAt: bookings.startsAt,
      status: bookings.status,
      kind: bookings.vehicleKind,
      makeName: vehicleMakes.name,
      modelName: vehicleModels.name,
      fuel: bookings.fuel,
      registrationNumber: bookings.registrationNumber,
      totalPaise: bookings.totalPaise,
      pickupAddress: bookings.pickupAddress,
      pickupPostalCode: bookings.pickupPostalCode,
      pickupFeePaise: bookings.pickupFeePaise,
      customerName: users.name,
      phoneNumber: users.phoneNumber,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .innerJoin(vehicleModels, eq(bookings.modelId, vehicleModels.id))
    .innerJoin(vehicleMakes, eq(vehicleModels.makeId, vehicleMakes.id))
    .where(and(gte(bookings.startsAt, indiaInstantOn(day, 0)), lt(bookings.startsAt, indiaInstantOn(addDays(day, 1), 0))))
    .orderBy(asc(bookings.startsAt), asc(bookings.id));
  if (rows.length === 0) return { ok: true, bookings: [] };

  const lineRows = await db
    .select({
      bookingId: bookingItems.bookingId,
      serviceId: bookingItems.serviceId,
      kind: bookingItems.serviceKind,
      name: bookingItems.name,
      priceStatus: bookingItems.priceStatus,
      pricePaise: bookingItems.pricePaise,
      position: bookingItems.position,
    })
    .from(bookingItems)
    .where(
      inArray(
        bookingItems.bookingId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(bookingItems.position));
  const linesByBooking = new Map<string, BookingLine[]>();
  for (const { bookingId, ...line } of lineRows) {
    const lines = linesByBooking.get(bookingId) ?? [];
    lines.push(line);
    linesByBooking.set(bookingId, lines);
  }

  return {
    ok: true,
    bookings: rows.map((row) => ({
      id: row.id,
      code: row.code,
      startsAt: row.startsAt,
      status: row.status,
      vehicle: {
        kind: row.kind,
        makeName: row.makeName,
        modelName: row.modelName,
        fuel: row.fuel,
        registrationNumber: row.registrationNumber,
      },
      lines: linesByBooking.get(row.id) ?? [],
      totalPaise: row.totalPaise,
      // All three or none (a CHECK on the table).
      pickup: {
        included: row.pickupAddress !== null,
        address: showContact ? row.pickupAddress : null,
        postalCode: showContact ? row.pickupPostalCode : null,
        feePaise: row.pickupFeePaise,
      },
      customerName: row.customerName,
      phoneNumber: showContact ? row.phoneNumber : null,
    })),
  };
}
