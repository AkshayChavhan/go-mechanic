// Staff as other staff see them (task 27): the mechanics a booking can be
// given to.
//
// The rules of this folder are in garage.ts. A mechanic isn't a stored role
// compared in code: it's whoever may update jobs ("jobs.update") but may not
// manage bookings ("bookings.manage"), worked out from each user's effective
// role (effectiveRole: the owner's number is the owner whatever is stored).
// The stored role only narrows the query; the rule is applied to each row.

import "server-only";

import { asc, inArray } from "drizzle-orm";

import { can } from "@/domain/permissions";
import { effectiveRole, type Role, ROLES } from "@/domain/roles";
import { authorize } from "@/server/auth/access";
import { getDatabase } from "@/server/db";
import { users } from "@/server/db/schema";
import { serverEnv } from "@/server/env";

/** Whether a user with this stored role and number is a mechanic, by the permission table. */
export function isMechanic(storedRole: Role, phoneNumber: string): boolean {
  const role = effectiveRole(storedRole, phoneNumber, serverEnv().ownerPhoneNumber);
  return can(role, "jobs.update") && !can(role, "bookings.manage");
}

/**
 * The stored roles a mechanic can have: a pre-filter for the query only.
 * effectiveRole never turns a stored role into one with more access than
 * itself except on the owner's number, which isMechanic then refuses.
 */
function storedRolesThatMayBeMechanics(): Role[] {
  return ROLES.filter((role) => can(role, "jobs.update") && !can(role, "bookings.manage"));
}

export type Mechanic = {
  id: string;
  /** Empty until task 29 asks staff for a name: the board says "Mechanic without a name". */
  name: string;
};

/**
 * Every mechanic, by name, for staff with "bookings.manage" (manager, owner):
 * the board's "Assign mechanic" list. Names only, never a phone number. Live,
 * never cached: a role changes with task 29's team screen.
 */
export async function listMechanics(): Promise<Mechanic[]> {
  await authorize("bookings.manage");
  const db = await getDatabase();
  const rows = await db
    .select({ id: users.id, name: users.name, role: users.role, phoneNumber: users.phoneNumber })
    .from(users)
    .where(inArray(users.role, storedRolesThatMayBeMechanics()))
    .orderBy(asc(users.name), asc(users.id));
  return rows.filter((row) => isMechanic(row.role, row.phoneNumber)).map(({ id, name }) => ({ id, name }));
}
