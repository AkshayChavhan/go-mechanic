import { describe, expect, test } from "vitest";

import { can, PERMISSIONS, type Permission } from "./permissions";
import { ROLES, type Role } from "./roles";

// The whole table, written out by hand. Changing who may do what means
// changing src/domain/permissions.ts and this copy together: the test fails
// until both agree, so no permission changes by accident.
const EXPECTED: Record<Permission, readonly Role[]> = {
  "admin.open": ["mechanic", "manager", "owner"],
  "bookings.manage": ["manager", "owner"],
  "jobs.update": ["mechanic", "manager", "owner"],
  "customers.contact": ["manager", "owner"],
  "estimates.manage": ["manager", "owner"],
  "garage.edit": ["manager", "owner"],
  "content.edit": ["manager", "owner"],
  "team.manage": ["owner"],
  "reports.view": ["manager", "owner"],
};

describe("can (who may do what)", () => {
  test("the table is exactly the agreed one, role by role", () => {
    expect([...PERMISSIONS].sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const permission of PERMISSIONS) {
      for (const role of ROLES) {
        expect(can(role, permission), `${role} ${permission}`).toBe(EXPECTED[permission].includes(role));
      }
    }
  });

  test("the owner may do everything, a customer nothing", () => {
    for (const permission of PERMISSIONS) {
      expect(can("owner", permission)).toBe(true);
      expect(can("customer", permission)).toBe(false);
    }
  });

  test("a mechanic opens the admin and updates jobs, but never sees how to contact customers", () => {
    expect(can("mechanic", "admin.open")).toBe(true);
    expect(can("mechanic", "jobs.update")).toBe(true);
    expect(can("mechanic", "customers.contact")).toBe(false);
  });

  test("only the owner manages the team and its roles", () => {
    expect(ROLES.filter((role) => can(role, "team.manage"))).toEqual(["owner"]);
  });

  test("an unknown permission doesn't compile", () => {
    // @ts-expect-error: "garage.delete" isn't a permission.
    expect(can("owner", "garage.delete")).toBe(false);
  });
});
