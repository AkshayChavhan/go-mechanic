"use server";

// The login page's Server Actions: the only way into the login service.
//
// A Server Action is a server function a form can call. Next.js turns it
// into a POST to the page, checks that the request's Origin matches the site
// (so another website can't submit these forms), and runs it here.
//
// The page binds the locale as the first argument (loginStep.bind(null,
// locale)): there's no [locale] page around an action, so next-intl can't
// find it on its own. Each action checks it before doing anything.
//
// "use server" must come first; `import "server-only"` (this repo's rule for
// src/server/) follows it.

import "server-only";

import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { RedirectType } from "next/navigation";

import type { Locale } from "@/i18n/config";
import { formatTime } from "@/i18n/format";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { systemClock } from "@/lib/clock";
import { formatPhoneNumber } from "@/lib/contact-links";
import { initialLoginState, type LoginState } from "@/lib/login-state";
import { getAuth } from "@/server/auth/instance";
import { clientIpKey, requestLoginCode, verifyLoginCode } from "@/server/auth/login";
import { serverEnv } from "@/server/env";

function checkedLocale(locale: string): Locale {
  if (!hasLocale(routing.locales, locale)) throw new Error("Unknown locale");
  return locale;
}

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

/**
 * Every step of the login form, told apart by the button pressed
 * (formData "intent"): "send" (the phone step), "resend" ("Send a new
 * code") or "verify" (the code step). A correct code redirects to /account.
 */
export async function loginStep(locale: string, previous: LoginState, formData: FormData): Promise<LoginState> {
  const checked = checkedLocale(locale);
  const t = await getTranslations({ locale: checked, namespace: "Login" });
  const intent = text(formData, "intent");
  const requestHeaders = await headers();
  const auth = await getAuth();

  if (intent === "verify") {
    const result = await verifyLoginCode(
      auth,
      { locale: checked, attemptId: text(formData, "attemptId"), codeTyped: text(formData, "code") },
      requestHeaders,
    );
    if (result.ok) {
      // Outside any try: redirect() works by throwing. "replace" swaps the
      // login page out of the history, so Back doesn't return to it.
      return redirect({ href: "/account", locale: checked }, RedirectType.replace);
    }
    if (result.problem === "startOver") {
      return { ...initialLoginState, error: { field: "form", text: t("errors.startOver") } };
    }
    return {
      ...previous,
      step: "code",
      status: undefined,
      retryAt: undefined,
      // After too many tries the code is dead: "Send a new code" works at once.
      resendAt: result.problem === "tooManyTries" ? new Date(0).toISOString() : previous.resendAt,
      error: { field: "code", text: t(`errors.${result.problem}`) },
    };
  }

  const ipKey = clientIpKey(requestHeaders, serverEnv().appEnv);
  const resend = intent === "resend";
  const kept = {
    phoneTyped: resend ? previous.phoneTyped : text(formData, "phone"),
    ageConfirmed: resend ? previous.ageConfirmed : formData.get("age") === "on",
    contactConsent: resend ? previous.contactConsent : formData.get("consent") === "on",
  };
  const result = await requestLoginCode(
    auth,
    resend
      ? { locale: checked, intent: "resend", attemptId: text(formData, "attemptId"), ipKey }
      : { locale: checked, intent: "start", ...kept, phoneTyped: kept.phoneTyped, ipKey },
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
        error: { field: "form", text: t("errors.rateLimited", { time: formatTime(result.retryAt, checked) }) },
      };
  }
}

/** Logs this browser out (its session row and cookie), then goes to the home page. */
export async function logOut(locale: string): Promise<void> {
  const checked = checkedLocale(locale);
  const auth = await getAuth();
  await auth.api.signOut({ headers: await headers() });
  redirect({ href: "/", locale: checked }, RedirectType.replace);
}
