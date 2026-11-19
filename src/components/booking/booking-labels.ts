// The booking wizard's words and the small functions that fill their {placeholders}. The page passes Booking.wizard from messages/en.json as one prop (getMessages().Booking.wizard); the wizard reads no messages itself.

import type { LinePrice } from "@/components/booking/booking-prices";
import type { BookingStep } from "@/lib/booking-form";
import { formatRupees } from "@/i18n/format";
import type { Locale } from "@/i18n/config";

/** Booking.wizard in messages/en.json, read raw: templates keep their {placeholders}. */
export type BookingWizardLabels = {
  /** "Step {n} of {total}" */
  stepOf: string;
  steps: Record<BookingStep, string>;
  back: string;
  continue: string;
  savedLegend: string;
  anotherVehicle: string;
  registrationLabel: string;
  registrationHint: string;
  vehicleReason: string;
  registrationAgain: string;
  packagesLegend: string;
  packagesHint: string;
  servicesLegend: string;
  servicesReason: string;
  noServices: string;
  /** "{name} removed: ..." */
  packageReplaced: string;
  servicesReplaced: string;
  /** "Removed, as it isn't offered for this vehicle: {names}." */
  notOffered: string;
  /** "You've chosen {max} services, ..." */
  atMost: string;
  onInspection: string;
  noPrice: string;
  /** "Total: {amount}" */
  total: string;
  /** "Estimate: {amount}, the rest confirmed at the garage" */
  estimate: string;
  noTotal: string;
  payAtGarage: string;
  dayLegend: string;
  timeLegend: string;
  closed: string;
  full: string;
  slotReason: string;
  timesNote: string;
  noSlots: string;
  /** "Booking as {phone}" */
  bookingAs: string;
  notMe: string;
  vehicleTerm: string;
  servicesTerm: string;
  timeTerm: string;
  totalTerm: string;
  change: string;
  /** "Change {part}": the Change buttons' names for screen readers. */
  changeLabel: string;
  /** "{day} at {time}" */
  slotAt: string;
  nameLabel: string;
  nameHint: string;
  confirm: string;
  confirming: string;
  doneHeading: string;
  duplicateHeading: string;
  codeLabel: string;
  codeNote: string;
  reachUs: string;
  /** What a failed call says: no network, or the server broke. */
  connection: string;
};

/** A template with its {placeholders} filled in: fill("Total: {amount}", { amount: "₹499" }). */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** One line's price: "₹1,499", "Price after inspection" or "Price confirmed at the garage". */
export function linePriceText(line: LinePrice, labels: BookingWizardLabels, locale: Locale): string {
  if (line.priceStatus === "price" && line.pricePaise !== null) return formatRupees(line.pricePaise, locale);
  return line.priceStatus === "on-inspection" ? labels.onInspection : labels.noPrice;
}

/**
 * The total, in the same words on every step: no amount when no line has
 * one, an estimate when some do, and a plain total when all do.
 */
export function totalText(
  total: { totalPaise: number | null; isEstimate: boolean },
  labels: BookingWizardLabels,
  locale: Locale,
): string {
  if (total.totalPaise === null) return labels.noTotal;
  const amount = formatRupees(total.totalPaise, locale);
  return fill(total.isEstimate ? labels.estimate : labels.total, { amount });
}
