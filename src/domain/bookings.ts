// A customer's booking: what it may contain, what each line costs, and its
// short code.
//
// Pure logic: no Next.js, React or database imports. The data-access save
// (src/server/dal/bookings.ts) checks what the form posts with
// checkBookingInput(), reads the services and real prices, prices the lines
// with buildBookingLines(), and stores them. Money is integer paise.

import type { LocalizedText } from "@/i18n/localized-text";

import { isUuid } from "./ids";
import { parseRegistration, type RegistrationProblem } from "./registration";
import { priceFor, type PricedVehicle, type Service, type ServiceKind, type ServicePrice } from "./services";
import { type Fuel, isFuel } from "./vehicles";

/** A booking's status. Tasks 25–27 add more (cancelled, confirmed...). */
export const BOOKING_STATUSES = ["booked"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** What a booking's history entry records. */
export const BOOKING_EVENT_KINDS = ["booked"] as const;
export type BookingEventKind = (typeof BOOKING_EVENT_KINDS)[number];

/** How a line is priced: an amount, after inspection, or no price set yet. */
export const LINE_PRICE_STATUSES = ["price", "on-inspection", "no-price"] as const;
export type LinePriceStatus = (typeof LINE_PRICE_STATUSES)[number];

/**
 * How many bookings for slots that haven't started yet one customer may hold.
 * A placeholder: the owner may change it.
 */
export const MAX_FUTURE_BOOKINGS = 3;

/** The most services one booking may hold. */
export const MAX_SERVICES = 10;

// --- What the form posts -----------------------------------------------------

/** The vehicle: one the customer saved before, or one typed in the form. */
export type BookingVehicleInput = { savedVehicleId: string } | { modelId: string; fuel: string; registration: string };

/** What the confirm step posts, as strings. */
export type BookingInput = {
  vehicle: BookingVehicleInput;
  /** One package, or one or more services. */
  serviceIds: readonly string[];
  /** The slot's start, as an ISO string ("2027-03-12T04:30:00.000Z"). */
  startsAt: string;
  /** A random uuid per run of the page, so a second confirm makes no second booking. */
  requestToken: string;
};

/** What's wrong, tagged with the part of the form it belongs to. */
export type BookingInputProblem =
  | { field: "vehicle"; problem: "vehicle-missing" | "vehicle-fuel-not-offered" }
  | { field: "registration"; problem: RegistrationProblem }
  | { field: "services"; problem: "nothing-chosen" | "too-many" }
  | { field: "slot"; problem: "slot-invalid" }
  | { field: "token"; problem: "bad-token" };

/**
 * The vehicle after the check. A typed one isn't checked against the
 * catalogue here: the save does that once it has read it (resolveVehicle).
 * A saved id is looked up by the save, with the customer's own id.
 */
export type CheckedBookingVehicle =
  | { saved: true; vehicleId: string }
  | { saved: false; modelId: string; fuel: Fuel; registrationNumber: string };

export type CheckedBooking = {
  vehicle: CheckedBookingVehicle;
  /** Each id once, in the order chosen. */
  serviceIds: string[];
  startsAt: Date;
  requestToken: string;
};

function checkVehicle(
  vehicle: BookingVehicleInput,
  problems: BookingInputProblem[],
): CheckedBookingVehicle | null {
  if ("savedVehicleId" in vehicle) {
    const id = vehicle.savedVehicleId.trim();
    if (id === "") {
      problems.push({ field: "vehicle", problem: "vehicle-missing" });
      return null;
    }
    return { saved: true, vehicleId: id };
  }

  let fuel: Fuel | null = null;
  if (vehicle.modelId.trim() === "" || vehicle.fuel.trim() === "") {
    problems.push({ field: "vehicle", problem: "vehicle-missing" });
  } else if (!isFuel(vehicle.fuel)) {
    problems.push({ field: "vehicle", problem: "vehicle-fuel-not-offered" });
  } else {
    fuel = vehicle.fuel;
  }
  const registration = parseRegistration(vehicle.registration);
  if (!registration.ok) problems.push({ field: "registration", problem: registration.problem });

  if (!fuel || !registration.ok) return null;
  return { saved: false, modelId: vehicle.modelId.trim(), fuel, registrationNumber: registration.compact };
}

/**
 * Checks what the confirm step posts: the clean booking, or every problem at
 * once. Whether the slot is really a free slot, and whether the services are
 * offered for the vehicle, need the database: the save checks those next.
 */
export function checkBookingInput(
  input: BookingInput,
): { ok: true; booking: CheckedBooking } | { ok: false; problems: BookingInputProblem[] } {
  const problems: BookingInputProblem[] = [];

  const vehicle = checkVehicle(input.vehicle, problems);

  const serviceIds = [...new Set(input.serviceIds)];
  if (serviceIds.length === 0) problems.push({ field: "services", problem: "nothing-chosen" });
  else if (serviceIds.length > MAX_SERVICES) problems.push({ field: "services", problem: "too-many" });

  const startsAt = new Date(input.startsAt);
  if (input.startsAt.trim() === "" || Number.isNaN(startsAt.getTime())) {
    problems.push({ field: "slot", problem: "slot-invalid" });
  }

  if (!isUuid(input.requestToken)) problems.push({ field: "token", problem: "bad-token" });

  if (problems.length > 0 || !vehicle) return { ok: false, problems };
  return { ok: true, booking: { vehicle, serviceIds, startsAt, requestToken: input.requestToken.toLowerCase() } };
}

// --- The lines and their prices ---------------------------------------------

/** One line of a booking, as it's saved: a copy of the name and the price at booking time. */
export type BookingLine = {
  serviceId: string;
  kind: ServiceKind;
  name: LocalizedText;
  priceStatus: LinePriceStatus;
  /** Only for "price"; null otherwise. */
  pricePaise: number | null;
  /** 0, 1, 2...: the order the customer chose them in. */
  position: number;
};

export type BookingLineProblem = {
  problem: "unknown-service" | "package-with-services" | "not-offered";
  /** The service it's about. */
  id: string;
};

/**
 * Prices each chosen service for `vehicle` with priceFor(). `services` are
 * the listed ones, so a hidden service is "unknown-service". A package must
 * be the only choice. The total adds up the priced lines only (null when
 * none has a price), and any line without a price makes it an estimate.
 */
export function buildBookingLines(
  services: readonly Service[],
  prices: readonly ServicePrice[],
  vehicle: PricedVehicle,
  chosenIds: readonly string[],
):
  | { ok: true; lines: BookingLine[]; totalPaise: number | null; isEstimate: boolean }
  | { ok: false; problems: BookingLineProblem[] } {
  const byId = new Map(services.map((service) => [service.id, service]));
  const ids = [...new Set(chosenIds)];
  const problems: BookingLineProblem[] = [];
  const lines: BookingLine[] = [];

  for (const id of ids) {
    const service = byId.get(id);
    if (!service) {
      problems.push({ problem: "unknown-service", id });
      continue;
    }
    if (service.kind === "package" && ids.length > 1) {
      problems.push({ problem: "package-with-services", id });
      continue;
    }
    const price = priceFor(service, prices, vehicle);
    if (price.status === "not-offered") {
      problems.push({ problem: "not-offered", id });
      continue;
    }
    lines.push({
      serviceId: service.id,
      kind: service.kind,
      name: service.name,
      priceStatus: price.status,
      pricePaise: price.status === "price" ? price.paise : null,
      position: lines.length,
    });
  }

  if (problems.length > 0) return { ok: false, problems };
  const priced = lines.filter((line) => line.pricePaise !== null);
  const totalPaise = priced.length === 0 ? null : priced.reduce((sum, line) => sum + (line.pricePaise ?? 0), 0);
  return { ok: true, lines, totalPaise, isEstimate: priced.length < lines.length };
}

// --- The booking code ---------------------------------------------------------

/** Letters and digits that can't be mistaken for each other: no I, L, O, 0 or 1. */
export const BOOKING_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const CODE_LENGTH = 6;

/**
 * A new booking code: six characters from the alphabet, "K7Q4MX" (31^6, about
 * 887 million codes). `randomIndex(size)` returns a whole number from 0 to
 * size - 1: the save passes crypto's randomInt, tests pass a fixed one.
 */
export function makeBookingCode(randomIndex: (size: number) => number): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    const index = randomIndex(BOOKING_CODE_ALPHABET.length);
    // A broken random source must never store a code like "AundefinedB".
    if (!Number.isInteger(index) || index < 0 || index >= BOOKING_CODE_ALPHABET.length) {
      throw new RangeError("randomIndex returned a number outside the alphabet");
    }
    code += BOOKING_CODE_ALPHABET[index];
  }
  return code;
}

/** A stored code, grouped for reading aloud: "K7Q4MX" is "K7Q-4MX". */
export function formatBookingCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}
