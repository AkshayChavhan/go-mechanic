// One step of the login form, shared by the two places it shows: /login
// (loginStep in login.ts) and the booking page's login step (bookingLoginStep
// in booking.ts, task 47). Each of them decides what a correct code leads to:
// /login redirects to /account, the booking page answers "verified" and
// stays where it is.
//
// Not a "use server" file: those may export only Server Actions, and this is
// a plain helper they call.

import "server-only";

import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";

import type { Locale } from "@/i18n/config";
import { formatDate, formatTime } from "@/i18n/format";
import { systemClock } from "@/lib/clock";
import { formatPhoneNumber } from "@/lib/contact-links";
import { initialLoginState, type LoginState } from "@/lib/login-state";
import type { Auth } from "@/server/auth/auth";
import { getAuth } from "@/server/auth/instance";
import { clientIpKey, requestLoginCode, verifyLoginCode } from "@/server/auth/login";
import { serverEnv } from "@/server/env";

import { formText } from "./form-input";

type LoginTranslator = Awaited<ReturnType<typeof getTranslations<"Login">>>;

/** What a step of the login form led to: a correct code, or the form's next state. */
export type LoginFormStepResult = { verified: true; phoneDisplay?: string } | { verified: false; state: LoginState };

/**
 * "Try again after 10:00 am", with the date when that's not today in India
 * (the daily limit can lift tomorrow): "Try again on 29 Oct 2026 after 10:00 am".
 */
function rateLimitedText(t: LoginTranslator, retryAt: Date, locale: Locale): string {
  const time = formatTime(retryAt, locale);
  const date = formatDate(retryAt, locale);
  return date === formatDate(systemClock.now(), locale)
    ? t("errors.rateLimited", { time })
    : t("errors.rateLimitedLater", { date, time });
}

/**
 * Runs one step of the login form, told apart by the button pressed
 * (formData "intent"): "send" (the phone step), "resend" ("Send a new
 * code") or "verify" (the code step). The locale must already be checked.
 * Never redirects: the caller decides what a correct code leads to.
 */
export async function runLoginFormStep(
  locale: Locale,
  previous: LoginState,
  formData: FormData,
): Promise<LoginFormStepResult> {
  const t = await getTranslations({ locale, namespace: "Login" });
  const intent = formText(formData, "intent");
  const requestHeaders = await headers();
  const auth = await getAuth();

  if (intent === "verify") {
    const result = await verifyLoginCode(
      auth,
      { locale, attemptId: formText(formData, "attemptId"), codeTyped: formText(formData, "code") },
      requestHeaders,
    );
    if (result.ok) return { verified: true, phoneDisplay: previous.phoneDisplay };
    if (result.problem === "startOver") {
      return { verified: false, state: { ...initialLoginState, error: { field: "form", text: t("errors.startOver") } } };
    }
    return {
      verified: false,
      state: {
        ...previous,
        step: "code",
        status: undefined,
        retryAt: undefined,
        // Unchanged, also after too many tries: the code is dead then, and
        // "Send a new code" works as soon as the 30 seconds since the last SMS
        // are over (usually long ago), never earlier, which the server would
        // only refuse with "please wait".
        resendAt: previous.resendAt,
        error: { field: "code", text: t(`errors.${result.problem}`) },
      },
    };
  }

  return { verified: false, state: await sendCodeStep(locale, previous, formData, { t, auth, requestHeaders }) };
}

/** The phone step and "Send a new code": asks the login service for a code. */
async function sendCodeStep(
  locale: Locale,
  previous: LoginState,
  formData: FormData,
  { t, auth, requestHeaders }: { t: LoginTranslator; auth: Auth; requestHeaders: Headers },
): Promise<LoginState> {
  const ipKey = clientIpKey(requestHeaders, serverEnv().appEnv);
  const resend = formText(formData, "intent") === "resend";
  const kept = {
    phoneTyped: resend ? previous.phoneTyped : formText(formData, "phone"),
    ageConfirmed: resend ? previous.ageConfirmed : formData.get("age") === "on",
    contactConsent: resend ? previous.contactConsent : formData.get("consent") === "on",
  };
  const result = await requestLoginCode(
    auth,
    resend
      ? { locale, intent: "resend", attemptId: formText(formData, "attemptId"), ipKey }
      : { locale, intent: "start", ...kept, phoneTyped: kept.phoneTyped, ipKey },
    systemClock,
  );

  if (result.ok) {
    const phoneDisplay = formatPhoneNumber(result.phoneNumber);
    return {
      ...kept,
      step: "code",
      attemptId: result.attemptId,
      phoneDisplay,
      resendAt: result.resendAt.toISOString(),
      status: t(result.sent ? "codeSentTo" : "alreadySentTo", { number: phoneDisplay }),
    };
  }

  const step = resend ? "code" : "phone";
  switch (result.problem) {
    case "invalidPhone":
      return { ...kept, step, error: { field: "phone", text: t("errors.invalidPhone") } };
    case "consentMissing":
      return { ...kept, step, error: { field: "consent", text: t("errors.consentMissing") } };
    case "startOver":
      return { ...initialLoginState, error: { field: "form", text: t("errors.startOver") } };
    case "tooSoon":
      return {
        ...previous,
        ...kept,
        step,
        attemptId: resend ? result.attemptId : previous.attemptId,
        resendAt: resend ? result.retryAt.toISOString() : previous.resendAt,
        retryAt: result.retryAt.toISOString(),
        status: undefined,
        error: { field: "form", text: t("errors.tooSoon") },
      };
    case "rateLimited":
      return {
        ...previous,
        ...kept,
        step,
        attemptId: resend ? result.attemptId : previous.attemptId,
        resendAt: resend ? result.retryAt.toISOString() : previous.resendAt,
        status: undefined,
        error: { field: "form", text: rateLimitedText(t, result.retryAt, locale) },
      };
  }
}
