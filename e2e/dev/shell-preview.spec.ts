import path from "node:path";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import messages from "../../messages/en.json";
import { expectNoErrors, scrollsSideways, showAsMostVisitorsSeeIt, watchErrors } from "../helpers";

// The real layout shell (header, menu, footer, phone bar, 404) under
// `next dev`: npm run test:design. It saves screenshots for the owner's review
// in test-results/design/screenshots/shell-*.png, and checks the 404 for
// unknown URLs in development, which builds its page differently from
// production (plan KTD7).
//
// Screenshots show the visible screen only, not the full page: Chrome's
// full-page capture drops the touch emulation (so touch-sized links shrink)
// and draws the fixed phone bar halfway down the page.

// Tuesday 27 Oct 2026, 11:00 India time: the garage is open, so the
// screenshots always show the same status.
const TUESDAY_11_AM_IST = new Date("2026-10-27T05:30:00Z");

// Reduced motion: the home page's scroll animation (task 13) times itself
// with Date.now(), which the fixed clock below freezes, so with motion on its
// reveals would never finish and the screenshots would show blank sections
// (plan KTD13). With reduced motion, GSAP never loads and the page is at rest.
const phone = (width: number) => ({
  viewport: { width, height: 812 },
  hasTouch: true,
  isMobile: true,
  reducedMotion: "reduce" as const,
});
const desktop = { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" as const };

/** Opens a page and waits until the open status shows and the fonts have loaded. */
async function open(page: Page, url: string) {
  await page.clock.setFixedTime(TUESDAY_11_AM_IST);
  const response = await page.goto(url);
  await expect(page.locator('[data-open-status]:not([data-open-status="pending"])').first()).toBeVisible();
  await showAsMostVisitorsSeeIt(page);
  return response;
}

/** Saves what's on screen as test-results/design/screenshots/shell-<name>.png. */
async function save(page: Page, testInfo: TestInfo, name: string) {
  const file = path.join(testInfo.project.outputDir, "screenshots", `shell-${name}.png`);
  await page.screenshot({ path: file });
  testInfo.annotations.push({ type: "screenshot", description: file });
}

for (const width of [320, 375]) {
  test.describe(`home page on a ${width}px phone`, () => {
    test.use(phone(width));

    test("shows the shell with the phone bar, without sideways scrolling", async ({ page }, testInfo) => {
      const errors = watchErrors(page);
      await open(page, "/");
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("navigation", { name: messages.ActionBar.label })).toBeVisible();
      expect(await scrollsSideways(page)).toBe(false);
      await save(page, testInfo, `home-${width}`);
      await expectNoErrors(page, errors);
    });

    test("every phone bar label fits inside its button", async ({ page }) => {
      await open(page, "/");
      const bar = page.getByRole("navigation", { name: messages.ActionBar.label });
      const overflowing = await bar.locator("a").evaluateAll((links) =>
        links
          .filter((link) => {
            const box = link.getBoundingClientRect();
            const style = getComputedStyle(link);
            const left = box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
            const right = box.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
            // The icon and the visible label. Skipped: the screen-reader-only
            // text (1px and clipped), blank text, and the <!-- --> comments
            // React puts between pieces of text in server-rendered HTML.
            return [...link.childNodes].some((node) => {
              let rect: DOMRect;
              if (node instanceof Element) {
                if (node.classList.contains("sr-only")) return false;
                rect = node.getBoundingClientRect();
              } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
                const range = document.createRange();
                range.selectNodeContents(node);
                rect = range.getBoundingClientRect();
              } else {
                return false;
              }
              return rect.left < left - 0.5 || rect.right > right + 0.5;
            });
          })
          .map((link) => link.textContent),
      );
      expect(overflowing).toEqual([]);
    });
  });
}

test.describe("home page on a 375px phone, more", () => {
  test.use(phone(375));

  test("the menu opens with the status, hours and contact buttons, without console errors", async ({
    page,
  }, testInfo) => {
    const errors = watchErrors(page);
    await open(page, "/");
    await page.getByRole("button", { name: messages.Header.openMenu }).click();
    const menu = page.getByRole("dialog", { name: messages.Header.menuTitle });
    await expect(menu.getByRole("link", { name: messages.Contact.call })).toBeVisible();
    // Let the sheet finish sliding in before the picture.
    await page.waitForTimeout(600);
    await save(page, testInfo, "menu-375");
    await menu.getByRole("button", { name: messages.Common.close }).click();
    await expect(menu).toBeHidden();
    await expectNoErrors(page, errors);
  });

  test("scrolled to the bottom, the footer ends above the phone bar", async ({ page }, testInfo) => {
    await open(page, "/");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const footerBottom = await page.getByRole("contentinfo").evaluate((footer) => footer.getBoundingClientRect().bottom);
    const barTop = await page
      .getByRole("navigation", { name: messages.ActionBar.label })
      .evaluate((bar) => bar.getBoundingClientRect().top);
    expect(footerBottom).toBeLessThanOrEqual(barTop + 0.5);
    await save(page, testInfo, "home-375-bottom");
  });
});

test.describe("home page on a desktop", () => {
  test.use(desktop);

  test("shows the header with Book a service, and no phone bar", async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    await open(page, "/");
    await expect(page.getByRole("banner").getByRole("link", { name: new RegExp(messages.Header.book) })).toBeVisible();
    await expect(page.getByRole("navigation", { name: messages.ActionBar.label })).toBeHidden();
    await save(page, testInfo, "home-1440");
    await expectNoErrors(page, errors);
  });
});

// The 404 for unknown URLs, under next dev: the full shell, with the
// language taken from the default because the URL has none (request.ts).
for (const [label, options, name] of [
  ["a 375px phone", phone(375), "404-375"],
  ["a desktop", desktop, "404-1440"],
] as const) {
  test.describe(`an unknown URL on ${label}`, () => {
    test.use(options);

    test("shows the branded 404 inside the full shell, without console errors", async ({ page }, testInfo) => {
      const errors = watchErrors(page);
      const response = await open(page, "/this-page-does-not-exist");
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.NotFound.title);
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeAttached();
      await expect(page).toHaveTitle(new RegExp(messages.Brand.name));
      await save(page, testInfo, name);
      await expectNoErrors(page, errors);
    });
  });
}
