// What the booking page's Server Actions (src/server/actions/booking.ts)
// answer, and what the wizard (task 47) keeps and sends back. It lives here
// because a "use server" file may only export async functions, and the
// browser needs the starting states and the field names too.
//
// Everything here crosses from the server to the browser, so it holds plain
// values only: times as ISO strings, never Date objects.

import type { BookingInput, BookingLine } from "@/domain/bookings";
import type { SlotDay } from "@/domain/slots";
import type { Fuel, VehicleKind } from "@/domain/vehicles";
import { initialLoginState, type LoginState } from "@/lib/login-state";
import type { MyVehicle } from "@/server/dal/customer-vehicles";

// --- The login step ------------------------------------------------------------

/**
 * The booking page's login step: the same phone and code steps as /login
 * (LoginState), plus "verified" once the code was right. The page stays
 * where it is then: the next request (Confirm) carries the new login.
 */
export type BookingLoginState = LoginState | { step: "verified"; phoneDisplay?: string };

export const initialBookingLoginState: BookingLoginState = initialLoginState;

// --- The wizard's steps --------------------------------------------------------

/** The wizard's steps, in order. A refused confirm names the one to go back to. */
export const BOOKING_STEPS = ["vehicle", "services", "slot", "login", "confirm"] as const;
export type BookingStep = (typeof BOOKING_STEPS)[number];

// --- The slot list, as it crosses to the browser -------------------------------

export type SerializedSlot = { startsAt: string; endsAt: string; remaining: number };

/** A SlotDay with ISO strings in place of Dates. */
export type SerializedSlotDay = Omit<SlotDay, "status" | "slots"> &
  ({ status: "open"; slots: SerializedSlot[] } | { status: "closed-weekday" | "closed-date" });

/** The live slot list with its times as ISO strings, for a client component's props or state. */
export function serializeSlotDays(days: readonly SlotDay[]): SerializedSlotDay[] {
  return days.map((day) =>
    day.status === "open"
      ? {
          date: day.date,
          weekday: day.weekday,
          status: "open",
          slots: day.slots.map((slot) => ({
            startsAt: slot.startsAt.toISOString(),
            endsAt: slot.endsAt.toISOString(),
            remaining: slot.remaining,
          })),
        }
      : { date: day.date, weekday: day.weekday, status: day.status },
  );
}

// --- The confirm step ----------------------------------------------------------

/**
 * The names the confirm form posts its fields under. The vehicle is either
 * a saved one (savedVehicleId) or a typed one: the picker (name="vehicle")
 * posts vehicleModel and vehicleFuel, plus the registration. Each chosen
 * service posts one "service" field. "name" is there only when the customer
 * still has to give it.
 */
export const CONFIRM_FIELD_NAMES = {
  savedVehicleId: "savedVehicleId",
  modelId: "vehicleModel",
  fuel: "vehicleFuel",
  registration: "registration",
  service: "service",
  startsAt: "startsAt",
  requestToken: "requestToken",
  name: "name",
} as const;

export type ConfirmFormValues = BookingInput & { name: string };

/**
 * The confirm form's values from what it posted, each as text ("" when
 * missing). Only these fields are read: a posted userId, price or
 * vehicleKind does nothing. A non-empty savedVehicleId picks a saved
 * vehicle; otherwise the typed one counts.
 */
export function readConfirmForm(formData: FormData): ConfirmFormValues {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const savedVehicleId = text(CONFIRM_FIELD_NAMES.savedVehicleId).trim();
  return {
    vehicle:
      savedVehicleId !== ""
        ? { savedVehicleId }
        : {
            modelId: text(CONFIRM_FIELD_NAMES.modelId),
            fuel: text(CONFIRM_FIELD_NAMES.fuel),
            registration: text(CONFIRM_FIELD_NAMES.registration),
          },
    serviceIds: formData.getAll(CONFIRM_FIELD_NAMES.service).filter((value) => typeof value === "string"),
    startsAt: text(CONFIRM_FIELD_NAMES.startsAt),
    requestToken: text(CONFIRM_FIELD_NAMES.requestToken),
    name: text(CONFIRM_FIELD_NAMES.name),
  };
}

/** The parts of the wizard an error can belong to: "form" is the confirm step as a whole. */
export type ConfirmField = "vehicle" | "registration" | "services" | "slot" | "name" | "form";
export type ConfirmErrors = Partial<Record<ConfirmField, string>>;

/** A saved booking, as the done screen shows it. */
export type BookingSummary = {
  /** Shown as people read it: "K7Q-4MX". */
  code: string;
  startsAt: string;
  vehicle: {
    kind: VehicleKind;
    modelId: string;
    fuel: Fuel;
    categoryId: string;
    /** The compact form: show it with formatRegistration. */
    registrationNumber: string;
  };
  lines: BookingLine[];
  /** The priced lines added up, in paise; null when no line has a price. */
  totalPaise: number | null;
  isEstimate: boolean;
};

/** What the last confirm answered. Every refusal names the step to go back to. */
export type ConfirmAnswer =
  | { kind: "idle" }
  | { kind: "booked"; booking: BookingSummary }
  /**
   * This customer already booked this (the same confirm again, or the same
   * vehicle in the same slot): no new booking was made. Shown as its own
   * message with the first booking's code, not as a fresh booking.
   */
  | { kind: "duplicate"; code: string; message: string }
  /** Nobody is logged in (any more): back to the phone step. */
  | { kind: "needs-login"; step: "login"; errors: ConfirmErrors }
  /** The customer has no name yet, or the one posted can't be saved. */
  | { kind: "needs-name"; step: "confirm"; errors: ConfirmErrors }
  /** What was posted has problems; `step` is the first step with one. */
  | { kind: "problems"; step: BookingStep; errors: ConfirmErrors; slots?: SerializedSlotDay[] }
  /** The picked saved vehicle isn't this customer's any more. */
  | { kind: "vehicle-not-found"; step: "vehicle"; errors: ConfirmErrors }
  /** The typed number is already saved with another model or fuel: the saved one to offer. */
  | { kind: "registration-duplicate"; step: "vehicle"; errors: ConfirmErrors; savedVehicleId: string }
  | { kind: "too-many-bookings"; step: "confirm"; errors: ConfirmErrors; limit: number }
  /** The slot filled up or can't be booked now: a fresh slot list to pick from. */
  | {
      kind: "slot-problem";
      step: "slot";
      problem: "full" | "not-a-slot" | "closed-date" | "outside-window";
      errors: ConfirmErrors;
      slots: SerializedSlotDay[];
    };

/** The logged-in customer, as the latest server answer saw them (plan KTD10). */
export type BookingAccount = {
  vehicles: MyVehicle[];
  needsName: boolean;
};

export type ConfirmState = {
  /** Goes up by one with every answer. */
  submission: number;
  answer: ConfirmAnswer;
  /**
   * Set on every answer made while logged in, except "booked": the
   * customer's saved vehicles and whether a name is missing. Never trust
   * the page's first props for these after an inline login.
   */
  account?: BookingAccount;
  /** The name typed on the confirm step, kept when it comes back with an error. */
  nameTyped: string;
};

export const initialConfirmState: ConfirmState = { submission: 0, answer: { kind: "idle" }, nameTyped: "" };
