import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import { logOut } from "@/server/actions/login";
import messages from "../../../../../messages/en.json";

import AccountPage, { generateMetadata } from "./page";

// Stand-ins for what only works inside a Next.js request:
// - AccountDetails (it reads the session cookie) is tested on its own
//   (src/components/account/account-details.test.tsx); here it's replaced
//   by a marker, so the test can see where the page puts it;
// - the Server Action module (Better Auth, cookies) becomes empty functions;
// - getTranslations (next-intl/server, for the metadata) is next-intl's own
//   translator over the real messages.
vi.mock("@/components/account/account-details", () => ({
  AccountDetails: () => <p data-testid="account-details" />,
  detailsClass: "type-lead text-muted-foreground",
}));
vi.mock("@/server/actions/login", () => ({ loginStep: vi.fn(), logOut: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../../messages/en.json");
  return {
    getTranslations: async (namespace: "Account" | "Brand") =>
      createTranslator({ locale: "en", messages: allMessages, namespace }),
  };
});

const t = messages.Account;

describe("/account", () => {
  test("one h1: the heading", () => {
    renderWithIntl(<AccountPage />);
    expect(screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent)).toEqual([t.heading]);
  });

  test("the details sit under the heading", () => {
    renderWithIntl(<AccountPage />);
    expect(screen.getByTestId("account-details")).toBeTruthy();
  });

  test("Log out is a submit button in a form, outside the part that streams in (works without JavaScript)", () => {
    renderWithIntl(<AccountPage />);
    const button = screen.getByRole("button", { name: t.logOut });
    expect(button.getAttribute("type")).toBe("submit");
    const form = button.closest("form");
    expect(form).not.toBeNull();
    // The form doesn't hold the session-reading details.
    expect(form!.contains(screen.getByTestId("account-details"))).toBe(false);
    // Not blue: logging out isn't the page's main action.
    expect(button.getAttribute("data-variant")).toBe("secondary");
  });

  test("the form posts to logOut, with the locale bound as its first argument", async () => {
    renderWithIntl(<AccountPage />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.logOut }));
    });
    expect(vi.mocked(logOut).mock.calls[0][0]).toBe("en");
  });

  test("metadata: the title with the brand, and noindex", async () => {
    expect(await generateMetadata()).toEqual({
      title: `Your account | ${messages.Brand.name}`,
      robots: { index: false, follow: false },
    });
  });
});
