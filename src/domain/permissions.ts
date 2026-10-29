// What each role may do at the garage: one table, so every rule about "who
// may" lives in one place a reviewer can read at once.
//
// Pages, Server Actions and the data-access layer ask about a permission
// (can(role, "garage.edit")), never about a role (role === "owner"). Data a
// customer owns (their vehicles, their bookings) isn't a permission: the
// rule there is "logged in, and the row is yours", checked in the query.
//
// To change who may do what, change this table and the copy in
// permissions.test.ts together: the test fails until both agree.

import type { Role } from "./roles";

const TABLE = {
  /** Open the staff area (/admin, task 26). */
  "admin.open": ["mechanic", "manager", "owner"],
  /** Confirm, cancel, reschedule and assign bookings (tasks 26, 27). */
  "bookings.manage": ["manager", "owner"],
  /** Update a job's status, notes and photos. A mechanic only their assigned jobs: the query checks (task 31). */
  "jobs.update": ["mechanic", "manager", "owner"],
  /** See customers' phone numbers and contact them. Never mechanics (master plan) (tasks 26, 29, 31). */
  "customers.contact": ["manager", "owner"],
  /** Build and send estimates (task 33). */
  "estimates.manage": ["manager", "owner"],
  /** Change the garage's details, hours and schedule (saveGarage now; tasks 28, 40). */
  "garage.edit": ["manager", "owner"],
  /** Edit services, prices, offers, FAQ and other content (tasks 37 to 40). */
  "content.edit": ["manager", "owner"],
  /** Add staff and change their roles. The owner's alone (task 29). */
  "team.manage": ["owner"],
  /** See the reports (task 41). */
  "reports.view": ["manager", "owner"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof TABLE;

/** Every permission, in the table's order. */
export const PERMISSIONS = Object.keys(TABLE) as Permission[];

/** Whether `role` may do `permission`. */
export function can(role: Role, permission: Permission): boolean {
  return (TABLE[permission] as readonly Role[] | undefined)?.includes(role) ?? false;
}
