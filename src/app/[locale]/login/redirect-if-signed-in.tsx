import type { Locale } from "@/i18n/config";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/server/auth/session";

/**
 * Sends a visitor who is already logged in to /account. It draws nothing.
 *
 * It reads the session cookie, so it must sit inside <Suspense>: the rest of
 * /login is still built ahead of time, and only this part waits for the
 * request. Most logged-in visitors never get here: the proxy answers with a
 * real 307 to /account when a session cookie is present
 * (src/lib/access-routes.ts). This check remains for in-app navigation and
 * for /login?session=ended, which the proxy lets through; by then the page
 * has started streaming, so this redirect happens in the browser.
 */
export async function RedirectIfSignedIn({ locale }: { locale: Locale }) {
  const user = await getCurrentUser();
  if (user) redirect({ href: "/account", locale });
  return null;
}
