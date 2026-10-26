import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";

import { GARAGE_TIME_ZONE } from "./config";
import { routing } from "./routing";

// Tells next-intl, for each request, which language to use and where its text is.
export default getRequestConfig(async ({ locale: explicitLocale }) => {
  // Code outside the [locale] pages (the global 404, later Server Actions and
  // Route Handlers) passes the locale itself. Pages get it from the URL's
  // [locale] segment through next/root-params, which keeps them static under
  // Cache Components (the older header-based way would make them dynamic).
  const locale = explicitLocale ?? (await rootLocale());

  // "[locale]" matches anything, e.g. "/foo.bar" -> locale "foo.bar". Unknown
  // values are a 404, never a page in the wrong language.
  if (!hasLocale(routing.locales, locale)) notFound();

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Anything next-intl formats uses India time. Still show dates with
    // formatDate/formatTime and pass strings to t() (see CLAUDE.md).
    timeZone: GARAGE_TIME_ZONE,
  };
});
