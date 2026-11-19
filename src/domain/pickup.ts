// Pickup and drop (task 24): the garage collects the vehicle from the
// customer's address and brings it back, for one fee per PIN code.
//
// Pure rules: no Next.js, React or database imports. The garage's areas live
// in the pickup_areas table (empty until the owner gives real ones; the
// samples under `npm run dev` are in src/content/sample-pickup-areas.ts and
// never reach a booking). A booking that asks for pickup is checked with
// checkPickupInput() (through checkBookingInput) and priced with
// findPickupArea() against the real, listed areas.

import { isIndianPinCode } from "./garage";

/** One PIN code the garage picks up from, with its fee for pickup and drop together. */
export type PickupArea = {
  /** Six digits: "412101". */
  postalCode: string;
  /** In paise, the same for every vehicle; 0 means free. */
  feePaise: number;
};

/** The limits on what a customer types. */
export const PICKUP_RULES = {
  /** Characters, after trimming and collapsing spaces. */
  addressMinLength: 10,
  addressMaxLength: 200,
} as const;

/** What the booking form posts, as typed. */
export type PickupInput = { address: string; postalCode: string };

export type PickupProblem =
  | "address-missing"
  | "address-too-short"
  | "address-too-long"
  | "postal-code-invalid"
  | "pickup-not-offered";

/** What can be wrong with what was typed (the PIN code being served is the save's check). */
export type PickupInputProblem = Exclude<PickupProblem, "pickup-not-offered">;

/** Trims and collapses every run of spaces and line breaks: "  12, MG Road\n Chakan " is "12, MG Road Chakan". */
export function normalizeAddress(typed: string): string {
  return typed.trim().replace(/\s+/g, " ");
}

/** A PIN code as typed, without spaces: "412 101" is "412101". */
function normalizePostalCode(typed: string): string {
  return typed.replace(/\s+/g, "");
}

/** Whether the customer asked for pickup: anything typed in either field. */
export function asksForPickup(input: PickupInput | undefined): input is PickupInput {
  return input !== undefined && (input.address.trim() !== "" || input.postalCode.trim() !== "");
}

/**
 * The address and PIN code to store, or every problem with them. Whether the
 * garage picks up from that PIN code needs the database: the booking save
 * checks it next, with findPickupArea().
 */
export function checkPickupInput(
  input: PickupInput,
): { ok: true; pickup: PickupInput } | { ok: false; problems: PickupInputProblem[] } {
  const problems: PickupInputProblem[] = [];
  const address = normalizeAddress(input.address);
  const length = [...address].length;
  if (length === 0) problems.push("address-missing");
  else if (length < PICKUP_RULES.addressMinLength) problems.push("address-too-short");
  else if (length > PICKUP_RULES.addressMaxLength) problems.push("address-too-long");

  const postalCode = normalizePostalCode(input.postalCode);
  if (!isIndianPinCode(postalCode)) problems.push("postal-code-invalid");

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, pickup: { address, postalCode } };
}

/** The area for a PIN code, from the listed areas only; null when the garage doesn't pick up there. */
export function findPickupArea(areas: readonly PickupArea[], postalCode: string): PickupArea | null {
  return areas.find((area) => area.postalCode === postalCode) ?? null;
}
