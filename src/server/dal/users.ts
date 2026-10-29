// The users table, for what Better Auth doesn't do itself.

import "server-only";

import { eq } from "drizzle-orm";

import { effectiveRole } from "@/domain/roles";
import { getDatabase } from "@/server/db";
import { users } from "@/server/db/schema";

/**
 * Brings a user's stored role in line with the owner rule (effectiveRole),
 * right after a correct login code: the owner's number becomes "owner", and
 * a stored "owner" on any other number becomes "customer". Every other role
 * is left alone. An unknown user changes nothing.
 *
 * The session read applies the same rule on every request (getCurrentUser),
 * so access never depends on this. The stored role is only a hint: it goes
 * stale for anyone who doesn't log in again, so code that reads another
 * user's role (the team list, reports: tasks 29, 41) passes it through
 * effectiveRole and never filters on role = 'owner' in SQL. Called by the
 * login service during a login, before a session exists, so it can't (and
 * needn't) call authorize(): nothing in it comes from a browser.
 */
export async function syncOwnerRole(userId: string, phoneNumber: string, ownerPhoneNumber: string): Promise<void> {
  const db = await getDatabase();
  const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!row) return;
  const role = effectiveRole(row.role, phoneNumber, ownerPhoneNumber);
  if (role !== row.role) await db.update(users).set({ role }).where(eq(users.id, userId));
}
