"use server";

// The free estimate request's Server Action (task 32): the form on /estimate.
//
// Like the account's actions (account.ts), it takes the locale as its bound
// first argument and checks it, since there's no [locale] page around an
// action. Then it checks who is logged in (requireUser): logged out, it
// redirects to /login; with no name yet, to /account, where the name form
// is. The data-access save checks the session again and takes the user from
// it, so a "userId" field in a posted form does nothing.
//
// "use server" must come first; `import "server-only"` (this repo's rule for
// src/server/) follows it.

import "server-only";

import { getTranslations } from "next-intl/server";
import { RedirectType } from "next/navigation";

import { needsName } from "@/domain/profile";
import type { Locale } from "@/i18n/config";
import { redirect } from "@/i18n/navigation";
import { ACCOUNT_PATH } from "@/lib/access-routes";
import {
  type EstimateFormField,
  type EstimateFormState,
  estimateRequestInput,
  readEstimateForm,
} from "@/lib/estimate-form";
import { requireUser } from "@/server/auth/access";
import { createMyEstimateRequest } from "@/server/dal/estimate-requests";
import { readMyProfile } from "@/server/dal/profile";

import { checkedLocale } from "./form-input";

/**
 * To /account, where the request now heads the list. Outside any try:
 * redirect() works by throwing. "replace" swaps the form's page out of the
 * history, so Back doesn't return to a form that was already sent.
 */
function toAccount(locale: Locale): never {
  return redirect({ href: ACCOUNT_PATH, locale }, RedirectType.replace);
}

/** Sends a request for a free estimate, then shows the account. */
export async function sendEstimateRequest(
  locale: string,
  previous: EstimateFormState,
  formData: FormData,
): Promise<EstimateFormState> {
  const checked = checkedLocale(locale);
  await requireUser(checked);
  if (needsName(await readMyProfile())) return toAccount(checked);

  const result = await createMyEstimateRequest(estimateRequestInput(formData));
  // A second send of the same form: the first request stands, so the same place.
  if (result.status === "sent" || result.status === "duplicate") return toAccount(checked);

  const t = await getTranslations({ locale: checked, namespace: "EstimatePage" });
  const errors: Partial<Record<EstimateFormField, string>> = {};
  if (result.status === "not-found") errors.vehicle = t("errors.vehicle-gone");
  else if (result.status === "too-many-requests") errors.form = t("errors.too-many-requests", { limit: result.limit });
  else {
    // One message per field: the first problem found is the one to fix first.
    for (const { field, problem } of result.problems) errors[field] ??= t(`errors.${problem}`);
  }
  return { submission: previous.submission + 1, values: readEstimateForm(formData), errors };
}
