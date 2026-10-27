import { CalendarCheckIcon, PhoneIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { Garage } from "@/content/garage";
import { Link } from "@/i18n/navigation";
import { telHref, whatsappHref } from "@/lib/contact-links";
import { cn } from "@/lib/utils";

import type { BookTarget } from "./navigation";
import { WhatsAppLink } from "./whatsapp-link";

// Each link shows its icon above its label, like a phone's tab bar, and
// fills a third of the bar. Why stacked: at 320px a third is 88px wide.
// "WhatsApp" at the small button's 15px is 75px wide in Inter, so it fits
// under its icon but not beside it.
// Layout classes only. cn() inside Button lets them replace the small
// button's own height (h-9, and h-11 on touch screens) and side padding.
// The colours, text size and focus ring stay the button's. The height is a
// token from globals.css, because the bar's total height is added up there.
const stacked =
  "h-(--action-bar-item-height) w-full flex-col gap-0.5 px-1 py-1.5 pointer-coarse:h-(--action-bar-item-height) has-data-[icon=inline-start]:px-1";

type ActionBarProps = {
  /** Where "Book" goes (bookTarget() in navigation.ts). */
  book: BookTarget;
  /** The garage's numbers. */
  garage: Pick<Garage, "phone" | "whatsapp">;
  /**
   * Extra layout classes. /dev/design passes "static md:block" to show the
   * bar in place, in a phone-sized frame, instead of fixed and phone-only.
   */
  className?: string;
};

/**
 * The bar fixed to the bottom of the screen on phones (below 768px): Call,
 * WhatsApp and Book, always one tap away. Hidden from 768px up, where the
 * header has "Book a service" and the footer has the phone and WhatsApp.
 *
 * Solid, with a top border and a soft shadow: it floats over the page. It
 * never moves or animates, so reduced motion needs nothing extra.
 * Its bottom padding grows to clear the iPhone's home indicator, and a spacer
 * after the footer (SiteChrome) keeps it from covering the end of the page.
 */
export function ActionBar({ book, garage, className }: ActionBarProps) {
  const t = useTranslations("ActionBar");
  const tContact = useTranslations("Contact");

  return (
    <nav
      aria-label={t("label")}
      className={cn("fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background shadow-md md:hidden", className)}
    >
      {/* The bar's parts are tokens in globals.css (--action-bar-*), added up
          there as --action-bar-height. The bottom padding grows on phones
          with a home indicator. */}
      <ul className="grid grid-cols-3 gap-2 px-(--gutter) pt-(--action-bar-padding-top) pb-(--action-bar-padding-bottom)">
        <li>
          <Button asChild variant="secondary" size="sm" className={stacked}>
            <a href={telHref(garage.phone)}>
              <PhoneIcon data-icon="inline-start" />
              {tContact("call")}
            </a>
          </Button>
        </li>
        <li>
          <Button asChild variant="secondary" size="sm" className={stacked}>
            <WhatsAppLink href={whatsappHref(garage.whatsapp, tContact("whatsappMessage"))}>
              {tContact("whatsapp")}
            </WhatsAppLink>
          </Button>
        </li>
        <li>
          {/* The one blue button in the bar. */}
          <Button asChild size="sm" className={stacked}>
            {book.kind === "page" ? (
              <Link href={book.href}>
                <CalendarCheckIcon data-icon="inline-start" />
                {t("book")}
              </Link>
            ) : (
              <WhatsAppLink href={book.href}>{t("book")}</WhatsAppLink>
            )}
          </Button>
        </li>
      </ul>
    </nav>
  );
}
