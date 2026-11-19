import { describe, expect, test } from "vitest";

import { adminNavFor, adminNavItems } from "./admin-navigation";

// Which staff sections each role sees in the staff bar (task 26). The rule
// comes from the permission table (src/domain/permissions.ts), never from
// comparing roles here.
describe("adminNavFor", () => {
  test.each(["owner", "manager"] as const)("a %s: Bookings (the inbox comes with task 51)", (role) => {
    expect(adminNavFor(role).map((item) => item.href)).toEqual(["/admin/bookings"]);
  });

  test("a mechanic: nothing yet (their jobs come with task 31)", () => {
    expect(adminNavFor("mechanic")).toEqual([]);
  });

  test("a customer: nothing", () => {
    expect(adminNavFor("customer")).toEqual([]);
  });
});

describe("adminNavItems", () => {

  test("no item points at /admin itself: the Wordmark does, and NavLinks would mark it current on every page", () => {
    expect(adminNavItems.map((item) => item.href)).not.toContain("/admin");
  });
});
