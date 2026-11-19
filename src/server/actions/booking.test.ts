import { headers } from "next/headers";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { BookingLine } from "@/domain/bookings";
import type { SlotDay } from "@/domain/slots";
import { type ConfirmState, initialBookingLoginState, initialConfirmState } from "@/lib/booking-form";
import { initialLoginState, type LoginState } from "@/lib/login-state";
import type { Auth } from "@/server/auth/auth";
import { BookingServiceError, LoginServiceError } from "@/server/auth/errors";
import { getAuth } from "@/server/auth/instance";
import { requestLoginCode, verifyLoginCode } from "@/server/auth/login";
import { getCurrentUser } from "@/server/auth/session";
import { type BookedBooking, createMyBooking } from "@/server/dal/bookings";
import { listMyVehicles, type MyVehicle } from "@/server/dal/customer-vehicles";
import { readMyProfile, saveMyName } from "@/server/dal/profile";
import { readAvailableSlots } from "@/server/dal/slots";

import allMessages from "../../../messages/en.json";

import { bookingLoginStep, confirmBooking, notMe } from "./booking";

// The actions only check, call the login service or the data-access layer,
// and translate. Those (tested on their own) are replaced here, so each test
// sets the answer it needs. authorizeUser is the real one, reading a mocked
// session.

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/server/auth/instance", () => ({ getAuth: vi.fn() }));
vi.mock("@/server/auth/login", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/auth/login")>()),
  requestLoginCode: vi.fn(),
  verifyLoginCode: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/dal/profile", () => ({ readMyProfile: vi.fn(), saveMyName: vi.fn() }));
vi.mock("@/server/dal/customer-vehicles", () => ({ listMyVehicles: vi.fn() }));
vi.mock("@/server/dal/bookings", () => ({ createMyBooking: vi.fn() }));
vi.mock("@/server/dal/slots", () => ({ readAvailableSlots: vi.fn() }));
vi.mock("@/server/env", () => ({
  serverEnv: () => ({
    appEnv: "staging",
    databaseUrl: "postgres://x",
    authSecret: "s".repeat(32),
    smsProvider: "fake",
    e2eOutboxFile: undefined,
  }),
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async ({
      locale,
      namespace,
    }: {
      locale: "en";
      namespace: "Login" | "Booking" | "Account" | "MyVehicles";
    }) => createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const t = allMessages.Booking;
const signOut = vi.fn();
const attemptId = "6f1c2a52-8a4c-4a35-9a43-0d8f0f5b3c11";
const requestToken = "0b6c9a8e-4f1d-4c2b-9a77-3e5d1f2a4b6c";
const resendAt = new Date("2026-10-28T06:30:30Z");
const asha = { id: "asha", phoneNumber: "+919876500001", role: "customer" as const };

const hondaCity: MyVehicle = {
  id: "6f1c1f0e-8a7c-4c1e-9d55-0b7a2a8c1e11",
  kind: "car",
  modelId: "car-honda-city",
  makeName: { en: "Honda" },
  modelName: { en: "City" },
  fuel: "petrol",
  registrationNumber: "MH12AB1234",
  pucExpiresOn: null,
  insuranceExpiresOn: null,
};

/** The live slot list, as readAvailableSlots returns it. */
const freshSlots: SlotDay[] = [
  {
    date: "2026-10-29",
    weekday: "thursday",
    status: "open",
    slots: [{ startsAt: new Date("2026-10-29T04:30:00Z"), endsAt: new Date("2026-10-29T05:30:00Z"), remaining: 1 }],
  },
  { date: "2026-10-30", weekday: "friday", status: "closed-date" },
];

const line: BookingLine = {
  serviceId: "car-general-service",
  kind: "service",
  name: { en: "General service" },
  priceStatus: "no-price",
  pricePaise: null,
  position: 0,
};

/** A saved booking, as createMyBooking returns it. */
const savedBooking: BookedBooking = {
  code: "K7Q4MX",
  startsAt: new Date("2026-10-29T04:30:00Z"),
  vehicle: { kind: "car", modelId: "car-honda-city", fuel: "petrol", categoryId: "sedan", registrationNumber: "MH12AB1234" },
  lines: [line],
  totalPaise: null,
  isEstimate: true,
  pickup: null,
};

/** The same booking, as the done screen gets it: the code with its dash, the time as an ISO string. */
const savedSummary = {
  ...savedBooking,
  code: "K7Q-4MX",
  startsAt: "2026-10-29T04:30:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  // 28 Oct 2026, 12:00 India time: "today" for the rateLimited messages.
  // Only Date is faked.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T06:30:00Z"));
  vi.mocked(headers).mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.7" }));
  vi.mocked(getAuth).mockResolvedValue({ api: { signOut } } as unknown as Auth);
  vi.mocked(getCurrentUser).mockResolvedValue(asha);
  vi.mocked(readMyProfile).mockResolvedValue({ name: "Asha Patil", phoneNumber: asha.phoneNumber });
  vi.mocked(listMyVehicles).mockResolvedValue([hondaCity]);
  vi.mocked(readAvailableSlots).mockResolvedValue(freshSlots);
});

afterEach(() => {
  vi.useRealTimers();
});

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const each of Array.isArray(value) ? value : [value]) data.append(name, each);
  }
  return data;
}

// --- The login step ------------------------------------------------------------

const phoneStep = form({ intent: "send", phone: "98765 43210", age: "on", consent: "on" });
const codeStep: LoginState = {
  step: "code",
  phoneTyped: "98765 43210",
  ageConfirmed: true,
  contactConsent: true,
  attemptId,
  phoneDisplay: "+91 98765 43210",
  resendAt: resendAt.toISOString(),
};

describe("bookingLoginStep: the phone step, as on /login", () => {
  test("a valid number with both boxes sends a code and opens the code step", async () => {
    vi.mocked(requestLoginCode).mockResolvedValue({
      ok: true,
      sent: true,
      attemptId,
      phoneNumber: "+919876543210",
      resendAt,
    });
    expect(await bookingLoginStep("en", initialBookingLoginState, phoneStep)).toEqual({
      ...codeStep,
      status: "We sent a 6-digit code to +91 98765 43210.",
    });
    expect(requestLoginCode).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ locale: "en", intent: "start", ageConfirmed: true, contactConsent: true }),
      expect.anything(),
    );
  });

  test("a missing box keeps what was typed and shows its error", async () => {
    vi.mocked(requestLoginCode).mockResolvedValue({ ok: false, problem: "consentMissing" });
    expect(await bookingLoginStep("en", initialBookingLoginState, form({ intent: "send", phone: "98765 43210", age: "on" }))).toEqual({
      step: "phone",
      phoneTyped: "98765 43210",
      ageConfirmed: true,
      contactConsent: false,
      error: { field: "consent", text: allMessages.Login.errors.consentMissing },
    });
  });

  test("rate limits answer with /login's text", async () => {
    vi.mocked(requestLoginCode).mockResolvedValue({
      ok: false,
      problem: "rateLimited",
      retryAt: new Date("2026-10-28T07:30:00Z"),
      attemptId,
      phoneNumber: "+919876543210",
    });
    const state = await bookingLoginStep("en", initialBookingLoginState, phoneStep);
    expect(state).toMatchObject({
      step: "phone",
      error: { field: "form", text: "Too many codes for this number. Try again after 1:00 pm, or call us." },
    });
  });
});

describe("bookingLoginStep: the code step", () => {
  test("the right code answers verified, with the number, and never redirects", async () => {
    vi.mocked(verifyLoginCode).mockResolvedValue({ ok: true, needsName: false });
    expect(await bookingLoginStep("en", codeStep, form({ intent: "verify", attemptId, code: "123 456" }))).toEqual({
      step: "verified",
      phoneDisplay: "+91 98765 43210",
      needsName: false,
    });
    expect(verifyLoginCode).toHaveBeenCalledWith(
      expect.anything(),
      { locale: "en", attemptId, codeTyped: "123 456" },
      expect.any(Headers),
    );
  });

  test("verified says when a new customer still needs a name", async () => {
    vi.mocked(verifyLoginCode).mockResolvedValue({ ok: true, needsName: true });
    expect(await bookingLoginStep("en", codeStep, form({ intent: "verify", attemptId, code: "123456" }))).toEqual({
      step: "verified",
      phoneDisplay: "+91 98765 43210",
      needsName: true,
    });
  });

  test("a wrong code keeps the phone and counts down tries", async () => {
    vi.mocked(verifyLoginCode).mockResolvedValue({ ok: false, problem: "wrongCode" });
    expect(await bookingLoginStep("en", codeStep, form({ intent: "verify", attemptId, code: "000000" }))).toEqual({
      ...codeStep,
      error: { field: "code", text: allMessages.Login.errors.wrongCode },
    });
  });

  test("an unknown locale throws before anything else runs", async () => {
    await expect(bookingLoginStep("xx", initialBookingLoginState, phoneStep)).rejects.toThrow("Unknown locale");
    expect(getAuth).not.toHaveBeenCalled();
    expect(requestLoginCode).not.toHaveBeenCalled();
  });
});

// --- Confirm -------------------------------------------------------------------

/** A full confirm post for a typed vehicle, as the wizard sends it. */
const typedPost = {
  vehicleKind: "car",
  vehicleMake: "car-honda",
  vehicleModel: "car-honda-city",
  vehicleFuel: "petrol",
  registration: "mh 12 ab 1234",
  service: ["car-general-service", "car-wheel-alignment"],
  startsAt: "2026-10-29T04:30:00.000Z",
  requestToken,
};

const typedInput = {
  vehicle: { modelId: "car-honda-city", fuel: "petrol", registration: "mh 12 ab 1234" },
  serviceIds: ["car-general-service", "car-wheel-alignment"],
  startsAt: "2026-10-29T04:30:00.000Z",
  requestToken,
};

const ashaAccount = { vehicles: [hondaCity], needsName: false };

describe("confirmBooking: who is asking", () => {
  test("an unknown locale is refused before anything else runs", async () => {
    await expect(confirmBooking("xx", initialConfirmState, form(typedPost))).rejects.toThrow("Unknown locale");
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(createMyBooking).not.toHaveBeenCalled();
  });

  test("logged out: needs-login, back to the phone step, without a redirect or a save", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await confirmBooking("en", initialConfirmState, form(typedPost))).toEqual({
      submission: 1,
      nameTyped: "",
      answer: { kind: "needs-login", step: "login", errors: { form: t.errors.needsLogin } },
    });
    expect(readMyProfile).not.toHaveBeenCalled();
    expect(createMyBooking).not.toHaveBeenCalled();
  });

  test("only AccessDeniedError means 'log in': any other error is thrown on", async () => {
    const failure = new LoginServiceError("getCurrentUser", "DrizzleQueryError 57P01");
    vi.mocked(getCurrentUser).mockRejectedValue(failure);
    await expect(confirmBooking("en", initialConfirmState, form(typedPost))).rejects.toBe(failure);
  });
});

describe("confirmBooking: the name", () => {
  beforeEach(() => {
    vi.mocked(readMyProfile).mockResolvedValue({ name: "", phoneNumber: asha.phoneNumber });
  });

  test("no name and none posted: needs-name, with the saved vehicles, and no booking", async () => {
    expect(await confirmBooking("en", initialConfirmState, form(typedPost))).toEqual({
      submission: 1,
      nameTyped: "",
      answer: { kind: "needs-name", step: "confirm", errors: { name: t.errors.needsName } },
      account: { vehicles: [hondaCity], needsName: true },
    });
    expect(createMyBooking).not.toHaveBeenCalled();
  });

  test("a posted name is saved first, then the booking", async () => {
    vi.mocked(saveMyName).mockResolvedValue({ ok: true });
    vi.mocked(createMyBooking).mockResolvedValue({ status: "duplicate", booking: savedBooking });
    const state = await confirmBooking("en", initialConfirmState, form({ ...typedPost, name: "Asha Patil" }));
    expect(saveMyName).toHaveBeenCalledWith("Asha Patil");
    expect(vi.mocked(saveMyName).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(createMyBooking).mock.invocationCallOrder[0],
    );
    expect(state.account?.needsName).toBe(false);
  });

  test("a posted name with a problem comes back as a name error, kept, with no booking", async () => {
    vi.mocked(saveMyName).mockResolvedValue({ ok: false, problem: "name-too-short" });
    expect(await confirmBooking("en", initialConfirmState, form({ ...typedPost, name: "A" }))).toEqual({
      submission: 1,
      nameTyped: "A",
      answer: { kind: "needs-name", step: "confirm", errors: { name: allMessages.Account.nameErrors["name-too-short"] } },
      account: { vehicles: [hondaCity], needsName: true },
    });
    expect(createMyBooking).not.toHaveBeenCalled();
  });

  test("a customer who has a name: a posted name is not saved", async () => {
    vi.mocked(readMyProfile).mockResolvedValue({ name: "Asha Patil", phoneNumber: asha.phoneNumber });
    vi.mocked(createMyBooking).mockResolvedValue({ status: "duplicate", booking: savedBooking });
    await confirmBooking("en", initialConfirmState, form({ ...typedPost, name: "Someone Else" }));
    expect(saveMyName).not.toHaveBeenCalled();
  });
});

describe("confirmBooking: what it sends to the save", () => {
  beforeEach(() => {
    vi.mocked(createMyBooking).mockResolvedValue({ status: "duplicate", booking: savedBooking });
  });

  test("only the named fields: a posted userId, price or vehicleKind does nothing", async () => {
    await confirmBooking(
      "en",
      initialConfirmState,
      form({ ...typedPost, userId: "ravi", price: "100", totalPaise: "100", vehicleKind: "two-wheeler" }),
    );
    expect(createMyBooking).toHaveBeenCalledWith(typedInput);
  });

  test("no pickup: the wizard has no pickup step yet, so a posted address or PIN code is never sent", async () => {
    await confirmBooking(
      "en",
      initialConfirmState,
      form({ ...typedPost, pickupAddress: "12, MG Road, Chakan", pickupPostalCode: "410501", postalCode: "410501" }),
    );
    expect(createMyBooking).toHaveBeenCalledWith(typedInput);
    expect(vi.mocked(createMyBooking).mock.calls[0][0]).not.toHaveProperty("pickup");
  });

  test("a saved vehicle is sent by its id alone", async () => {
    await confirmBooking("en", initialConfirmState, form({ ...typedPost, savedVehicleId: hondaCity.id }));
    expect(createMyBooking).toHaveBeenCalledWith({ ...typedInput, vehicle: { savedVehicleId: hondaCity.id } });
  });
});

describe("confirmBooking: each answer of the save", () => {
  const previous: ConfirmState = { ...initialConfirmState, submission: 4 };

  test("booked: the summary, with the code as people read it and the time as an ISO string", async () => {
    vi.mocked(createMyBooking).mockResolvedValue({
      status: "booked",
      booking: {
        code: "K7Q4MX",
        startsAt: new Date("2026-10-29T04:30:00Z"),
        vehicle: {
          kind: "car",
          modelId: "car-honda-city",
          fuel: "petrol",
          categoryId: "sedan",
          registrationNumber: "MH12AB1234",
        },
        lines: [line],
        totalPaise: null,
        isEstimate: true,
        pickup: null,
      },
    });
    expect(await confirmBooking("en", previous, form(typedPost))).toEqual({
      submission: 5,
      nameTyped: "",
      answer: {
        kind: "booked",
        booking: {
          code: "K7Q-4MX",
          startsAt: "2026-10-29T04:30:00.000Z",
          vehicle: {
            kind: "car",
            modelId: "car-honda-city",
            fuel: "petrol",
            categoryId: "sedan",
            registrationNumber: "MH12AB1234",
          },
          lines: [line],
          totalPaise: null,
          isEstimate: true,
          pickup: null,
        },
      },
    });
  });

  test("duplicate is its own answer, not a plain 'booked': the earlier booking's summary and its code in the message", async () => {
    vi.mocked(createMyBooking).mockResolvedValue({ status: "duplicate", booking: savedBooking });
    expect(await confirmBooking("en", previous, form(typedPost))).toEqual({
      submission: 5,
      nameTyped: "",
      answer: {
        kind: "duplicate",
        booking: savedSummary,
        message: "You already have this booking (code K7Q-4MX).",
      },
      account: ashaAccount,
    });
  });

  test("duplicate of a booking with pickup: the summary carries its pickup copy, fee included", async () => {
    const pickup = { address: "12, MG Road, Chakan", postalCode: "410501", feePaise: 29_900 };
    vi.mocked(createMyBooking).mockResolvedValue({ status: "duplicate", booking: { ...savedBooking, pickup } });
    const state = await confirmBooking("en", previous, form(typedPost));
    expect(state.answer).toMatchObject({ kind: "duplicate", booking: { ...savedSummary, pickup } });
  });

  test("a pickup problem goes to the confirm step with its message", async () => {
    vi.mocked(createMyBooking).mockResolvedValue({
      status: "problems",
      problems: [{ field: "pickup", problem: "pickup-not-offered" }],
    });
    const state = await confirmBooking("en", previous, form(typedPost));
    expect(state.answer).toEqual({
      kind: "problems",
      step: "confirm",
      errors: { form: t.errors.pickup["pickup-not-offered"] },
    });
  });

  test("an unexpected database error from the save comes out without its message or cause", async () => {
    const cause = Object.assign(new Error("new row violates check constraint"), { code: "23514" });
    const failure = Object.assign(
      new Error("Failed query: insert into bookings ... params: Asha Patil, MH12AB1234, 12, MG Road, Chakan", { cause }),
      { name: "DrizzleQueryError" },
    );
    vi.mocked(createMyBooking).mockRejectedValue(failure);
    const error = await confirmBooking("en", previous, form(typedPost)).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BookingServiceError);
    expect((error as Error).message).toBe("createMyBooking failed (DrizzleQueryError 23514)");
    expect((error as Error).cause).toBeUndefined();
    expect(String((error as Error).stack)).not.toMatch(/MG Road|MH12AB1234|Asha|Failed query/);
  });

  test("an unexpected error saving the name comes out the same way", async () => {
    vi.mocked(readMyProfile).mockResolvedValue({ name: "", phoneNumber: asha.phoneNumber });
    vi.mocked(saveMyName).mockRejectedValue(
      Object.assign(new Error("Failed query: update users ... params: Asha Patil"), { name: "DrizzleQueryError" }),
    );
    const error = await confirmBooking("en", previous, form({ ...typedPost, name: "Asha Patil" })).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(BookingServiceError);
    expect((error as Error).message).toBe("saveMyName failed (DrizzleQueryError)");
    expect(createMyBooking).not.toHaveBeenCalled();
  });

  test("full: back to the slot step with a fresh slot list (ISO strings), the account kept", async () => {
    vi.mocked(createMyBooking).mockResolvedValue({ status: "slot-problem", problem: "full" });
    expect(await confirmBooking("en", previous, form(typedPost))).toEqual({
      submission: 5,
      nameTyped: "",
      answer: {
        kind: "slot-problem",
        step: "slot",
        problem: "full",
        errors: { slot: t.errors.slot.full },
        slots: [
          {
            date: "2026-10-29",
            weekday: "thursday",
            status: "open",
            slots: [{ startsAt: "2026-10-29T04:30:00.000Z", endsAt: "2026-10-29T05:30:00.000Z", remaining: 1 }],
          },
          { date: "2026-10-30", weekday: "friday", status: "closed-date" },
        ],
      },
      account: ashaAccount,
    });
  });

  test("registration-duplicate after an inline login: the saved vehicles, the clashing one among them", async () => {
    // The page's first render said "logged out" (no account in the state);
    // the confirm request carries the new login.
    vi.mocked(createMyBooking).mockResolvedValue({ status: "registration-duplicate", savedVehicle: hondaCity });
    const state = await confirmBooking("en", initialConfirmState, form({ ...typedPost, vehicleModel: "car-honda-amaze" }));
    expect(state.answer).toEqual({
      kind: "registration-duplicate",
      step: "vehicle",
      savedVehicleId: hondaCity.id,
      errors: {
        registration:
          "You've already saved MH 12 AB 1234 as a Honda City. Choose it from your vehicles, or check the number.",
      },
    });
    expect(state.account?.vehicles).toContainEqual(hondaCity);
  });

  test("too-many-bookings stays on confirm and says how to reach the garage", async () => {
    vi.mocked(createMyBooking).mockResolvedValue({ status: "too-many-bookings", limit: 3 });
    const state = await confirmBooking("en", previous, form(typedPost));
    expect(state.answer).toEqual({
      kind: "too-many-bookings",
      step: "confirm",
      limit: 3,
      errors: { form: "You already have 3 bookings coming up. To book another, call or WhatsApp us." },
    });
  });

  test("a saved vehicle that isn't this customer's: back to the vehicle step", async () => {
    vi.mocked(createMyBooking).mockResolvedValue({ status: "not-found" });
    expect((await confirmBooking("en", previous, form(typedPost))).answer).toEqual({
      kind: "vehicle-not-found",
      step: "vehicle",
      errors: { vehicle: t.errors.vehicleNotFound },
    });
  });

  test("problems: one message per field, and the first step with a problem", async () => {
    vi.mocked(createMyBooking).mockResolvedValue({
      status: "problems",
      problems: [
        { field: "services", problem: "not-offered", serviceId: "car-wheel-alignment" },
        { field: "registration", problem: "registration-invalid" },
        { field: "registration", problem: "registration-missing" },
      ],
    });
    expect((await confirmBooking("en", previous, form(typedPost))).answer).toEqual({
      kind: "problems",
      step: "vehicle",
      errors: {
        services: t.errors.services["not-offered"],
        registration: allMessages.MyVehicles.errors["registration-invalid"],
      },
    });
    expect(readAvailableSlots).not.toHaveBeenCalled();
  });

  test("a slot problem among the problems brings a fresh slot list too", async () => {
    vi.mocked(createMyBooking).mockResolvedValue({
      status: "problems",
      problems: [{ field: "slot", problem: "slot-invalid" }],
    });
    const { answer } = await confirmBooking("en", previous, form(typedPost));
    expect(answer).toMatchObject({ kind: "problems", step: "slot", errors: { slot: t.errors.slot["slot-invalid"] } });
    expect(answer.kind === "problems" && answer.slots).toHaveLength(2);
  });

  test("a bad request token is a form error on the confirm step", async () => {
    vi.mocked(createMyBooking).mockResolvedValue({
      status: "problems",
      problems: [{ field: "token", problem: "bad-token" }],
    });
    expect((await confirmBooking("en", previous, form(typedPost))).answer).toEqual({
      kind: "problems",
      step: "confirm",
      errors: { form: t.errors.badToken },
    });
  });
});

// --- Not you? ------------------------------------------------------------------

describe("notMe", () => {
  test("signs out with the request's headers, without a redirect, and answers the empty phone step", async () => {
    const requestHeaders = new Headers({ cookie: "better-auth.session_token=abc" });
    vi.mocked(headers).mockResolvedValue(requestHeaders);
    expect(await notMe("en")).toEqual(initialLoginState);
    expect(signOut).toHaveBeenCalledWith({ headers: requestHeaders });
  });

  test("an unknown locale is refused before signing anyone out", async () => {
    await expect(notMe("xx")).rejects.toThrow("Unknown locale");
    expect(signOut).not.toHaveBeenCalled();
  });
});
