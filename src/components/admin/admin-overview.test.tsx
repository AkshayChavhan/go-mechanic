import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Role } from "@/domain/roles";
import { renderWithIntl } from "@/i18n/test-utils";
import { getCurrentUser } from "@/server/auth/session";
import messages from "../../../messages/en.json";

import { AdminOverview } from "./admin-overview";

// AdminOverview is /admin's gate, an async Server Component: each test calls
// it and renders what it returns. The real requirePermission runs; only the
// session read (getCurrentUser) is a stand-in, answering with the user each
// test needs. Managers and mechanics can't exist before task 29, so this is
// where their views are tested.
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../messages/en.json");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "Admin" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const t = messages.Admin;
const userWith = (role: Role) => ({ id: "u1", phoneNumber: "+919876543210", role });

/** What a call threw (a redirect or a 404 is a thrown error with a digest). */
async function thrownBy(run: Promise<unknown>): Promise<unknown> {
  return run.then(
    () => "nothing thrown",
    (error: unknown) => error,
  );
}

// The same digests as src/server/auth/access.test.ts.
const TO_LOGIN = { digest: expect.stringMatching(/^NEXT_REDIRECT;replace;\/login\?session=ended;/) };
const NOT_FOUND = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
});

describe("AdminOverview (/admin's gate)", () => {
  test("logged out (a leftover cookie): sent to /login?session=ended", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await thrownBy(AdminOverview({ locale: "en" }))).toMatchObject(TO_LOGIN);
  });

  test("a customer: the 404 page, so the staff area doesn't admit it exists", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("customer"));
    expect(await thrownBy(AdminOverview({ locale: "en" }))).toMatchObject(NOT_FOUND);
  });

  test("a mechanic: the heading and the note that their jobs come later, and no section cards", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("mechanic"));
    renderWithIntl(await AdminOverview({ locale: "en" }));
    expect(screen.getByRole("heading", { level: 1, name: t.overview.heading })).toBeTruthy();
    expect(screen.getByText(t.overview.mechanicNote)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText(t.overview.intro)).toBeNull();
  });

  test.each(["manager", "owner"] as const)("a %s: a card for Bookings and one for Prices, as links", async (role) => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith(role));
    renderWithIntl(await AdminOverview({ locale: "en" }));
    expect(screen.getByRole("heading", { level: 1, name: t.overview.heading })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      t.nav.bookings,
      t.nav.prices,
    ]);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/admin/bookings", "/admin/prices"]);
    expect(links[0].textContent).toContain(t.overview.bookingsDescription);
    expect(links[1].textContent).toContain(t.overview.pricesDescription);
    expect(screen.queryByText(t.overview.mechanicNote)).toBeNull();
  });
});
