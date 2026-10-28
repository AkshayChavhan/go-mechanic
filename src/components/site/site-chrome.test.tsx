import { screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import { ownerGarage } from "@/server/db/seed-data";
import messages from "../../../messages/en.json";

import { SiteChrome } from "./site-chrome";

// SiteChrome reads the real registry (navigation.ts), where no page is live
// yet. To see the shell as it will be once pages ship, one test switches
// every item on through this flag. vi.hoisted: vi.mock runs before the
// imports above, so the flag must exist by then.
const registry = vi.hoisted(() => ({ allLive: false }));
vi.mock("./navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./navigation")>();
  return {
    ...actual,
    liveNavItems: () => (registry.allLive ? actual.navItems.map((item) => ({ ...item, live: true })) : actual.liveNavItems()),
  };
});

afterEach(() => {
  registry.allLive = false;
});

function renderChrome() {
  return renderWithIntl(
    <SiteChrome garage={ownerGarage}>
      <h1>{messages.HomePage.title}</h1>
    </SiteChrome>,
  );
}

/** Whether `a` comes before `b` in the page. */
const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("SiteChrome (the frame around every public page)", () => {
  test("puts its parts in order: skip link, header, main, footer, action bar", () => {
    renderChrome();
    const parts = [
      screen.getByRole("link", { name: messages.Common.skipToContent }),
      screen.getByRole("banner"),
      screen.getByRole("main"),
      screen.getByRole("contentinfo"),
      screen.getByRole("navigation", { name: messages.ActionBar.label }),
    ];
    for (let i = 1; i < parts.length; i++) expect(before(parts[i - 1], parts[i]), `part ${i}`).toBe(true);
  });

  test("the skip link is the first thing Tab reaches, and leads to main", () => {
    const { container } = renderChrome();
    const firstFocusable = container.querySelector("a[href], button, input, [tabindex]:not([tabindex='-1'])");
    expect(firstFocusable?.textContent).toBe(messages.Common.skipToContent);
    expect(firstFocusable?.getAttribute("href")).toBe("#main");
    const main = screen.getByRole("main");
    expect(main.id).toBe("main");
    // Focusable from the skip link, but not a Tab stop of its own.
    expect(main.getAttribute("tabindex")).toBe("-1");
  });

  test("shows the page inside the one main", () => {
    renderChrome();
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("main").textContent).toContain(messages.HomePage.title);
  });

  test("shows no offer banner today (src/content/offer.ts is null)", () => {
    renderChrome();
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  test("the spacer for the phone bar is hidden from screen readers", () => {
    const { container } = renderChrome();
    const spacer = container.lastElementChild;
    expect(spacer?.getAttribute("aria-hidden")).toBe("true");
    expect(spacer?.className).toContain("h-(--action-bar-height)");
  });

  test.each([
    ["today, with no live pages", false],
    ["once every page is live", true],
  ])("every navigation landmark has its own name (%s)", (_case, allLive) => {
    registry.allLive = allLive;
    renderChrome();
    const names = screen.getAllByRole("navigation").map((nav) => nav.getAttribute("aria-label"));
    expect(names.length).toBe(allLive ? 3 : 1);
    expect(new Set(names).size).toBe(names.length);
  });
});
