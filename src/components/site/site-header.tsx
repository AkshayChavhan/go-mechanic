import { PhoneIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet";
import type { Garage } from "@/content/garage";
import { formatAddress } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { telHref, whatsappHref } from "@/lib/contact-links";

import { MobileMenu } from "./mobile-menu";
import type { BookTarget, NavItem } from "./navigation";
import { OpenStatus } from "./open-status";
import { OpeningHoursList } from "./opening-hours-list";
import { WhatsAppLink } from "./whatsapp-link";
import { Wordmark } from "./wordmark";

type SiteHeaderProps = {
  /** The live pages to link to (liveNavItems() in navigation.ts). Empty until task 18. */
  items: readonly NavItem[];
  /** Where "Book a service" goes (bookTarget() in navigation.ts). */
  book: BookTarget;
  /** The garage's details, for the phone menu. */
  garage: Garage;
};

/**
 * The bar at the top of every public page: the Wordmark (a link home), the
 * links to the live pages and "Book a service". On phones (below 768px) the
 * links and the button make way for the menu button.
 *
 * A server component that takes everything as props, so /dev/design can show
 * it with demo data, and task 14 only changes the code that reads the data.
 * Frosted: the page shows through it, blurred, as it scrolls underneath.
 */
export function SiteHeader({ items, book, garage }: SiteHeaderProps) {
  const t = useTranslations("Header");
  const tNav = useTranslations("Nav");
  const tCommon = useTranslations("Common");

  return (
    // z-40 keeps it above the page; the menu's panel (z-50) still covers it.
    <header className="frosted sticky top-0 z-40 border-b border-border">
      {/* --header-height and the page's scroll padding are set together in globals.css. */}
      <div className="mx-auto box-content flex h-(--header-height) max-w-wide items-center gap-6 px-(--gutter)">
        <Link href="/" className="inline-flex min-h-11 items-center">
          <Wordmark className="type-lead" />
        </Link>

        {items.length > 0 && (
          <nav aria-label={t("navLabel")} className="hidden md:block">
            <ul className="flex items-center gap-1">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-11 items-center px-3 type-callout text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {tNav(item.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Task 15: a login or account entry goes here, inside a <Suspense>
              slot or a client island. Never read cookies in this component:
              it would make every public page render on each visit. */}
          <div className="hidden md:block">
            <Button asChild size="sm">
              {book.kind === "page" ? (
                <Link href={book.href}>{t("book")}</Link>
              ) : (
                <WhatsAppLink href={book.href}>{t("book")}</WhatsAppLink>
              )}
            </Button>
          </div>
          <div className="md:hidden">
            <MobileMenu openLabel={t("openMenu")} title={t("menuTitle")} closeLabel={tCommon("close")}>
              <MobileMenuContent items={items} garage={garage} />
            </MobileMenu>
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * What the phone menu holds: the live pages, whether the garage is open, its
 * hours and address, and buttons to call or WhatsApp. Rendered on the server
 * and handed to the MobileMenu island as its children. Exported for the
 * /dev/design sample.
 */
export function MobileMenuContent({ items, garage }: Pick<SiteHeaderProps, "items" | "garage">) {
  const t = useTranslations("Header");
  const tNav = useTranslations("Nav");
  const tHours = useTranslations("Hours");
  const tContact = useTranslations("Contact");
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-8 px-4 pb-8">
      {items.length > 0 && (
        <nav aria-label={t("navLabel")}>
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.href}>
                {/* SheetClose: following the link closes the menu. */}
                <SheetClose asChild>
                  <Link href={item.href} className="flex min-h-11 items-center type-title">
                    {tNav(item.label)}
                  </Link>
                </SheetClose>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="type-callout font-semibold">{tHours("title")}</h3>
        <OpenStatus hours={garage.hours} />
        <OpeningHoursList hours={garage.hours} />
      </div>

      <address className="type-callout not-italic">{formatAddress(garage.address, locale)}</address>

      <div className="flex flex-col gap-2">
        <Button asChild variant="secondary">
          <a href={telHref(garage.phone)}>
            <PhoneIcon data-icon="inline-start" />
            {tContact("call")}
          </a>
        </Button>
        <Button asChild variant="secondary">
          <WhatsAppLink href={whatsappHref(garage.whatsapp, tContact("whatsappMessage"))}>
            {tContact("whatsapp")}
          </WhatsAppLink>
        </Button>
      </div>
    </div>
  );
}
