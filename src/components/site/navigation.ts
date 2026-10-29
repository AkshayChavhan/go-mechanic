// The pages the shell links to, and whether each one exists yet.
//
// The header, phone menu and footer show only live items, so no link ever
// leads to a missing page. A page task switches its item's `live` to true in
// the same commit that adds the page. navigation.test.ts checks every flag
// against the real page.tsx files, so forgetting either half fails the tests.

import type { Messages } from "next-intl";

/** A label from the Nav messages in messages/en.json. */
export type NavLabel = keyof Messages["Nav"];

/** A page the shell can link to. */
export type SitePage = {
  /** The page's path, without the language: "/services". */
  href: string;
  /** Whether the page exists yet (its page.tsx is in src/app/[locale]/). */
  live: boolean;
};

export type NavItem = SitePage & { label: NavLabel };

/** The main menu, in the order it shows. */
export const navItems: readonly NavItem[] = [
  { label: "services", href: "/services", live: false }, // task 18
  { label: "prices", href: "/packages", live: false }, // task 18
  { label: "about", href: "/about", live: true }, // task 19
  { label: "contact", href: "/contact", live: true }, // task 19
];

/**
 * Pages the footer links to after the menu items, and nowhere else (task 19):
 * the header, the phone menu and the action bar show only `navItems`.
 */
export const footerItems: readonly NavItem[] = [
  { label: "faq", href: "/faq", live: true },
  { label: "privacy", href: "/privacy", live: true },
  { label: "terms", href: "/terms", live: true },
];

/** The booking page (task 23). Not in the menu: "Book a service" is the header's own button. */
export const bookPage: SitePage = { href: "/book", live: false };

/** Every page the shell can link to: the menu items, the footer's own items and the booking page. */
export const sitePages: readonly SitePage[] = [...navItems, ...footerItems, bookPage];

/**
 * Whether `href` is a page that exists: one of `pages` with `live: true`.
 * A link to anything else (a page not in this file, or not built yet) should
 * be left out, as the offer banner does.
 */
export function isLivePage(href: string, pages: readonly SitePage[] = sitePages): boolean {
  return pages.some((page) => page.href === href && page.live);
}

/** The items whose page exists, in menu order. */
export function liveNavItems(items: readonly NavItem[] = navItems): NavItem[] {
  return items.filter((item) => item.live);
}

/** The footer-only items whose page exists, in order. */
export function liveFooterItems(items: readonly NavItem[] = footerItems): NavItem[] {
  return items.filter((item) => item.live);
}

/** Where a "Book" button goes: a page on the site, or a WhatsApp chat. */
export type BookTarget = { kind: "page"; href: string } | { kind: "whatsapp"; href: string };

/**
 * Where "Book a service" goes: the booking page once it's live. Until then,
 * a WhatsApp chat that opens with the booking message already typed in.
 */
export function bookTarget(whatsappBookingHref: string, page: SitePage = bookPage): BookTarget {
  return page.live ? { kind: "page", href: page.href } : { kind: "whatsapp", href: whatsappBookingHref };
}
