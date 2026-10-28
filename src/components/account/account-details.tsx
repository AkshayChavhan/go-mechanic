import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/config";
import { redirect } from "@/i18n/navigation";
import { formatPhoneNumber } from "@/lib/contact-links";
import { getCurrentUser } from "@/server/auth/session";

/**
 * The account's details on /account: "Logged in as +91 98765 43210", or a
 * redirect to /login when nobody is logged in.
 *
 * An async Server Component that reads the session cookie, so /account puts
 * it inside <Suspense>: the rest of the page is built ahead of time. Once the
 * page has started streaming, the redirect happens in the browser (status
 * 200); task 16's proxy check adds a real 307.
 *
 * Its paragraph uses the same classes as the page's loading line
 * (detailsClass), so nothing moves when it replaces it.
 */
export async function AccountDetails({ locale }: { locale: Locale }) {
  const user = await getCurrentUser();
  // `return`: TypeScript then knows `user` is set below (redirect() throws).
  if (!user) return redirect({ href: "/login", locale });
  const t = await getTranslations({ locale, namespace: "Account" });
  return <p className={detailsClass}>{t("signedInAs", { number: formatPhoneNumber(user.phoneNumber) })}</p>;
}

/** One line of lead text: the details, and the loading line in their place. */
export const detailsClass = "type-lead text-muted-foreground";
