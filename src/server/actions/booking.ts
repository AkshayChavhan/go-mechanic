"use server";

// The booking page's Server Actions (task 47): login step, Confirm, "Not you?".
//
// None redirects: a redirect would throw away the wizard's state. So Confirm
// calls authorizeUser(), not requireUser(), and turns "nobody logged in" into
// an answer that sends the wizard back to its login step.
//
// A login made by bookingLoginStep can't be read until the next request, so the
// code step only answers "verified" (with needsName, from Better Auth's own
// answer, not a session read), and confirmBooking (the next request) saves the
// booking
// (document/solutions/conventions/server-action-login-invisible-until-next-request.md).

import "server-only";

import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";

import { formatBookingCode } from "@/domain/bookings";
import { needsName } from "@/domain/profile";
import { formatRegistration } from "@/domain/registration";
import type { Locale } from "@/i18n/config";
import { localize } from "@/i18n/localized-text";
import {
  BOOKING_STEPS,
  type BookingAccount,
  type BookingLoginState,
  type BookingStep,
  type BookingSummary,
  type ConfirmAnswer,
  type ConfirmErrors,
  type ConfirmField,
  type ConfirmState,
  initialBookingLoginState,
  readConfirmForm,
  serializeSlotDays,
} from "@/lib/booking-form";
import { initialLoginState } from "@/lib/login-state";
import { AccessDeniedError, authorizeUser } from "@/server/auth/access";
import { getAuth } from "@/server/auth/instance";
import { type BookedBooking, type BookingSaveProblem, createMyBooking } from "@/server/dal/bookings";
import { listMyVehicles } from "@/server/dal/customer-vehicles";
import { readMyProfile, saveMyName } from "@/server/dal/profile";
import { readAvailableSlots } from "@/server/dal/slots";

import { checkedLocale } from "./form-input";
import { runLoginFormStep } from "./login-form-step";

/** Login step for /book: /login's steps, but a correct code answers "verified" instead of redirecting. */
export async function bookingLoginStep(
  locale: string,
  previous: BookingLoginState,
  formData: FormData,
): Promise<BookingLoginState> {
  const checked = checkedLocale(locale);
  const result = await runLoginFormStep(checked, previous.step === "verified" ? initialLoginState : previous, formData);
  return result.verified
    ? { step: "verified", phoneDisplay: result.phoneDisplay, needsName: result.needsName }
    : result.state;
}

/** "Not you?": logs this browser out and answers the empty phone step. */
export async function notMe(locale: string): Promise<BookingLoginState> {
  checkedLocale(locale);
  const auth = await getAuth();
  await auth.api.signOut({ headers: await headers() });
  return initialBookingLoginState;
}

type BookingTranslator = Awaited<ReturnType<typeof getTranslations<"Booking">>>;

function stepOf(field: BookingSaveProblem["field"]): BookingStep {
  switch (field) {
    case "vehicle":
    case "registration":
      return "vehicle";
    case "services":
      return "services";
    case "slot":
      return "slot";
    case "token":
      return "confirm";
  }
}

/**
 * Saves the booking. Every answer that isn't "booked" carries the customer's
 * saved vehicles and whether a name is still missing, read now: the page's
 * props are stale after an inline login.
 */
export async function confirmBooking(
  locale: string,
  previous: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const checked = checkedLocale(locale);
  const t = await getTranslations({ locale: checked, namespace: "Booking" });
  const { name: nameTyped, ...input } = readConfirmForm(formData);
  const reply = (answer: ConfirmAnswer, account?: BookingAccount): ConfirmState => ({
    submission: previous.submission + 1,
    answer,
    ...(account ? { account } : {}),
    nameTyped,
  });
  const accountFor = async (needsName: boolean): Promise<BookingAccount> => ({
    vehicles: await listMyVehicles(),
    needsName,
  });

  try {
    await authorizeUser();
  } catch (error) {
    unstable_rethrow(error);
    // Only "nobody logged in" has an answer; anything else is a real failure.
    if (error instanceof AccessDeniedError) {
      return reply({ kind: "needs-login", step: "login", errors: { form: t("errors.needsLogin") } });
    }
    throw error;
  }

  if (needsName(await readMyProfile())) {
    if (nameTyped.trim() === "") {
      return reply(
        { kind: "needs-name", step: "confirm", errors: { name: t("errors.needsName") } },
        await accountFor(true),
      );
    }
    const saved = await saveMyName(nameTyped);
    if (!saved.ok) {
      const accountText = await getTranslations({ locale: checked, namespace: "Account" });
      return reply(
        { kind: "needs-name", step: "confirm", errors: { name: accountText(`nameErrors.${saved.problem}`) } },
        await accountFor(true),
      );
    }
  }

  const result = await createMyBooking(input);
  if (result.status === "booked") return reply({ kind: "booked", booking: summaryOf(result.booking) });

  // Read after the save: whatever it answered, this is the customer's list now.
  switch (result.status) {
    case "duplicate": {
      const booking = summaryOf(result.booking);
      return reply(
        { kind: "duplicate", booking, message: t("duplicate", { code: booking.code }) },
        await accountFor(false),
      );
    }
    case "not-found":
      return reply(
        { kind: "vehicle-not-found", step: "vehicle", errors: { vehicle: t("errors.vehicleNotFound") } },
        await accountFor(false),
      );
    case "registration-duplicate": {
      const saved = result.savedVehicle;
      const text = t("errors.registrationDuplicate", {
        registration: formatRegistration(saved.registrationNumber),
        model: `${localize(saved.makeName, checked)} ${localize(saved.modelName, checked)}`,
      });
      return reply(
        { kind: "registration-duplicate", step: "vehicle", savedVehicleId: saved.id, errors: { registration: text } },
        await accountFor(false),
      );
    }
    case "too-many-bookings":
      return reply(
        {
          kind: "too-many-bookings",
          step: "confirm",
          limit: result.limit,
          errors: { form: t("errors.tooManyBookings", { limit: result.limit }) },
        },
        await accountFor(false),
      );
    case "slot-problem": {
      const [account, slots] = await Promise.all([accountFor(false), readAvailableSlots()]);
      return reply(
        {
          kind: "slot-problem",
          step: "slot",
          problem: result.problem,
          errors: { slot: t(`errors.slot.${result.problem}`) },
          slots: serializeSlotDays(slots),
        },
        account,
      );
    }
    case "problems": {
      const [account, answer] = await Promise.all([accountFor(false), problemsAnswer(result.problems, t, checked)]);
      return reply(answer, account);
    }
  }
}

/** A saved booking as the done screen shows it: the code with its dash, the time as an ISO string. */
function summaryOf(booking: BookedBooking): BookingSummary {
  return {
    code: formatBookingCode(booking.code),
    startsAt: booking.startsAt.toISOString(),
    vehicle: booking.vehicle,
    lines: booking.lines,
    totalPaise: booking.totalPaise,
    isEstimate: booking.isEstimate,
  };
}

/** One message per field, sent to the earliest step with a problem. A slot problem brings a fresh slot list. */
async function problemsAnswer(
  problems: readonly BookingSaveProblem[],
  t: BookingTranslator,
  locale: Locale,
): Promise<ConfirmAnswer> {
  // The vehicle's and the number's messages are the add-vehicle form's own.
  const vehicleText = await getTranslations({ locale, namespace: "MyVehicles" });
  const errors: ConfirmErrors = {};
  const text = (problem: BookingSaveProblem): [ConfirmField, string] => {
    switch (problem.field) {
      case "vehicle":
        return ["vehicle", vehicleText(`errors.${problem.problem}`)];
      case "registration":
        return ["registration", vehicleText(`errors.${problem.problem}`)];
      case "services":
        return ["services", t(`errors.services.${problem.problem}`)];
      case "slot":
        return ["slot", t(`errors.slot.${problem.problem}`)];
      case "token":
        return ["form", t("errors.badToken")];
    }
  };
  for (const problem of problems) {
    const [field, message] = text(problem);
    errors[field] ??= message;
  }
  const step = BOOKING_STEPS.find((each) => problems.some((problem) => stepOf(problem.field) === each)) ?? "confirm";
  const slotProblem = problems.some((problem) => problem.field === "slot");
  return {
    kind: "problems",
    step,
    errors,
    ...(slotProblem ? { slots: serializeSlotDays(await readAvailableSlots()) } : {}),
  };
}
