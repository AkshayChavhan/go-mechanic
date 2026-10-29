"use server";

// The account's Server Actions (task 21): saving the customer's name, and
// adding a vehicle.
//
// Like the login actions (login.ts), each takes the locale as its bound first
// argument and checks it, since there's no [locale] page around an action.
// Then it checks who is logged in (requireUser): logged out, it redirects to
// /login. The data-access functions check the session again themselves and
// take the user from it, so a "userId" field in a posted form does nothing.
//
// "use server" must come first; `import "server-only"` (this repo's rule for
// src/server/) follows it.

import "server-only";

import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { RedirectType } from "next/navigation";

import { needsName } from "@/domain/profile";
import type { Locale } from "@/i18n/config";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { NameFormState, VehicleFormField, VehicleFormState, VehicleFormValues } from "@/lib/account-forms";
import { ACCOUNT_PATH } from "@/lib/access-routes";
import { requireUser } from "@/server/auth/access";
import { addMyVehicle } from "@/server/dal/customer-vehicles";
import { readMyProfile, saveMyName } from "@/server/dal/profile";

function checkedLocale(locale: string): Locale {
  if (!hasLocale(routing.locales, locale)) throw new Error("Unknown locale");
  return locale;
}

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

/**
 * Back to /account. Outside any try: redirect() works by throwing.
 * "replace" swaps the form's page out of the history, so Back doesn't
 * return to a form that was already sent.
 */
function toAccount(locale: Locale): never {
  return redirect({ href: ACCOUNT_PATH, locale }, RedirectType.replace);
}

/** Saves the customer's name (the form on /account), then shows the account. */
export async function saveName(locale: string, previous: NameFormState, formData: FormData): Promise<NameFormState> {
  const checked = checkedLocale(locale);
  await requireUser(checked);
  const nameTyped = text(formData, "name");
  const result = await saveMyName(nameTyped);
  if (result.ok) return toAccount(checked);
  const t = await getTranslations({ locale: checked, namespace: "Account" });
  return { submission: previous.submission + 1, nameTyped, error: t(`nameErrors.${result.problem}`) };
}

/**
 * Adds a vehicle (the form on /account/vehicles/new), then shows the
 * account. A customer with no name yet is sent to /account first, even if
 * they post this form directly. Of the picker's fields, only the model and
 * fuel count: the type and brand follow from the model.
 */
export async function addVehicle(
  locale: string,
  previous: VehicleFormState,
  formData: FormData,
): Promise<VehicleFormState> {
  const checked = checkedLocale(locale);
  await requireUser(checked);
  if (needsName(await readMyProfile())) return toAccount(checked);

  const values: VehicleFormValues = {
    modelId: text(formData, "vehicleModel"),
    fuel: text(formData, "vehicleFuel"),
    registration: text(formData, "registration"),
    pucExpiresOn: text(formData, "pucExpiresOn"),
    insuranceExpiresOn: text(formData, "insuranceExpiresOn"),
  };
  const result = await addMyVehicle(values);
  if (result.status === "saved") return toAccount(checked);

  const t = await getTranslations({ locale: checked, namespace: "MyVehicles" });
  const errors: Partial<Record<VehicleFormField, string>> = {};
  // One message per field: the first problem found is the one to fix first.
  for (const { field, problem } of result.problems) errors[field] ??= t(`errors.${problem}`);
  return { submission: previous.submission + 1, values, errors };
}
