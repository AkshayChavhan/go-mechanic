// Who someone is at the garage. Everyone who logs in starts as a customer.
// What each role may do is in permissions.ts. The owner is whoever logs in
// with the owner's number (the OWNER_PHONE_NUMBER setting, src/server/env.ts).

/** Every role, from the least to the most access. */
export const ROLES = ["customer", "mechanic", "manager", "owner"] as const;

export type Role = (typeof ROLES)[number];

/**
 * The role a user really has, from the role stored for them and the owner's
 * number (both E.164):
 * - the owner's number is the owner, whatever is stored;
 * - a stored owner on any other number is a customer: the owner's number
 *   has moved (a lost SIM, a new phone), and the old number keeps no access;
 * - any other stored role (customer, mechanic, manager) stands.
 * Worked out on every session read, so a change of the setting applies on
 * the next request, even to a login that is already open.
 */
export function effectiveRole(storedRole: Role, phoneNumber: string, ownerPhoneNumber: string): Role {
  if (phoneNumber === ownerPhoneNumber) return "owner";
  if (storedRole === "owner") return "customer";
  return storedRole;
}
