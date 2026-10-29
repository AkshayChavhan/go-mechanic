// Who is logged in, for pages. Reads the session cookie, so it makes a page
// dynamic: call it only inside a <Suspense> boundary, never in the site shell
// or the root layout (the home page must stay prebuilt: ensureStatic).

import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import { effectiveRole, type Role } from "@/domain/roles";
import { serverEnv } from "@/server/env";

import { withoutDetails } from "./errors";
import { getAuth } from "./instance";

export type CurrentUser = {
  id: string;
  phoneNumber: string;
  /** The role the user really has: the stored one, with the owner rule applied (effectiveRole). */
  role: Role;
};

/**
 * The logged-in user, or null. Only what pages need: no session token.
 * cache() makes every call during one request share one database read.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Outside withoutDetails: headers() pauses a prerender with Next.js's own
  // signal, which must reach Next.js as it is (withoutDetails passes those
  // on too, but nothing here needs hiding).
  const requestHeaders = await headers();
  // Before withoutDetails too: a wrong setting keeps its own message (it names
  // the setting, never a value) instead of becoming a LoginServiceError.
  const { ownerPhoneNumber } = serverEnv();
  // A database error's message holds the query's values (the session token).
  return withoutDetails("getCurrentUser", async () => {
    const auth = await getAuth();
    const session = await auth.api.getSession({
      headers: requestHeaders,
      // A page can't write cookies, so it must never extend a session (the
      // database and the cookie would disagree). Logins don't extend anyway
      // (disableSessionRefresh); this makes it certain for page reads.
      query: { disableRefresh: true },
    });
    // Every user has a number (users.phone_number is NOT NULL); Better Auth's
    // types just don't know it.
    if (!session?.user.phoneNumber) return null;
    const { id, phoneNumber, role } = session.user;
    // The owner rule on every read: once a changed OWNER_PHONE_NUMBER is live
    // (after a redeploy or restart), it applies even to an open login.
    return { id, phoneNumber, role: effectiveRole(role as Role, phoneNumber, ownerPhoneNumber) };
  });
});
