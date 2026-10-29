import { PhoneIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type { Garage } from "@/domain/garage";
import { formatAddress } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { formatPhoneNumber, telHref, whatsappHref } from "@/lib/contact-links";
import { cn } from "@/lib/utils";

import type { NavItem } from "./navigation";
import { OpenStatus } from "./open-status";
import { OpeningHoursList } from "./opening-hours-list";
import { Section } from "./section";
import { WhatsAppLink } from "./whatsapp-link";
import { Wordmark } from "./wordmark";

// Text links in the footer: 44px tall on touch screens, so a thumb hits them
// easily, and icons at the size of the text.
const textLink = "inline-flex items-center gap-2 pointer-coarse:min-h-11 [&_svg]:size-4";
const contactLink = cn(textLink, "text-link underline-offset-4 hover:underline");
const pageLink = cn(textLink, "text-muted-foreground transition-colors hover:text-foreground");

type SiteFooterProps = {
  /** The live menu pages to link to (liveNavItems() in navigation.ts). */
  items: readonly NavItem[];
  /** The live footer-only pages, listed after the menu pages (liveFooterItems()): FAQ, privacy, terms. */
  moreItems?: readonly NavItem[];
  /** The garage's details. */
  garage: Garage;
};

/**
 * The end of every public page, on a grey band: who the garage is, where it
 * is and how to reach it, its weekly hours with the live open status, and
 * links to the live pages once there are any.
 *
 * A server component that takes everything as props. No copyright year:
 * reading today's date would stop the pages from being built ahead of time.
 */
export function SiteFooter({ items, moreItems = [], garage }: SiteFooterProps) {
  const tHours = useTranslations("Hours");
  const tContact = useTranslations("Contact");
  const tFooter = useTranslations("Footer");
  const tNav = useTranslations("Nav");
  const locale = useLocale();
  const pages = [...items, ...moreItems];

  return (
    <footer>
      <Section tone="grey" width="wide">
        <div className={cn("grid gap-10 md:grid-cols-2", pages.length > 0 && "lg:grid-cols-3")}>
          {/* <address>: the contact details of whoever runs the site. */}
          <address className="flex flex-col gap-3 not-italic">
            <Wordmark className="type-callout" />
            <p className="type-callout">{formatAddress(garage.address, locale)}</p>
            <ul className="flex flex-col type-callout">
              <li>
                <a href={telHref(garage.phone)} className={contactLink}>
                  <PhoneIcon />
                  {/* Screen readers hear "Call +91 97647 50567". */}
                  <span className="sr-only">{tContact("call")}</span> {formatPhoneNumber(garage.phone)}
                </a>
              </li>
              <li>
                <WhatsAppLink
                  href={whatsappHref(garage.whatsapp, tContact("whatsappMessage"))}
                  className={contactLink}
                >
                  {tContact("whatsapp")}
                </WhatsAppLink>
              </li>
            </ul>
          </address>

          <div className="flex flex-col gap-3">
            <h2 className="type-callout font-semibold">{tHours("title")}</h2>
            <OpenStatus hours={garage.hours} />
            <OpeningHoursList hours={garage.hours} />
          </div>

          {pages.length > 0 && (
            <nav aria-label={tFooter("pages")} className="flex flex-col gap-3">
              <h2 className="type-callout font-semibold">{tFooter("pages")}</h2>
              <ul className="flex flex-col type-callout">
                {pages.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={pageLink}>
                      {tNav(item.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </Section>
    </footer>
  );
}
