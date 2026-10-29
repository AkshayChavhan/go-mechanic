// The logged-in customer's own profile: their name and number (task 21).
//
// The rules of this folder are in garage.ts. Rule 3 here: each function
// calls authorizeUser() on its first line and reads or writes only the
// session user's row, never a user id from its caller.
//
// The name lives in Better Auth's users table, which leaves it empty at
// sign-up. It is saved with a plain Drizzle update, as syncOwnerRole does
// (users.ts), never through Better Auth's updateUser: that API is for
// Better Auth's own routes, which this site doesn't run. No session cookie
// cache is set (src/server/auth/auth.ts), so a saved name shows on the next
// read.

import "server-only";

import { eq } from "drizzle-orm";

import { checkName, type NameProblem } from "@/domain/profile";
import { type Clock, systemClock } from "@/lib/clock";
import { AccessDeniedError, authorizeUser } from "@/server/auth/access";
import { getDatabase } from "@/server/db";
import { users } from "@/server/db/schema";

export type MyProfile = {
  /** Empty until the customer gives it (needsName in src/domain/profile.ts). */
  name: string;
  /** E.164: "+919876543210". */
  phoneNumber: string;
};

/** The logged-in customer's name and number. Throws AccessDeniedError when nobody is logged in. */
export async function readMyProfile(): Promise<MyProfile> {
  const user = await authorizeUser();
  const db = await getDatabase();
  const [row] = await db
    .select({ name: users.name, phoneNumber: users.phoneNumber })
    .from(users)
    .where(eq(users.id, user.id));
  // A session always has its user (deleting a user deletes their sessions),
  // so this only happens if the row went between the two reads.
  if (!row) throw new AccessDeniedError("signedOut", null);
  return row;
}

/**
 * Saves the logged-in customer's name, trimmed and with runs of spaces
 * collapsed. A name that breaks the rules (checkName) is not saved.
 */
export async function saveMyName(
  typed: string,
  clock: Clock = systemClock,
): Promise<{ ok: true } | { ok: false; problem: NameProblem }> {
  const user = await authorizeUser();
  const checked = checkName(typed);
  if (!checked.ok) return checked;
  const db = await getDatabase();
  await db.update(users).set({ name: checked.name, updatedAt: clock.now() }).where(eq(users.id, user.id));
  return { ok: true };
}
