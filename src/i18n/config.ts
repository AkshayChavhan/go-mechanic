// Languages and formatting settings, in one place.
//
// To add Hindi later: add "hi" to `locales`, add "hi-IN" to `intlLocales`,
// and create messages/hi.json. No page has to move.

/** Languages the site is available in. The first one is the default. */
export const locales = ["en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/**
 * Route locales are short ("en"), but number and date formatting needs the
 * Indian variant: "en-IN" groups numbers the Indian way (₹1,23,456) and writes
 * dates as "25 Oct 2026". Plain "en" would give ₹123,456 and US date order.
 */
export const intlLocales: Record<Locale, string> = {
  en: "en-IN",
};

/** The garage's time zone. Servers usually run in UTC, so always pass this. */
export const GARAGE_TIME_ZONE = "Asia/Kolkata";
