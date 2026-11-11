"use client";

import { Suspense } from "react";

import { Link, usePathname } from "@/i18n/navigation";

/** One menu link, its label already in the page's language. */
export type NavLinkItem = { href: string; label: string };

type NavLinksProps = {
  items: readonly NavLinkItem[];
  /** The list's classes: the header's row or the phone menu's column. */
  listClassName: string;
  /** Each link's classes. Style the current page with aria-[current=page]: classes. */
  linkClassName: string;
};

/** Whether `pathname` is the page `href` or a page under it: /services/brakes is under /services. */
export function isCurrentPage(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Links({ items, listClassName, linkClassName, pathname }: NavLinksProps & { pathname: string | null }) {
  return (
    <ul className={listClassName}>
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            aria-current={pathname !== null && isCurrentPage(pathname, item.href) ? "page" : undefined}
            className={linkClassName}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CurrentLinks(props: NavLinksProps) {
  return <Links {...props} pathname={usePathname()} />;
}

/**
 * The menu's links, with the current page marked (aria-current="page"), so
 * screen readers say which page this is and the link can look current too.
 *
 * A client island because only the browser knows the address for sure:
 * usePathname() suspends while a page is built ahead of time (Cache
 * Components), so the same links without the mark are the <Suspense>
 * fallback, and the mark appears once the page has loaded. The labels come
 * in as props: it reads no messages. It must never import the phone menu's
 * sheet (ui/sheet): the header loads it on every page.
 */
export function NavLinks(props: NavLinksProps) {
  return (
    <Suspense fallback={<Links {...props} pathname={null} />}>
      <CurrentLinks {...props} />
    </Suspense>
  );
}
