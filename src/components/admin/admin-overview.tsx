import { ChevronRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/config";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/server/auth/access";

import { adminNavFor, type AdminNavLabel } from "./admin-navigation";

/** Each section's line on its card, from the Admin.overview messages. */
const descriptionKey = {
  bookings: "bookingsDescription",
  estimates: "estimatesDescription",
} as const satisfies Record<AdminNavLabel, string>;

/**
 * The staff area's front page, /admin (task 26): a card for each section
 * this person may open. A role with none (a mechanic, until task 31) gets a
 * note instead. It never redirects to a section: inside <Suspense> that
 * would happen in the browser, after the page has answered.
 *
 * The page's gate: it checks the login and admin.open first, so a
 * logged-out visitor goes to /login and a customer gets the 404 page.
 * Everything it shows renders after that check, so the page built ahead of
 * time holds none of it. It reads the session: the page puts it inside
 * <Suspense>.
 */
export async function AdminOverview({ locale }: { locale: Locale }) {
  const user = await requirePermission(locale, "admin.open");
  const t = await getTranslations({ locale, namespace: "Admin" });
  const items = adminNavFor(user.role);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <h1 className="type-headline text-balance">{t("overview.heading")}</h1>
        {items.length > 0 && <p className="type-lead text-pretty text-muted-foreground">{t("overview.intro")}</p>}
      </div>
      {items.length === 0 ? (
        <p className="max-w-2xl type-body text-pretty">{t("overview.mechanicNote")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.href}>
              {/* The whole tile is the link: a big target for a thumb. */}
              <Link
                href={item.href}
                className="group flex h-full items-start justify-between gap-4 rounded-xl bg-card p-6 transition-colors hover:bg-accent"
              >
                {/* A div, not a span: a heading can't sit inside a span. */}
                <div className="flex flex-col gap-2">
                  <h2 className="type-title">{t(`nav.${item.labelKey}`)}</h2>
                  <p className="type-callout text-pretty text-muted-foreground">
                    {t(`overview.${descriptionKey[item.labelKey]}`)}
                  </p>
                </div>
                <ChevronRightIcon
                  aria-hidden
                  className="mt-2 size-6 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
