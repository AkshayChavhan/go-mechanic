// Who may see a page, run an action or save something: the checks every
// later task calls. They read the session (getCurrentUser) and ask the
// permission table (src/domain/permissions.ts); no code compares roles itself.
//
//   requireUser(locale)              pages and Server Actions: the logged-in
//                                    user, or a redirect to /login
//   requirePermission(locale, perm)  pages and Server Actions: also needs the
//                                    permission, or shows the 404 page
//   authorize(perm)                  the data-access layer, staff work: the
//                                    real check, first thing, before any
//                                    database work; throws AccessDeniedError
//   authorizeUser()                  the data-access layer, a customer's own
//                                    data: logged in is enough; the function
//                                    then filters by the user's id itself
//
// Why the data-access layer checks the session itself, instead of trusting
// its caller: no caller can hand it a made-up user, a forgotten check in a
// page can't open a save, and the check runs before a transaction opens. A
// session read is a database query, and PGlite has one connection: a query
// made while a transaction holds it would wait forever.

import "server-only";

import { notFound } from "next/navigation";

import { can, type Permission } from "@/domain/permissions";
import type { Locale } from "@/i18n/config";
import { redirect } from "@/i18n/navigation";
import { LOGIN_PATH, SESSION_ENDED } from "@/lib/access-routes";

import { type CurrentUser, getCurrentUser } from "./session";

/**
 * Thrown by authorize() and authorizeUser(). It names the reason and the
 * permission (none for authorizeUser), never a person.
 */
export class AccessDeniedError extends Error {
  readonly reason: "signedOut" | "notAllowed";
  readonly permission: Permission | null;

  constructor(reason: "signedOut" | "notAllowed", permission: Permission | null) {
    super(`Access denied (${reason}${permission ? `: ${permission}` : ""})`);
    this.name = "AccessDeniedError";
    this.reason = reason;
    this.permission = permission;
  }
}

/**
 * The logged-in user, for a page or a Server Action. Nobody logged in: a
 * redirect to /login?session=ended. The marker tells the proxy not to send
 * the visitor straight back here because of a leftover cookie
 * (src/lib/access-routes.ts).
 */
export async function requireUser(locale: Locale): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    return redirect({ href: { pathname: LOGIN_PATH, query: { [SESSION_ENDED.name]: SESSION_ENDED.value } }, locale });
  }
  return user;
}

/**
 * The logged-in user, who must have `permission`. Logged out: the redirect
 * to /login. Logged in without the permission: the site's 404 page, so a
 * staff page doesn't even admit it exists. (Next.js's forbidden() would say
 * 403, but it's still experimental in Next.js 16.4.3; task 26 revisits it.)
 */
export async function requirePermission(locale: Locale, permission: Permission): Promise<CurrentUser> {
  const user = await requireUser(locale);
  if (!can(user.role, permission)) notFound();
  return user;
}

/**
 * The real check for staff work, in the data-access layer: call it on the
 * first line, before checking the input, calling getDatabase() or opening a
 * transaction. Returns the user, or throws AccessDeniedError.
 */
export async function authorize(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AccessDeniedError("signedOut", permission);
  if (!can(user.role, permission)) throw new AccessDeniedError("notAllowed", permission);
  return user;
}

/**
 * The real check for a customer's own data (their vehicles, their bookings),
 * in the data-access layer: logged in is enough, since customers hold no
 * permission in the table. Call it on the first line, like authorize, then
 * filter the query by the returned user's id: never take a user id from the
 * caller. Throws AccessDeniedError (signedOut) when nobody is logged in.
 */
export async function authorizeUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AccessDeniedError("signedOut", null);
  return user;
}
