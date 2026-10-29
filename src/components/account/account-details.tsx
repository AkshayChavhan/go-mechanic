import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/config";
import { formatPhoneNumber } from "@/lib/contact-links";
import { requireUser } from "@/server/auth/access";

/**
 * The account's details on /account: "Logged in as +91 98765 43210", or a
 * redirect to /login when nobody is logged in.
 *
 * An async Server Component that reads the session cookie, so /account puts
 * it inside <Suspense>: the rest of the page is built ahead of time. A
 * visitor with no session cookie never gets here: the proxy answers with a
 * real 307 to /login (src/lib/access-routes.ts). This check catches a
 * leftover cookie whose session has ended; by then the page has started
 * streaming, so its redirect (to /login?session=ended) happens in the browser.
 *
 * Its paragraph uses the same classes as the page's loading line
 * (detailsClass), so nothing moves when it replaces it.
 */
export async function AccountDetails({ locale }: { locale: Locale }) {
  const user = await requireUser(locale);
  const t = await getTranslations({ locale, namespace: "Account" });
  return <p className={detailsClass}>{t("signedInAs", { number: formatPhoneNumber(user.phoneNumber) })}</p>;
}

/** One line of lead text: the details, and the loading line in their place. */
export const detailsClass = "type-lead text-muted-foreground";
