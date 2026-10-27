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
 * sits outside [locale], so there's no such segment: Next.js returns nothing,
 * and the caller falls back to the default language.
 */
async function localeFromUrl(): Promise<string | undefined> {
  try {
    return await rootLocale();
  } catch (error) {
    // Next.js uses thrown errors for its own signals (notFound(), a page
    // pausing until request data arrives...). Pass those on first.
    unstable_rethrow(error);
    // `next dev` can also reject instead of returning nothing: when a segment
    // opts into instant validation and its samples have no locale. Next.js
    // marks that error with this digest and recognises it by the digest
    // itself (isInstantValidationError), so it's the most reliable sign.
    // It means the instant-validation sample has no locale (as in the global
    // 404). Next.js records this error itself before throwing, so the developer
    // still sees it.
    if ((error as { digest?: unknown }).digest === "INSTANT_VALIDATION_ERROR") return undefined;
    // Anything else is a real mistake, such as next/root-params used inside a
    // Server Action or Route Handler (they must pass the locale themselves).
    // Falling back to English would hide it, so it goes to the developer.
    throw error;
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
