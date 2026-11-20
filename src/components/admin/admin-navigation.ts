// The staff area's sections (task 26), and who may open each one.
//
// Like navigation.ts for the public menu, but each item names the
// permission its page checks, so the staff bar shows only the sections a
// role can really open. A page always checks its own permission too
// (requirePermission): hiding a link is a courtesy, not the protection.
//
// No item for /admin itself: the Wordmark links there, and NavLinks marks a
// link current for every page under it, so an /admin item would look current
// on every staff page.

import type { Messages } from "next-intl";

import { can, type Permission } from "@/domain/permissions";
import type { Role } from "@/domain/roles";

/** A label from the Admin.nav messages, apart from the nav's own name. */
export type AdminNavLabel = Exclude<keyof Messages["Admin"]["nav"], "label">;

export type AdminNavItem = {
  /** The page's path, without the language: "/admin/bookings". */
  href: string;
  labelKey: AdminNavLabel;
  /** The permission the page checks. */
  permission: Permission;
};

/** Every staff section, in the order the bar shows them. */
export const adminNavItems: readonly AdminNavItem[] = [
  { href: "/admin/bookings", labelKey: "bookings", permission: "bookings.manage" },
  { href: "/admin/prices", labelKey: "prices", permission: "content.edit" },
  // Task 51 adds the estimate-request inbox here:
  // { href: "/admin/estimates", labelKey: "estimates", permission: "estimates.manage" }.
  // Its words are already in Admin.nav and Admin.overview.
];

/** The sections `role` may open, in order. Customers and (until task 31) mechanics get none. */
export function adminNavFor(role: Role, items: readonly AdminNavItem[] = adminNavItems): AdminNavItem[] {
  return items.filter((item) => can(role, item.permission));
}
