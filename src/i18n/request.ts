import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound, unstable_rethrow } from "next/navigation";
import { locale as rootLocale } from "next/root-params";

import { GARAGE_TIME_ZONE } from "./config";
import { routing } from "./routing";

/**
 * The language in the URL's [locale] segment, or undefined when the page has
 * none. Pages get it through next/root-params, which keeps them static under
 * Cache Components (the older header-based way would make them dynamic).
 *
 * The global 404 (src/app/global-not-found.tsx, for URLs that match no route)
 * sits outside [locale], so there's no such segment. A production render then
 * returns nothing, and `next dev` rejects the promise instead. Both mean "no
 * language in the URL", so the caller falls back to the default language.
 */
async function localeFromUrl(): Promise<string | undefined> {
  try {
    return await rootLocale();
  } catch (error) {
    // Next.js uses thrown errors for its own signals (notFound(), a page
    // pausing until request data arrives...). Pass those on; only a missing
    // locale is handled here.
    unstable_rethrow(error);
    return undefined;
  }
}

// Tells next-intl, for each request, which language to use and where its text is.
export default getRequestConfig(async ({ locale: explicitLocale }) => {
  // Code outside the [locale] pages (later Server Actions and Route Handlers)
  // passes the locale itself. Pages read it from the URL. The global 404 has
  // neither and gets the default language.
  const locale = explicitLocale ?? (await localeFromUrl()) ?? routing.defaultLocale;

  // "[locale]" matches anything, e.g. "/foo.png" -> locale "foo.png". Unknown
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
