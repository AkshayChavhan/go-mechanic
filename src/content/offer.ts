// The offer shown in a thin band under the header on every public page, or
// null for none. There's no offer today (owner, 2026-10-26).
//
// Like garage.ts, only SiteChrome reads this file; OfferBanner gets the offer
// as a prop. Task 38 moves offers into the admin, with start and end dates.

import type { LocalizedText } from "@/i18n/localized-text";

export type Offer = {
  /** One short line, in every language the site has: "10% off every car service until Diwali". */
  text: LocalizedText;
  /**
   * A page on this site with the details ("/packages"). Optional. The banner
   * links to it only once that page is live (navigation.ts), so an offer can
   * never point at a missing page.
   */
  href?: string;
};

export const currentOffer: Offer | null = null;
