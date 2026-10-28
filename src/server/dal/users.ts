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
 * so this only keeps the table honest for the team list and reports (tasks
 * 29, 41). Called by the login service, not by a page, so it needs no
 * authorize(): it only applies the OWNER_PHONE_NUMBER setting.
 */
export async function syncOwnerRole(userId: string, phoneNumber: string, ownerPhoneNumber: string): Promise<void> {
  const db = await getDatabase();
  const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!row) return;
  const role = effectiveRole(row.role, phoneNumber, ownerPhoneNumber);
  if (role !== row.role) await db.update(users).set({ role }).where(eq(users.id, userId));
}
