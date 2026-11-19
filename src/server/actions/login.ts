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

import { headers } from "next/headers";
import { RedirectType } from "next/navigation";

import { redirect } from "@/i18n/navigation";
import type { LoginState } from "@/lib/login-state";
import { getAuth } from "@/server/auth/instance";

import { checkedLocale } from "./form-input";
import { runLoginFormStep } from "./login-form-step";

/**
 * Every step of the login form, told apart by the button pressed
 * (formData "intent"): "send" (the phone step), "resend" ("Send a new
 * code") or "verify" (the code step). The steps themselves live in
 * login-form-step.ts, shared with the booking page. A correct code
 * redirects to /account.
 */
export async function loginStep(locale: string, previous: LoginState, formData: FormData): Promise<LoginState> {
  const checked = checkedLocale(locale);
  const result = await runLoginFormStep(checked, previous, formData);
  // Outside any try: redirect() works by throwing. "replace" swaps the
  // login page out of the history, so Back doesn't return to it.
  if (result.verified) return redirect({ href: "/account", locale: checked }, RedirectType.replace);
  return result.state;
}

/** Logs this browser out (its session row and cookie), then goes to the home page. */
export async function logOut(locale: string): Promise<void> {
  const checked = checkedLocale(locale);
  const auth = await getAuth();
  await auth.api.signOut({ headers: await headers() });
  redirect({ href: "/", locale: checked }, RedirectType.replace);
}
