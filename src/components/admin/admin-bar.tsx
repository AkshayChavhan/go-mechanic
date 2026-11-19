import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Wordmark } from "@/components/site/wordmark";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { Link } from "@/i18n/navigation";
import { logOut } from "@/server/actions/login";

type AdminBarProps = {
  locale: Locale;
  /**
   * The staff navigation: the layout passes AdminNavGate inside <Suspense>.
   * It goes in a slot of fixed height, so nothing moves when it streams in.
   */
  nav: ReactNode;
};

/**
 * The bar at the top of every staff page (task 26): the Wordmark (a link to
 * /admin), the sections this person may open, "Back to site" and Log out.
 *
 * Only the brand, "Back to site" and "Log out" are in the part built ahead
 * of time, which a customer or a logged-out visitor can receive too. The
 * section links come from `nav`, rendered after the session is read.
 *
 * Phones get two rows: the Wordmark and the two buttons, then the section
 * links. From 768px it's one row, the links after the Wordmark. One grid, so
 * the links are in the HTML once and keep their place in the Tab order
 * (Wordmark, sections, Back to site, Log out) at every width.
 */
export function AdminBar({ locale, nav }: AdminBarProps) {
  const t = useTranslations("Admin");
  const tAccount = useTranslations("Account");

  return (
    <header className="border-b border-border">
      <div className="mx-auto box-content grid max-w-wide grid-cols-[1fr_auto] items-center gap-x-6 px-(--gutter) md:grid-cols-[auto_1fr_auto]">
        <Link href="/admin" className="col-start-1 row-start-1 inline-flex h-(--header-height) items-center justify-self-start">
          <Wordmark className="type-lead" />
        </Link>

        {/* h-12 on phones, the header's height from 768px: the same height
            whether the links have arrived or not. */}
        <div className="col-span-full row-start-2 flex h-12 items-center md:col-span-1 md:col-start-2 md:row-start-1 md:h-(--header-height)">
          {nav}
        </div>

        <div className="col-start-2 row-start-1 flex items-center gap-2 md:col-start-3">
          {/* Below 640px a 44px arrow, the words kept for screen readers, as
              the site header's Account link does: the row is too narrow
              for the Wordmark and both labels. */}
          <Button asChild variant="ghost" size="sm" className="max-sm:size-11 max-sm:px-0">
            <Link href="/">
              <ArrowLeftIcon aria-hidden className="size-5 sm:hidden" />
              <span className="sr-only sm:not-sr-only">{t("backToSite")}</span>
            </Link>
          </Button>
          {/* A plain form posting to the logOut Server Action: it works
              before (or without) JavaScript, like /account's. Not blue: a
              staff page's blue button belongs to its main action. */}
          <form action={logOut.bind(null, locale)}>
            <Button type="submit" variant="secondary" size="sm">
              {tAccount("logOut")}
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
