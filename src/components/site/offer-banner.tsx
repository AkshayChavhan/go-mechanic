import { useLocale, useTranslations } from "next-intl";

import type { Offer } from "@/content/offer";
import { Link } from "@/i18n/navigation";
import { localize } from "@/i18n/localized-text";

import { isLivePage, sitePages, type SitePage } from "./navigation";

type OfferBannerProps = {
  /** The current offer (src/content/offer.ts), or null for none. */
  offer: Offer | null;
  /** The pages and whether they exist. Defaults to the real list in navigation.ts; tests pass their own. */
  pages?: readonly SitePage[];
};

/**
 * A thin grey band under the header with the current offer: one line of
 * text, and a link to its details when that page exists. With no offer it
 * renders nothing at all, so the page has no empty band.
 *
 * It scrolls away with the page; only the header stays.
 */
export function OfferBanner({ offer, pages = sitePages }: OfferBannerProps) {
  const t = useTranslations("Offer");
  const locale = useLocale();
  if (!offer) return null;

  // The details link, only when its page exists.
  const detailsHref = offer.href && isLivePage(offer.href, pages) ? offer.href : null;

  return (
    // <aside>: content next to the page's own, which screen readers can jump to by its name.
    <aside aria-label={t("label")} className="surface-grey bg-background text-foreground">
      <p className="mx-auto box-content flex max-w-wide flex-wrap items-center justify-center gap-x-3 px-(--gutter) py-3 text-center type-callout">
        <span>{localize(offer.text, locale)}</span>
        {detailsHref && (
          <Link
            href={detailsHref}
            className="text-link underline-offset-4 hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
          >
            {t("more")}
          </Link>
        )}
      </p>
    </aside>
  );
}
