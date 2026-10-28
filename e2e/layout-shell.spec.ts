import { expect, test, type Page } from "@playwright/test";

import messages from "../messages/en.json";
import { ownerGarage } from "../src/server/db/seed-data";
import { clientNamespaces } from "../src/i18n/client-messages";
import { formatPhoneNumber, telHref } from "../src/lib/contact-links";

import { expectNoErrors, layoutShift, rscPayload, trackLayoutShift, watchErrors } from "./helpers";

// The layout shell (task 12) on a real production build: header, footer,
// phone bar, phone menu, open status, 404 pages. Expected text comes from
// messages/en.json and the database seed (src/server/db/seed-data.ts): the
// production build runs on a fresh in-memory database with exactly those values.
//
// Every test that shows the open status fixes the browser's clock before the
// page loads (page.clock), so the result never depends on when it runs.
// All instants are written in UTC; India (IST) is 5 h 30 min ahead.
// 26 Oct 2026 is a Monday.

const TUESDAY_11_00 = new Date("2026-10-27T05:30:00Z");
const MONDAY_12_00 = new Date("2026-10-26T06:30:00Z");
const SUNDAY_19_30 = new Date("2026-11-01T14:00:00Z");
const TUESDAY_09_59 = new Date("2026-10-27T04:29:00Z");
const TUESDAY_18_59 = new Date("2026-10-27T13:29:00Z");
const TUESDAY_18_59_30 = new Date("2026-10-27T13:29:30Z");

// Reduced motion: these tests fix the clock (for the open status), and the
// home page's scroll animation times itself with Date.now(), which a fixed
// clock freezes. With reduced motion, GSAP never loads (CLAUDE.md, "Playwright
// and animation"). e2e/home.spec.ts tests the motion with the real clock.
const phone = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" as const };
const desktop = { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" as const };

/** "Page not found | <brand>": the title both 404 pages must have. */
const notFoundTitle = messages.NotFound.metaTitle.replace("{brand}", messages.Brand.name);

/** The footer's open status, once the browser has worked it out. */
const footerStatus = (page: Page) =>
  page.getByRole("contentinfo").locator('[data-open-status]:not([data-open-status="pending"])');

/** Opens a page with the clock fixed at `time`, and waits until the open status shows. */
async function openAt(page: Page, url: string, time: Date) {
  await page.clock.setFixedTime(time);
  const response = await page.goto(url);
  await expect(footerStatus(page)).toBeVisible();
  return response;
}

/** The text a wa.me link types into WhatsApp. */
const whatsappText = (href: string | null) => new URL(href ?? "").searchParams.get("text");

test.describe("the garage's details, on every public page", () => {
  test.use(desktop);

  test("the header: the Wordmark links home, and Book a service opens WhatsApp with the booking message", async ({
    page,
  }) => {
    await openAt(page, "/", TUESDAY_11_00);
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: messages.Brand.name })).toHaveAttribute("href", "/");
    const book = header.getByRole("link", { name: `${messages.Header.book} ${messages.Contact.opensWhatsApp}` });
    await expect(book).toBeVisible();
    await expect(book).toHaveAttribute("target", "_blank");
    expect(whatsappText(await book.getAttribute("href"))).toBe(messages.Contact.bookingMessage);
  });

  test("the footer: phone, WhatsApp and the exact address with its PIN code", async ({ page }) => {
    await openAt(page, "/", TUESDAY_11_00);
    const footer = page.getByRole("contentinfo");
    // "+91 97647 50567", dialled as tel:+919764750567
    const phoneNumber = formatPhoneNumber(ownerGarage.phone);
    const call = footer.getByRole("link", { name: `${messages.Contact.call} ${phoneNumber}` });
    await expect(call).toHaveAttribute("href", telHref(ownerGarage.phone));
    await expect(call).toContainText(phoneNumber);

    const whatsapp = footer.getByRole("link", { name: `${messages.Contact.whatsapp} ${messages.Contact.opensWhatsApp}` });
    const href = await whatsapp.getAttribute("href");
    expect(href).toMatch(new RegExp(`^https://wa\\.me/${ownerGarage.whatsapp.slice(1)}\\?text=`));
    expect(whatsappText(href)).toBe(messages.Contact.whatsappMessage);
    await expect(whatsapp).toHaveAttribute("target", "_blank");

    // "Mukai Chowk, Kiwale, Pune, Maharashtra 412101"
    await expect(footer.getByText(`${ownerGarage.address.text.en} ${ownerGarage.address.postalCode}`, { exact: true })).toBeVisible();
  });

  test("the footer: the weekly hours, as day and time pairs, in India time", async ({ page }) => {
    // The rows below are the seed (seed-data.ts) written out: Monday closed,
    // Tuesday to Sunday 10:00 to 19:00. If the hours change, change them here.
    expect(ownerGarage.hours.monday).toBe("closed");
    expect(ownerGarage.hours.tuesday).toEqual({ opens: "10:00", closes: "19:00" });

    await openAt(page, "/", TUESDAY_11_00);
    const footer = page.getByRole("contentinfo");
    const rows = await footer.locator("dt").evaluateAll((terms) =>
      terms.map((term) => [term.textContent, term.nextElementSibling?.textContent]),
    );
    expect(rows).toEqual([
      ["Monday", messages.Hours.closed],
      ["Tuesday to Sunday", "10:00 am to 7:00 pm"],
    ]);
    await expect(footer.getByText(messages.Hours.indiaTime)).toBeVisible();
  });
});

test.describe("no link in the shell leads to a missing page", () => {
  for (const url of ["/", "/this-page-does-not-exist"]) {
    test(`every internal link on ${url} answers 200`, async ({ page }) => {
      await openAt(page, url, TUESDAY_11_00);
      const hrefs = await page
        .locator("a[href]")
        .evaluateAll((links) => [
          ...new Set(
            links.map((link) => link.getAttribute("href") ?? "").filter((href) => href.startsWith("/") && !href.startsWith("//")),
          ),
        ]);
      // At least the Wordmark's link home, so the check can't pass by finding nothing.
      expect(hrefs).toContain("/");
      for (const href of hrefs) {
        expect((await page.request.get(href)).status(), href).toBe(200);
      }
    });
  }
});

test.describe("the open status, in India time", () => {
  test.use(desktop);

  for (const [when, time, badge, detail] of [
    ["Tuesday 11:00", TUESDAY_11_00, messages.OpenStatus.open, "until 7:00 pm"],
    ["Monday 12:00 (closed all day)", MONDAY_12_00, messages.OpenStatus.closed, "Opens tomorrow at 10:00 am"],
    ["Sunday 19:30", SUNDAY_19_30, messages.OpenStatus.closed, "Opens Tue at 10:00 am"],
    ["Tuesday 09:59", TUESDAY_09_59, messages.OpenStatus.closed, "Opens today at 10:00 am"],
  ] as const) {
    test(`${when} IST: "${badge}", ${detail}`, async ({ page }) => {
      await openAt(page, "/", time);
      const status = footerStatus(page);
      await expect(status.getByText(badge, { exact: true })).toBeVisible();
      await expect(status).toContainText(detail);
    });
  }

  for (const timezoneId of ["America/Los_Angeles", "Asia/Kolkata"]) {
    test.describe(`on a device set to ${timezoneId}`, () => {
      test.use({ timezoneId });

      test("Tuesday 11:00 IST is still open", async ({ page }) => {
        await openAt(page, "/", TUESDAY_11_00);
        await expect(footerStatus(page).getByText(messages.OpenStatus.open, { exact: true })).toBeVisible();
      });
    });
  }

  test("turns to closed at 19:00 IST while the page stays open", async ({ page }) => {
    // install: a clock the test can pause and move. Loading the page lets it
    // run a little; pausing at 18:59:30 makes the moment exact.
    await page.clock.install({ time: TUESDAY_18_59 });
    await page.goto("/");
    await expect(footerStatus(page)).toBeVisible();
    await page.clock.pauseAt(TUESDAY_18_59_30);
    await expect(footerStatus(page).getByText(messages.OpenStatus.open, { exact: true })).toBeVisible();

    await page.clock.runFor(60_000);
    await expect(footerStatus(page).getByText(messages.OpenStatus.closed, { exact: true })).toBeVisible();
    await expect(footerStatus(page)).toContainText("Opens tomorrow at 10:00 am");
  });
});

test.describe("on a phone (375px, touch screen)", () => {
  test.use(phone);

  test("the phone bar offers Call, WhatsApp and Book, each at least 44px tall", async ({ page }) => {
    await openAt(page, "/", TUESDAY_11_00);
    const bar = page.getByRole("navigation", { name: messages.ActionBar.label });
    await expect(bar).toBeVisible();
    const names = [
      messages.Contact.call,
      `${messages.Contact.whatsapp} ${messages.Contact.opensWhatsApp}`,
      `${messages.ActionBar.book} ${messages.Contact.opensWhatsApp}`,
    ];
    for (const name of names) {
      const box = await bar.getByRole("link", { name, exact: true }).boundingBox();
      expect(box?.height, name).toBeGreaterThanOrEqual(44);
    }
  });

  test("scrolled to the end, the footer ends above the phone bar", async ({ page }) => {
    await openAt(page, "/", TUESDAY_11_00);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const footerBottom = await page.getByRole("contentinfo").evaluate((footer) => footer.getBoundingClientRect().bottom);
    const barTop = await page
      .getByRole("navigation", { name: messages.ActionBar.label })
      .evaluate((bar) => bar.getBoundingClientRect().top);
    expect(footerBottom).toBeLessThanOrEqual(barTop + 0.5);
  });

  test("the menu opens, Escape closes it, focus goes back to the menu button, and nothing logs an error", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openAt(page, "/", TUESDAY_11_00);
    const button = page.getByRole("button", { name: messages.Header.openMenu });
    await button.click();
    const menu = page.getByRole("dialog", { name: messages.Header.menuTitle });
    await expect(menu).toBeVisible();
    await expect(menu.getByText(messages.OpenStatus.open, { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(button).toBeFocused();
    await expectNoErrors(page, errors);
  });
});

test.describe("on a desktop (1440px)", () => {
  test.use(desktop);

  test("there's no phone bar", async ({ page }) => {
    await openAt(page, "/", TUESDAY_11_00);
    await expect(page.getByRole("navigation", { name: messages.ActionBar.label })).toBeHidden();
  });

  test("the first Tab reaches the skip link, which moves focus to the page's main content", async ({ page }) => {
    await openAt(page, "/", TUESDAY_11_00);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: messages.Common.skipToContent });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
  });
});

test.describe("layout shift", () => {
  for (const [label, options] of [
    ["375px phone", phone],
    ["1440px desktop", desktop],
  ] as const) {
    test.describe(label, () => {
      test.use(options);

      test("nothing moves while the page loads and the open status appears (CLS below 0.01)", async ({ page }) => {
        // Counted from before the first paint: the observer starts before any
        // of the page's own code runs, and `buffered` includes earlier shifts.
        await trackLayoutShift(page);
        await openAt(page, "/", TUESDAY_11_00);
        // Two frames after the status appears: any shift it caused has been reported.
        expect(await layoutShift(page)).toBeLessThan(0.01);
      });
    });
  }
});

test.describe("the open status's place on the page", () => {
  test.use(phone);

  test("the empty slot in the prebuilt HTML is exactly as tall as the status that fills it", async ({
    browser,
    page,
  }) => {
    // A missing slot height would move the footer by only ~24px: under the
    // 0.01 layout-shift limit above, so it gets its own, direct check.
    const withoutJavaScript = await browser.newContext({ ...phone, javaScriptEnabled: false });
    const before = await withoutJavaScript.newPage();
    await before.goto("/");
    const slot = before.getByRole("contentinfo").locator('[data-open-status="pending"]');
    const slotHeight = (await slot.boundingBox())?.height;
    await withoutJavaScript.close();

    await openAt(page, "/", TUESDAY_11_00);
    const statusHeight = (await footerStatus(page).boundingBox())?.height;
    expect(slotHeight).toBeGreaterThan(0);
    expect(statusHeight).toBe(slotHeight);
  });
});

test.describe("the branded 404", () => {
  test.use(desktop);

  for (const url of ["/this-page-does-not-exist", "/index.html"]) {
    test(`${url}: 404, noindex, English, one branded title, the heading, a link home and the full shell`, async ({
      page,
    }) => {
      const errors = watchErrors(page);
      const response = await openAt(page, url, TUESDAY_11_00);
      expect(response?.status()).toBe(404);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await expect(page.locator("title")).toHaveCount(1);
      await expect(page).toHaveTitle(notFoundTitle);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.NotFound.title);
      await expect(page.getByRole("link", { name: messages.NotFound.backHome })).toHaveAttribute("href", "/");
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeVisible();
      await expectNoErrors(page, errors);
    });
  }

  test("/dev/design in production: 404 and noindex, as the server sends it (without JavaScript)", async ({ page }) => {
    // A static page that calls notFound() while it's built is sent as Next.js's
    // error document (<html id="__next_error__">). Its branded 404 (slim bar,
    // heading, title) is in the page data, and the browser draws it once
    // JavaScript runs. Only what the server sends is checked here: that holds
    // without JavaScript and needs no waiting. Task 18 checks its own 404s the
    // same way.
    const response = await page.request.get("/dev/design");
    expect(response.status()).toBe(404);
    const html = await response.text();
    expect(html).toMatch(/<meta name="robots" content="noindex"\s*\/?>/);
    expect(html).toContain('<html id="__next_error__">');
    expect(rscPayload(html)).toContain(notFoundTitle);
  });
});

test.describe("the browser gets only the client components' messages", () => {
  test("the page data on / holds the OpenStatus messages, not the home page's or the metadata's", async ({ page }) => {
    const html = await (await page.request.get("/")).text();
    const sent = jsonObjectAfter(rscPayload(html), "messages");
    expect(Object.keys(sent ?? {})).toEqual([...clientNamespaces]);
    expect(sent).toEqual({ OpenStatus: messages.OpenStatus });
  });
});

/** The JSON object right after `"key":` in `text`, or undefined if there's none. */
function jsonObjectAfter(text: string, key: string): Record<string, unknown> | undefined {
  const start = text.indexOf(`"${key}":{`);
  if (start === -1) return undefined;
  const from = start + key.length + 3; // the "{" after "key":
  let depth = 0;
  let inString = false;
  for (let i = from; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (char === "\\") i++;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth++;
    } else if (char === "}" && --depth === 0) {
      return JSON.parse(text.slice(from, i + 1));
    }
  }
  return undefined;
}
