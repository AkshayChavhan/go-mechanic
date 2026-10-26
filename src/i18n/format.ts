// Formatting for money, dates and times, the Indian way.
// Plain functions (no next-intl or Next.js imports), so they work in server
// and client components, tests, and later in SMS, email and CSV code.

import { GARAGE_TIME_ZONE, intlLocales, type Locale } from "./config";

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
