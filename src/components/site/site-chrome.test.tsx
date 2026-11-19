import { readFileSync } from "node:fs";
import path from "node:path";

import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import { ownerGarage } from "@/server/db/seed-data";
import messages from "../../../messages/en.json";

import { SiteChrome } from "./site-chrome";

// SiteChrome reads the real registry (navigation.ts), where some pages are
// live (Services and Packages since task 18). To see the shell with no page
// live, or with every page live, one test switches the items through this
// flag. vi.hoisted: vi.mock runs before the imports above, so the flag must
// exist by then.
const registry = vi.hoisted(() => ({ pages: "real" as "none" | "real" | "all" }));
vi.mock("./navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./navigation")>();
  return {
    ...actual,
    liveNavItems: () =>
      registry.pages === "none"
        ? []
        : registry.pages === "all"
          ? actual.navItems.map((item) => ({ ...item, live: true }))
          : actual.liveNavItems(),
  };
});

afterEach(() => {
  registry.pages = "real";
});

function renderChrome({ actionBar }: { actionBar?: boolean } = {}) {
  return renderWithIntl(
    <SiteChrome garage={ownerGarage} actionBar={actionBar}>
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

  test('"Book a service" in the header and the action bar\'s Book open /book (live since task 47)', () => {
    renderChrome();
    expect(screen.getByRole("link", { name: messages.Header.book }).getAttribute("href")).toBe("/book");
    const bar = screen.getByRole("navigation", { name: messages.ActionBar.label });
    expect(within(bar).getByRole("link", { name: messages.ActionBar.book }).getAttribute("href")).toBe("/book");
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

  test("by default, shows the phone bar, with its marker, and then the spacer", () => {
    const { container } = renderChrome();
    const bar = screen.getByRole("navigation", { name: messages.ActionBar.label });
    expect(bar.hasAttribute("data-action-bar")).toBe(true);
    expect(container.lastElementChild?.className).toContain("h-(--action-bar-height)");
    expect(bar.nextElementSibling).toBe(container.lastElementChild);
  });

  test("with actionBar={false}, shows no phone bar and no spacer: the footer comes last", () => {
    const { container } = renderChrome({ actionBar: false });
    expect(screen.queryByRole("navigation", { name: messages.ActionBar.label })).toBeNull();
    expect(container.querySelector("[data-action-bar]")).toBeNull();
    expect(container.querySelector('[class*="h-(--action-bar-height)"]')).toBeNull();
    expect(container.lastElementChild).toBe(screen.getByRole("contentinfo"));
  });

  test.each([
    ["with no live pages", "none", 1],
    ["with today's live pages", "real", 3],
    ["once every page is live", "all", 3],
  ] as const)("every navigation landmark has its own name (%s)", (_case, pages, count) => {
    registry.pages = pages;
    renderChrome();
    const names = screen.getAllByRole("navigation").map((nav) => nav.getAttribute("aria-label"));
    expect(names.length).toBe(count);
    expect(new Set(names).size).toBe(names.length);
  });
});

// The room phones keep for the bar (scroll padding, --stage-height) lives in
// globals.css. jsdom doesn't apply that CSS, so this reads its text (from the
// repo root: under jsdom, import.meta.url isn't a file: URL): every
// rule that reserves the bar's height must look for the bar's marker with
// :has(), or a page without the bar (the (book) pages) would get an empty gap.
describe("globals.css reserves the phone bar's room only while the bar is on the page", () => {
  const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  // Each rule (selector { declarations }) that uses the bar's height.
  const rules = [...css.matchAll(/([^{};]+)\{([^{}]*)\}/g)].filter(([, , body]) =>
    /(?:scroll-padding-bottom|--stage-height)\s*:[^;]*--action-bar-height/.test(body),
  );

  test("both rules exist: the scroll padding and the stage height", () => {
    const bodies = rules.map(([, , body]) => body);
    expect(bodies.some((body) => body.includes("scroll-padding-bottom"))).toBe(true);
    expect(bodies.some((body) => body.includes("--stage-height"))).toBe(true);
  });

  test.each([0, 1])("rule %i is keyed on :has([data-action-bar])", (index) => {
    const selector = rules[index]?.[1].trim();
    expect(selector).toMatch(/:has\(\[data-action-bar\]\)$/);
  });

  test("no other rule uses the bar's height for the scroll padding or the stage", () => {
    expect(rules).toHaveLength(2);
  });
});
