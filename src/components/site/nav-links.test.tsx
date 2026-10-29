import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";

import { isCurrentPage, NavLinks } from "./nav-links";

// usePathname is replaced, so each test sets the address (null: it suspends,
// as it does while a page is built ahead of time). Link stays real.
const address = vi.hoisted(() => ({ pathname: "/" as string | null }));
const never = new Promise<never>(() => {});
vi.mock("@/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/navigation")>()),
  usePathname: () => {
    if (address.pathname === null) throw never;
    return address.pathname;
  },
}));

const items = [
  { href: "/services", label: "Services" },
  { href: "/packages", label: "Packages" },
];

function renderLinks() {
  return renderWithIntl(<NavLinks items={items} listClassName="row" linkClassName="link" />);
}

const current = () =>
  screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent);

beforeEach(() => {
  address.pathname = "/";
});

describe("NavLinks", () => {
  test("lists every link, in order, with the classes it was given", () => {
    renderLinks();
    const links = screen.getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href"), link.className])).toEqual([
      ["Services", "/services", "link"],
      ["Packages", "/packages", "link"],
    ]);
    expect(screen.getByRole("list").className).toBe("row");
  });

  test("while the address isn't known yet: the same links, none marked", () => {
    address.pathname = null;
    renderLinks();
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["Services", "Packages"]);
    expect(current()).toEqual([]);
  });

  test.each([
    ["/services", ["Services"]],
    ["/services/brakes", ["Services"]],
    ["/packages", ["Packages"]],
    ["/", []],
    ["/servicesx", []],
  ])("on %s, marks %j as the current page", (pathname, expected) => {
    address.pathname = pathname;
    renderLinks();
    expect(current()).toEqual(expected);
  });
});

test("isCurrentPage: the page itself and the pages under it, nothing else", () => {
  expect(isCurrentPage("/services", "/services")).toBe(true);
  expect(isCurrentPage("/services/ac", "/services")).toBe(true);
  expect(isCurrentPage("/services-old", "/services")).toBe(false);
  expect(isCurrentPage("/", "/services")).toBe(false);
});
