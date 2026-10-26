// Formatting for money, dates, times and addresses, the Indian way.
// Plain functions (no next-intl or Next.js imports), so they work in server
// and client components, tests, and later in SMS, email and CSV code.

import { minutesAfterMidnight, WEEKDAYS, type Weekday } from "@/domain/opening-hours";

import { GARAGE_TIME_ZONE, intlLocales, type Locale } from "./config";
import { localize, type LocalizedText } from "./localized-text";

/**
 * Shows an amount of money stored as integer paise (100 paise = ₹1).
 * 12_345_600 -> "₹1,23,456"; 49_950 -> "₹499.50". Whole rupees show no paise.
 * Throws RangeError if `paise` isn't a safe whole number (money must never be
 * a float: 0.1 + 0.2 isn't exactly 0.3).
 */
export function formatRupees(paise: number, locale: Locale): string {
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError(`formatRupees: expected whole paise, got ${paise}`);
  }
  const hasPaise = paise % 100 !== 0;
  return new Intl.NumberFormat(intlLocales[locale], {
    style: "currency",
    currency: "INR",
    // Show "-" only for amounts below zero, so -0 prints "₹0", not "-₹0".
    signDisplay: "negative",
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  }).format(paise / 100);
}

function assertValidDate(date: Date, name: string) {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`${name}: invalid date`);
  }
}

/** "26 Oct 2026", in India time whatever time zone the computer is in. */
export function formatDate(date: Date, locale: Locale): string {
  assertValidDate(date, "formatDate");
  return new Intl.DateTimeFormat(intlLocales[locale], {
    dateStyle: "medium",
    timeZone: GARAGE_TIME_ZONE,
  }).format(date);
}

/** "10:00 am", in India time whatever time zone the computer is in. */
export function formatTime(date: Date, locale: Locale): string {
  assertValidDate(date, "formatTime");
  return new Intl.DateTimeFormat(intlLocales[locale], {
    timeStyle: "short",
    timeZone: GARAGE_TIME_ZONE,
  }).format(date);
}

// The next two format opening hours, which have no date and no time zone of
// their own: "monday", "19:00". Each builds a stand-in date in UTC and
// formats it in UTC, so the computer's own time zone can't shift the result.

/** "monday" -> "Monday" (long) or "Mon" (short). Hindi gets its names from Intl too. */
export function formatWeekday(weekday: Weekday, locale: Locale, width: "long" | "short" = "long"): string {
  // 26 Oct 2026 is a Monday, so adding 0 to 6 days lands on each weekday.
  const date = new Date(Date.UTC(2026, 9, 26 + WEEKDAYS.indexOf(weekday)));
  return new Intl.DateTimeFormat(intlLocales[locale], { weekday: width, timeZone: "UTC" }).format(date);
}

/**
 * A time of day stored as 24-hour "HH:MM", shown the Indian way:
 * "10:00" -> "10:00 am", "19:00" -> "7:00 pm".
 * Text it can't read is shown as stored instead of throwing: this runs while
 * a page renders.
 */
export function formatTimeOfDay(time: string, locale: Locale): string {
  const minutes = minutesAfterMidnight(time);
  if (minutes === null) return time;
  // Any date works: only the time is shown. Date.UTC turns 600 minutes into 10:00.
  const date = new Date(Date.UTC(2026, 0, 1, 0, minutes));
  return new Intl.DateTimeFormat(intlLocales[locale], { timeStyle: "short", timeZone: "UTC" }).format(date);
}

/**
 * An address with its PIN code at the end, the way Indian addresses are
 * written: "Mukai Chowk, Kiwale, Pune, Maharashtra 412101".
 * The PIN code is stored apart from the text because search engines (task 42)
 * want it as its own field.
 */
export function formatAddress(address: { text: LocalizedText; postalCode: string }, locale: Locale): string {
  const postalCode = address.postalCode.trim();
  const text = localize(address.text, locale);
  return postalCode ? `${text} ${postalCode}` : text;
}

/**
 * Joins the words of a short phrase with no-break spaces (U+00A0), so a line
 * never ends inside it: "10:00 am" stays together instead of leaving "am"
 * alone on the next line in a narrow menu. For short phrases such as a
 * formatted time, never for whole sentences.
 */
export function keepTogether(phrase: string): string {
  return phrase.replace(/ /g, " ");
}
