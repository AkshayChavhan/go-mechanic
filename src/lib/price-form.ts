// What one price group's card in the staff price editor shows (task 39):
// the state its Server Action (src/server/actions/prices.ts) returns after
// each save, and the one reader of what the card posts. It lives here because
// a "use server" file may only export async functions, and the browser needs
// the starting state too.
//
// A card posts the group's box ("every fuel") and one box per fuel it offers.
// Blank boxes mean "no price". Like the account forms, each answer carries a
// submission counter, and the card remounts after it with the answer's values.

import { parseRupees, type RupeesProblem } from "@/domain/money";
import type { GroupPriceEntry } from "@/domain/services";
import { FUELS, type Fuel } from "@/domain/vehicles";
import { formText } from "@/lib/form-text";

/** A card's boxes: the group's own price, or one fuel's. */
export type PriceBox = "group" | Fuel;

export const PRICE_BOXES: readonly PriceBox[] = ["group", ...FUELS];

/** The posted name of a box: "price-group", "price-diesel". */
export function priceFieldName(box: PriceBox): string {
  return `price-${box}`;
}

/** What each posted box held, as typed. Boxes the card didn't post are left out. */
export type PriceFormValues = Partial<Record<PriceBox, string>>;

/** The card's boxes from what it posted. */
export function readPriceForm(formData: FormData): PriceFormValues {
  const values: PriceFormValues = {};
  for (const box of PRICE_BOXES) {
    if (formData.has(priceFieldName(box))) values[box] = formText(formData, priceFieldName(box));
  }
  return values;
}

export type PriceEntries =
  | { ok: true; entries: GroupPriceEntry[] }
  | { ok: false; problems: { box: PriceBox; problem: Exclude<RupeesProblem, "blank"> }[] };

/** The prices to save from the typed boxes: blank boxes are left out (no price). */
export function priceEntries(values: PriceFormValues): PriceEntries {
  const entries: GroupPriceEntry[] = [];
  const problems: { box: PriceBox; problem: Exclude<RupeesProblem, "blank"> }[] = [];
  for (const box of PRICE_BOXES) {
    const typed = values[box];
    if (typed === undefined) continue;
    const parsed = parseRupees(typed);
    if (parsed.ok) entries.push({ fuel: box === "group" ? null : box, pricePaise: parsed.paise });
    else if (parsed.problem !== "blank") problems.push({ box, problem: parsed.problem });
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, entries };
}

/** The parts of a card an error can belong to; "form" is the whole card. */
export type PriceFormField = PriceBox | "form";

export type PriceFormState = {
  /** Goes up by one with every answer. */
  submission: number;
  /** After a save, the saved amounts ("1,500"); after an error, what was typed. */
  values: PriceFormValues;
  errors: Partial<Record<PriceFormField, string>>;
  /** After a save: one line per fuel the card offers, with its price or "no price". */
  saved: string[] | null;
};

export const initialPriceFormState: PriceFormState = { submission: 0, values: {}, errors: {}, saved: null };
