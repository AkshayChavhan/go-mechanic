import { describe, expect, test } from "vitest";

import messages from "../../../messages/en.json";

import { adminNavFor, adminNavItems } from "./admin-navigation";

// Which staff sections each role sees in the staff bar (task 26). The rule
// comes from the permission table (src/domain/permissions.ts), never from
// comparing roles here.
describe("adminNavFor", () => {
  test.each(["owner", "manager"] as const)("a %s: Bookings, then Estimate requests", (role) => {
    expect(adminNavFor(role).map((item) => item.href)).toEqual(["/admin/bookings", "/admin/estimates"]);
  });

  test("a mechanic: nothing yet (their jobs come with task 31)", () => {
    expect(adminNavFor("mechanic")).toEqual([]);
  });

  test("a customer: nothing", () => {
    expect(adminNavFor("customer")).toEqual([]);
  });
});

describe("adminNavItems", () => {
  test("every label is in the Admin.nav messages", () => {
    for (const item of adminNavItems) {
      expect(messages.Admin.nav[item.labelKey]).toEqual(expect.any(String));
    }
  });

  test("no item points at /admin itself: the Wordmark does, and NavLinks would mark it current on every page", () => {
    expect(adminNavItems.map((item) => item.href)).not.toContain("/admin");
  });
});
