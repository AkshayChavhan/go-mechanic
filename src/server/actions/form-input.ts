// What every Server Action does with its input first, shared by the action
// files (login.ts, account.ts). Not a "use server" file: those may export
// only async functions, and these are plain helpers.

import "server-only";

import { hasLocale } from "next-intl";

import type { Locale } from "@/i18n/config";
import { routing } from "@/i18n/routing";

/**
 * The locale the page bound as the action's first argument, checked: a
 * Server Action has no [locale] page around it. Throws for an unknown one,
 * before the action does anything else.
 */
export function checkedLocale(locale: string): Locale {
  if (!hasLocale(routing.locales, locale)) throw new Error("Unknown locale");
  return locale;
}

/** A form field's text, or "" when it's missing (or a file). */
export function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
