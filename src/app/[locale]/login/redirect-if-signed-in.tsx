import type { Locale } from "@/i18n/config";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/server/auth/session";

/**
 * Sends a visitor who is already logged in to /account. It draws nothing.
 *
 * It reads the session cookie, so it must sit inside <Suspense>: the rest of
 * /login is still built ahead of time, and only this part waits for the
 * request. The catch: by the time it runs the page has started streaming,
 * so the redirect happens in the browser (status 200, not 307). Task 16's
 * proxy check gives a real redirect.
 */
export async function RedirectIfSignedIn({ locale }: { locale: Locale }) {
  const user = await getCurrentUser();
  if (user) redirect({ href: "/account", locale });
  return null;
}
