import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import { logOut } from "@/server/actions/login";
import messages from "../../../messages/en.json";

import { AdminBar } from "./admin-bar";

// The Server Action module (Better Auth, cookies) becomes empty functions.
vi.mock("@/server/actions/login", () => ({ loginStep: vi.fn(), logOut: vi.fn() }));

const brand = messages.Brand.name;

describe("AdminBar", () => {
  test("the Wordmark links to /admin, and Back to site to the home page", () => {
    renderWithIntl(<AdminBar locale="en" nav={null} />);
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: brand }).getAttribute("href")).toBe("/admin");
    expect(within(header).getByRole("link", { name: messages.Admin.backToSite }).getAttribute("href")).toBe("/");
  });

  test("Log out: a submit button in a plain form posting to logOut with the locale (works without JavaScript)", async () => {
    vi.mocked(logOut).mockResolvedValue(undefined);
    renderWithIntl(<AdminBar locale="en" nav={null} />);
    const button = screen.getByRole("button", { name: messages.Account.logOut });
    expect(button.getAttribute("type")).toBe("submit");
    expect(button.closest("form")).not.toBeNull();
    // Not blue: a staff page's blue button belongs to its main action.
    expect(button.getAttribute("data-variant")).toBe("secondary");
    await act(async () => {
      fireEvent.click(button);
    });
    expect(logOut).toHaveBeenCalledWith("en", expect.any(FormData));
  });

  test("the nav slot sits between the Wordmark and the buttons, in the Tab order too", () => {
    renderWithIntl(<AdminBar locale="en" nav={<a href="#nav-marker">nav marker</a>} />);
    const order = screen.getAllByRole("link").map((link) => link.textContent);
    expect(order).toEqual([brand, "nav marker", messages.Admin.backToSite]);
  });
});
