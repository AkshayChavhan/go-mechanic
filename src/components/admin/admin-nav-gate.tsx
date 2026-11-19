import { getTranslations } from "next-intl/server";

import { NavLinks } from "@/components/site/nav-links";
import type { Locale } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";

import { adminNavFor } from "./admin-navigation";

/**
 * The staff bar's section links (task 26): only the sections this person may
 * open (adminNavFor, from the permission table). Nobody logged in, or a role
 * with no section (a customer, a mechanic until task 31): nothing at all,
 * not even the <nav>, whose name is a staff word too.
 *
 * It reads the session, so the admin layout puts it inside <Suspense>. It
 * never redirects or shows the 404: that's each page's own gate
 * (requirePermission). getCurrentUser() is cached per request, so this and
 * the page's gate share one session read.
 */
export async function AdminNavGate({ locale }: { locale: Locale }) {
  const user = await getCurrentUser();
  const items = user ? adminNavFor(user.role) : [];
  if (items.length === 0) return null;

  const t = await getTranslations({ locale, namespace: "Admin" });
  return (
    <nav aria-label={t("nav.label")}>
      <NavLinks
        items={items.map((item) => ({ href: item.href, label: t(`nav.${item.labelKey}`) }))}
        // -mx-2: the first link's text lines up with the Wordmark on phones.
        listClassName="-mx-2 flex items-center gap-1"
        linkClassName="inline-flex min-h-11 items-center px-2 lg:px-3 type-callout text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
      />
    </nav>
  );
}
