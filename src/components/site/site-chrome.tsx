import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { garage } from "@/content/garage";
import { currentOffer } from "@/content/offer";
import { whatsappHref } from "@/lib/contact-links";

import { ActionBar } from "./action-bar";
import { bookTarget, liveNavItems } from "./navigation";
import { OfferBanner } from "./offer-banner";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/**
 * The frame around every public page: a "skip to main content" link, the
 * header, the offer banner, the page itself in <main>, the footer and, on
 * phones, the action bar.
 *
 * The one place that reads the garage's data (src/content/) and the list of
 * live pages (navigation.ts). Everything below it gets them as props, so
 * task 14 only swaps these reads for the database.
 * Used by src/app/[locale]/(site)/layout.tsx.
 */
export function SiteChrome({ children }: { children: ReactNode }) {
  const t = useTranslations("Common");
  const tContact = useTranslations("Contact");

  const items = liveNavItems();
  const book = bookTarget(whatsappHref(garage.whatsapp, tContact("bookingMessage")));

  return (
    <>
      {/* The first thing Tab reaches: keyboard and screen-reader users can
          jump past the header straight to the page. Hidden until focused,
          then shown above the header (z-45; the menu's panel is z-50). */}
      <a
        href="#main"
        className="fixed top-2 left-(--gutter) z-45 inline-flex min-h-11 items-center rounded-full bg-background px-5 type-callout font-medium shadow-md not-focus:sr-only"
      >
        {t("skipToContent")}
      </a>

      <SiteHeader items={items} book={book} garage={garage} />
      {/* Under the header, so it scrolls away while the header stays. Nothing today. */}
      <OfferBanner offer={currentOffer} />

      {/* tabIndex -1: the skip link can move focus here, but Tab skips it. */}
      <main id="main" tabIndex={-1}>
        {children}
      </main>

      <SiteFooter items={items} garage={garage} />
      <ActionBar book={book} garage={garage} />
      {/* Below 768px: empty space the height of the fixed action bar, so the
          bar never covers the end of the footer. */}
      <div aria-hidden="true" className="h-(--action-bar-height) md:hidden" />
    </>
  );
}
