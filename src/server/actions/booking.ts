"use server";

// The booking page's Server Actions (task 47): its login step, Confirm, and
// "Not you?".
//
// Like the login and account actions, each takes the locale as its bound
// first argument and checks it, since there's no [locale] page around an
// action. None of them redirects: the wizard keeps every choice in its own
// state, and a redirect would throw it away. So Confirm never calls
// requireUser (which redirects to /login); it asks authorizeUser() and turns
// "nobody logged in" into an answer that sends the wizard back to its login
// step.
//
// A login made by bookingLoginStep can't be read until the next request
// (getCurrentUser() reads the request's headers, which an action that sets
// a cookie doesn't change). So the code step only answers "verified", and
// the booking is saved by confirmBooking, the next request, which carries
// the new login (document/solutions/conventions/
// server-action-login-invisible-until-next-request.md).
//
// "use server" must come first; `import "server-only"` (this repo's rule for
// src/server/) follows it.

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
import { type BookingSaveProblem, createMyBooking } from "@/server/dal/bookings";
import { listMyVehicles } from "@/server/dal/customer-vehicles";
import { readMyProfile, saveMyName } from "@/server/dal/profile";
import { readAvailableSlots } from "@/server/dal/slots";

import { checkedLocale } from "./form-input";
import { runLoginFormStep } from "./login-form-step";

/**
 * The booking page's login step: the same phone, code and consent steps as
 * /login (login-form-step.ts), but a correct code answers "verified"
 * instead of redirecting, so the wizard keeps every choice.
 */
export async function bookingLoginStep(
  locale: string,
  previous: BookingLoginState,
  formData: FormData,
): Promise<BookingLoginState> {
  const checked = checkedLocale(locale);
  const result = await runLoginFormStep(checked, previous.step === "verified" ? initialLoginState : previous, formData);
  return result.verified ? { step: "verified", phoneDisplay: result.phoneDisplay } : result.state;
}

/**
 * "Not you?": logs this browser out (its session row and cookie) and
 * answers the empty phone step, without leaving the page.
 */
export async function notMe(locale: string): Promise<BookingLoginState> {
  checkedLocale(locale);
  const auth = await getAuth();
  await auth.api.signOut({ headers: await headers() });
  return initialBookingLoginState;
}

type BookingTranslator = Awaited<ReturnType<typeof getTranslations<"Booking">>>;

/** The step each problem's field belongs to. */
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
 * Saves the booking (the confirm step). Reads only the fields it needs
 * (readConfirmForm): a posted userId, price or vehicle type does nothing.
 * A customer with no name gives it here; it is saved before the booking.
 * Every answer that isn't "booked" carries the customer's saved vehicles
 * and whether a name is still missing, read now (plan KTD10).
 */
export async function confirmBooking(
  locale: string,
  previous: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const checked = checkedLocale(locale);
  const t = await getTranslations({ locale: checked, namespace: "Booking" });
  const { name: nameTyped, ...input } = readConfirmForm(formData);
  const answer = (answer: ConfirmAnswer, account?: BookingAccount): ConfirmState => ({
    submission: previous.submission + 1,
    answer,
    ...(account ? { account } : {}),
    nameTyped,
  });

  try {
    await authorizeUser();
  } catch (error) {
    unstable_rethrow(error);
    // Only "nobody logged in" has an answer; anything else is a real failure.
    if (error instanceof AccessDeniedError) {
      return answer({ kind: "needs-login", step: "login", errors: { form: t("errors.needsLogin") } });
    }
    throw error;
  }

  if (needsName(await readMyProfile())) {
    const account = { vehicles: await listMyVehicles(), needsName: true };
    if (nameTyped.trim() === "") {
      return answer({ kind: "needs-name", step: "confirm", errors: { name: t("errors.needsName") } }, account);
    }
    const saved = await saveMyName(nameTyped);
    if (!saved.ok) {
      const accountText = await getTranslations({ locale: checked, namespace: "Account" });
      return answer(
        { kind: "needs-name", step: "confirm", errors: { name: accountText(`nameErrors.${saved.problem}`) } },
        account,
      );
    }
  }

  const result = await createMyBooking(input);
  if (result.status === "booked") {
    const { booking } = result;
    return answer({
      kind: "booked",
      booking: {
        code: formatBookingCode(booking.code),
        startsAt: booking.startsAt.toISOString(),
        vehicle: booking.vehicle,
        lines: booking.lines,
        totalPaise: booking.totalPaise,
        isEstimate: booking.isEstimate,
      },
    });
  }

  // Read after the save: whatever it answered, this is the customer's list now.
  const account = { vehicles: await listMyVehicles(), needsName: false };
  switch (result.status) {
    case "duplicate": {
      const code = formatBookingCode(result.code);
      return answer({ kind: "duplicate", code, message: t("duplicate", { code }) }, account);
    }
    case "not-found":
      return answer(
        { kind: "vehicle-not-found", step: "vehicle", errors: { vehicle: t("errors.vehicleNotFound") } },
        account,
      );
    case "registration-duplicate": {
      const saved = result.savedVehicle;
      const text = t("errors.registrationDuplicate", {
        registration: formatRegistration(saved.registrationNumber),
        model: `${localize(saved.makeName, checked)} ${localize(saved.modelName, checked)}`,
      });
      return answer(
        { kind: "registration-duplicate", step: "vehicle", savedVehicleId: saved.id, errors: { registration: text } },
        account,
      );
    }
    case "too-many-bookings":
      return answer(
        {
          kind: "too-many-bookings",
          step: "confirm",
          limit: result.limit,
          errors: { form: t("errors.tooManyBookings", { limit: result.limit }) },
        },
        account,
      );
    case "slot-problem":
      return answer(
        {
          kind: "slot-problem",
          step: "slot",
          problem: result.problem,
          errors: { slot: t(`errors.slot.${result.problem}`) },
          slots: serializeSlotDays(await readAvailableSlots()),
        },
        account,
      );
    case "problems":
      return answer(await problemsAnswer(result.problems, t, checked), account);
  }
}

/**
 * The input's problems, one message per field (the first problem found is
 * the one to fix first), sent back to the earliest step that has one. A
 * problem with the slot brings a fresh slot list.
 */
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
