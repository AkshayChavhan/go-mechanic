import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Role } from "@/domain/roles";
import { renderWithIntl } from "@/i18n/test-utils";
import { getCurrentUser } from "@/server/auth/session";
import messages from "../../../messages/en.json";

import { AdminNavGate } from "./admin-nav-gate";

// AdminNavGate is an async Server Component that reads the session: each
// test calls it with a stand-in getCurrentUser and renders what it returns.
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../messages/en.json");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "Admin" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const t = messages.Admin.nav;
const userWith = (role: Role) => ({ id: "u1", phoneNumber: "+919876543210", role });

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
});

describe("AdminNavGate (the staff bar's section links)", () => {
  test.each(["manager", "owner"] as const)("a %s: a Staff nav with Bookings, Prices and Reports", async (role) => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith(role));
    renderWithIntl(<>{await AdminNavGate({ locale: "en" })}</>);
    const nav = screen.getByRole("navigation", { name: t.label });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      [t.bookings, "/admin/bookings"],
      [t.prices, "/admin/prices"],
      [t.reports, "/admin/reports"],
    ]);
  });

  // Nothing at all, not even an empty <nav>: its name is a staff word too.
  test.each([
    ["logged out", null],
    ["a customer", userWith("customer")],
    ["a mechanic (no section until task 31)", userWith("mechanic")],
  ])("%s: nothing", async (_case, user) => {
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    expect(await AdminNavGate({ locale: "en" })).toBeNull();
  });
});
