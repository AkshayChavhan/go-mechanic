"use server";

// The staff price editor's Server Action (task 39): one price group's card on
// /admin/prices/[serviceId].
//
// It takes the locale as its bound first argument and checks it, then checks
// the permission (requirePermission: logged out, a redirect to /login;
// without content.edit, the 404). The service and the price group are bound
// by the page, never read from the form; the save checks them again and
// answers "not-found" for anything the site doesn't list.
//
// "use server" must come first; `import "server-only"` follows it.

import "server-only";

import { getTranslations } from "next-intl/server";

import { groupPriceRow } from "@/domain/services";
import { formatRupeeAmount, formatRupees } from "@/i18n/format";
import { PRICE_BOXES, type PriceFormState, type PriceFormValues, priceEntries, readPriceForm } from "@/lib/price-form";
import { requirePermission } from "@/server/auth/access";
import { saveGroupPrices } from "@/server/dal/services";

import { checkedLocale } from "./form-input";

/** Saves one price group's prices for one service or package; live on the site at once. */
export async function savePrices(
  locale: string,
  serviceId: string,
  categoryId: string,
  previous: PriceFormState,
  formData: FormData,
): Promise<PriceFormState> {
  const checked = checkedLocale(locale);
  await requirePermission(checked, "content.edit");

  const typed = readPriceForm(formData);
  const next = { submission: previous.submission + 1, values: typed, saved: null };
  const t = await getTranslations({ locale: checked, namespace: "AdminPrices" });

  const parsed = priceEntries(typed);
  if (!parsed.ok) {
    const errors: PriceFormState["errors"] = {};
    for (const { box, problem } of parsed.problems) errors[box] = t(`errors.${problem}`);
    return { ...next, errors };
  }

  // Bound by the page, but a hand-made call could send anything: only strings go on.
  const result = await saveGroupPrices(
    typeof serviceId === "string" ? serviceId : "",
    typeof categoryId === "string" ? categoryId : "",
    parsed.entries,
  );
  if (result.status === "not-found" || result.status === "on-inspection") {
    return { ...next, errors: { form: t(`errors.${result.status}`) } };
  }
  if (result.status === "problems") {
    const errors: PriceFormState["errors"] = {};
    // One message per box: the first problem found is the one to fix first.
    for (const { field, problem } of result.problems) errors[field] ??= t(`errors.${problem}`);
    return { ...next, errors };
  }

  const tVehicles = await getTranslations({ locale: checked, namespace: "Vehicles" });
  // What the boxes show now: the saved amounts, grouped the Indian way, without "₹".
  const values: PriceFormValues = {};
  for (const box of PRICE_BOXES) {
    if (typed[box] === undefined) continue;
    const row = result.prices.find((price) => price.fuel === (box === "group" ? null : box));
    values[box] = row ? formatRupeeAmount(row.pricePaise, checked) : "";
  }

  // What each fuel pays now: its own price, else the group's, else none.
  const saved =
    result.prices.length === 0
      ? [t("savedNone")]
      : result.fuels.map((fuel) => {
          const row = groupPriceRow(result.prices, fuel);
          return t("savedLine", {
            fuel: tVehicles(`fuels.${fuel}`),
            price: row ? formatRupees(row.pricePaise, checked) : t("noPrice"),
          });
        });
  return { submission: next.submission, values, errors: {}, saved };
}
