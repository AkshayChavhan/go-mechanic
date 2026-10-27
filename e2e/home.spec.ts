import path from "node:path";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import messages from "../messages/en.json";
import { sceneSelector } from "../src/components/site/scroll-scene-attributes";
import { garage } from "../src/content/garage";
import { sampleCanary, sampleReviews } from "../src/content/home";
import { services } from "../src/content/services";
import { formatPhoneNumber, telHref } from "../src/lib/contact-links";

import {
  effectiveOpacities,
  expectNoErrors,
  gsapVersions,
  layoutShift,
  rscPayload,
  scrollsSideways,
  showAsMostVisitorsSeeIt,
  trackLayoutShift,
  watchErrors,
} from "./helpers";

// The home page (task 13) on a real production build: npm run test:e2e.
// It proves what only the built site can show: that no sample stat or review
// ever ships (owner's decision, 2026-10-27), that every word is readable
// without JavaScript and with reduced motion, that GSAP loads only for
// visitors who allow motion, and that nothing shifts while the page loads
// or scrolls. It also saves the production screenshots the owner reviews:
// test-results/home/home-*.png.
//
// The clock (plan KTD13): page.clock.setFixedTime freezes Date.now, and GSAP
// times its animations with it, so a fixed clock would stop every reveal.
// Only reduced-motion tests (GSAP never loads) fix the clock, for the open
// status in the screenshots. Motion tests never do.

const home = messages.HomePage;

const phone = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
const desktop = { viewport: { width: 1440, height: 900 } };

// Tuesday 27 Oct 2026, 11:00 India time: the garage is open.
const TUESDAY_11_AM_IST = new Date("2026-10-27T05:30:00Z");

/** Everything a reveal can hide for a moment: headings, text and tiles. */
const REVEAL_TARGETS = `${sceneSelector("reveal")}, ${sceneSelector("revealGroup")} > *`;

/**
 * Text that only the sample sections hold. None of it may reach a production
 * build: not its HTML, not its page data, not its JavaScript.
 */
const sampleOnly = [
  sampleCanary,
  ...sampleReviews.map((review) => review.text.en),
  home.stats.title,
  home.stats.years.label,
  home.stats.vehicles.label,
  home.stats.rating.label,
  home.stats.warranty.label,
  home.reviews.title,
  // "Sample customer with", before the ICU part of the message.
  home.reviews.sampleCredit.split(" {")[0],
];

/** Which of the sample-only texts `text` contains (none, we hope). */
const samplesIn = (text: string) => sampleOnly.filter((sample) => text.includes(sample));

/** The page's own section headings (the footer has its own). */
const sectionHeadings = (page: Page) => page.getByRole("main").getByRole("heading", { level: 2 }).allTextContents();
const hero = (page: Page) => page.getByRole("region", { name: home.title });
const cta = (page: Page) => page.getByRole("region", { name: home.cta.title });

/** "Book a service (opens WhatsApp)": the Book link's name for screen readers. */
const bookName = `${messages.Header.book} ${messages.Contact.opensWhatsApp}`;

/** Waits until GSAP has loaded and the effects have hidden something below the first screen. */
async function waitForEffects(page: Page) {
  await expect.poll(() => gsapVersions(page)).not.toBeNull();
  await expect.poll(async () => (await effectiveOpacities(page, REVEAL_TARGETS)).filter((opacity) => opacity === 0).length).toBeGreaterThan(0);
}

/** Scrolls to the bottom in screen-sized steps, as a reader would, checking for sideways scroll on the way. */
async function scrollThrough(page: Page) {
  for (let step = 0; step < 40; step++) {
    const atBottom = await page.evaluate(() => {
      window.scrollBy(0, Math.round(window.innerHeight * 0.8));
      return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1;
    });
    expect(await scrollsSideways(page)).toBe(false);
    await page.waitForTimeout(150);
    if (atBottom) return;
  }
  throw new Error("never reached the bottom of the page");
}

test.describe("what the production build ships", () => {
  test.use(desktop);

  test("/ answers 200: the h1, then the story, the services and the call to action", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(home.title);
    expect(await sectionHeadings(page)).toEqual([home.story.title, home.services.title, home.cta.title]);
    for (const title of [home.story.title, home.services.title, home.cta.title]) {
      await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
    }
  });

  test("no sample stats or reviews: not on the page, not in its HTML, not in its page data", async ({ page }) => {
    // expect.soft: a leak is reported for every place it shows, not just the first.
    await page.goto("/");
    await expect.soft(page.locator("[data-sample]")).toHaveCount(0);
    await expect.soft(page.getByRole("heading", { name: home.stats.title })).toHaveCount(0);
    await expect.soft(page.getByRole("heading", { name: home.reviews.title })).toHaveCount(0);

    const html = await (await page.request.get("/")).text();
    const pageData = rscPayload(html);
    // The checks below must be reading the real page, not an empty string.
    expect(html).toContain(home.title);
    expect(pageData).toContain(home.services.title);
    expect.soft(samplesIn(html), "in the HTML").toEqual([]);
    expect.soft(samplesIn(pageData), "in the page data inside the HTML").toEqual([]);

    // The page data a client-side navigation fetches instead of the HTML.
    const flight = await page.request.get("/", { headers: { RSC: "1" } });
    expect(flight.headers()["content-type"]).toContain("text/x-component");
    const flightText = await flight.text();
    expect(flightText).toContain(home.services.title);
    expect.soft(samplesIn(flightText), "in the page data a navigation fetches").toEqual([]);
  });

  test("no sample text in any JavaScript the page loads, GSAP's lazy chunk included", async ({ page }) => {
    // Motion allowed, so the lazily loaded effects chunk is among the files.
    const scripts = new Set<string>();
    page.on("response", (response) => {
      if (response.request().resourceType() === "script") scripts.add(response.url());
    });
    await page.goto("/");
    await waitForEffects(page);
    await scrollThrough(page);
    await page.waitForLoadState("networkidle");
    for (const src of await page.locator("script[src]").evaluateAll((tags) => tags.map((tag) => (tag as HTMLScriptElement).src))) {
      scripts.add(src);
    }

    expect(scripts.size).toBeGreaterThan(3);
    const found: Record<string, string[]> = {};
    let sawScrollTrigger = false;
    for (const url of scripts) {
      const code = await (await page.request.get(url)).text();
      if (code.includes("ScrollTrigger")) sawScrollTrigger = true;
      const samples = samplesIn(code);
      if (samples.length > 0) found[url] = samples;
    }
    // GSAP's chunk was scanned too, so the scan covers what loads late.
    expect(sawScrollTrigger).toBe(true);
    expect(found).toEqual({});
  });

  test("the hero's Book opens WhatsApp with the booking message; Call dials the garage", async ({ page }) => {
    await page.goto("/");
    const book = hero(page).getByRole("link", { name: bookName });
    await expect(book).toHaveAttribute("target", "_blank");
    const href = new URL((await book.getAttribute("href")) ?? "");
    expect(href.host).toBe("wa.me");
    expect(href.searchParams.get("text")).toBe(messages.Contact.bookingMessage);

    const call = hero(page).getByRole("link", { name: `${messages.Contact.call} ${formatPhoneNumber(garage.phone)}` });
    await expect(call).toHaveAttribute("href", telHref(garage.phone));
    await expect(call).toHaveAttribute("href", "tel:+919764750567");
  });
});

test.describe("from 768px, Call shows the number", () => {
  test.use({ viewport: { width: 768, height: 1024 }, reducedMotion: "reduce" });

  test("it reads \"Call +91 97647 50567\", with the space, in the hero and the call to action", async ({ page }) => {
    await page.goto("/");
    const name = `${messages.Contact.call} ${formatPhoneNumber(garage.phone)}`;
    for (const section of [hero(page), cta(page)]) {
      const call = section.locator(`a[href="${telHref(garage.phone)}"]`);
      await expect(call).toHaveAccessibleName(name);
      await expect(call).toHaveText(name);
    }
  });
});

test.describe("on a 375px phone, on first load", () => {
  test.use({ ...phone, reducedMotion: "reduce" });

  test("the h1 and both buttons sit above the phone bar", async ({ page }) => {
    await page.goto("/");
    const barTop = await page
      .getByRole("navigation", { name: messages.ActionBar.label })
      .evaluate((bar) => bar.getBoundingClientRect().top);
    const bottoms = await hero(page)
      .locator("h1, a")
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().bottom));
    expect(bottoms).toHaveLength(3); // the h1, Book and Call
    for (const bottom of bottoms) expect(bottom).toBeLessThanOrEqual(barTop);
  });
});

test.describe("every word is readable without the animation", () => {
  test.use(desktop);

  test("without JavaScript: every heading, all eleven services and every reveal target are fully visible", async ({
    browser,
  }) => {
    const context = await browser.newContext({ ...desktop, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    const names = await page.getByRole("heading", { level: 3 }).allTextContents();
    for (const service of services) expect(names).toContain(service.name.en);
    for (const selector of ["h1", "h2", "h3", REVEAL_TARGETS]) {
      const opacities = await effectiveOpacities(page, selector);
      expect(opacities.length, selector).toBeGreaterThan(0);
      expect(opacities.every((opacity) => opacity === 1), selector).toBe(true);
    }
    await context.close();
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("GSAP never loads, and every reveal target stays put and visible, after load and at the bottom", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const atRest = () =>
        page.locator(REVEAL_TARGETS).evaluateAll((targets) =>
          targets.map((target) => ({ opacity: getComputedStyle(target).opacity, transform: getComputedStyle(target).transform })),
        );
      const expected = { opacity: "1", transform: "none" };
      for (const target of await atRest()) expect(target).toEqual(expected);

      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(500);
      for (const target of await atRest()) expect(target).toEqual(expected);
      expect(await gsapVersions(page)).toBeNull();
    });
  });
});

test.describe("with motion allowed (no fixed clock)", () => {
  test.use({ ...desktop, reducedMotion: "no-preference" });

  test("GSAP loads after the page; jumping straight to the bottom still reveals everything", async ({ page }) => {
    await page.goto("/");
    await waitForEffects(page);
    // The End key's jump: ScrollTrigger still reveals what it skipped over.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect
      .poll(async () => (await effectiveOpacities(page, REVEAL_TARGETS)).filter((opacity) => opacity !== 1), { timeout: 5_000 })
      .toEqual([]);
  });

  test("tabbing to the call to action's Book link: the link is never hidden, and its heading comes into view", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForEffects(page);
    const target = cta(page).getByRole("link", { name: bookName });
    let reached = false;
    for (let presses = 0; presses < 30 && !reached; presses++) {
      await page.keyboard.press("Tab");
      reached = await target.evaluate((link) => link === document.activeElement);
      // Wherever focus lands, it's fully visible at that moment.
      expect(await effectiveOpacities(page, ":focus")).toEqual([1]);
    }
    expect(reached, "Tab never reached the call to action's Book link").toBe(true);
    // Focus scrolled the section into view, so its heading reveals.
    const headingId = await cta(page).getAttribute("aria-labelledby");
    await expect.poll(() => effectiveOpacities(page, `#${headingId}`)).toEqual([1]);
  });
});

test.describe("a window that grows taller without scrolling", () => {
  test.use({ viewport: { width: 412, height: 732 }, reducedMotion: "no-preference" });

  test("everything that was waiting below the fold shows, with no scroll at all", async ({ page }) => {
    // A window maximised, or a renderer that opens a very tall window:
    // nothing scrolls, so ScrollTrigger alone would never reveal anything.
    await page.goto("/");
    await waitForEffects(page);
    const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 412, height: fullHeight });
    await expect
      .poll(async () => (await effectiveOpacities(page, "main *")).filter((opacity) => opacity !== 1).length)
      .toBe(0);
  });
});

test.describe("layout shift and errors, while loading and scrolling", () => {
  for (const [label, options] of [
    ["375px phone", phone],
    ["1440px desktop", desktop],
  ] as const) {
    test.describe(label, () => {
      test.use({ ...options, reducedMotion: "no-preference" });

      test("CLS stays below 0.01 from load to the bottom, nothing scrolls sideways, and nothing logs an error", async ({
        page,
      }) => {
        const errors = watchErrors(page);
        await trackLayoutShift(page);
        await page.goto("/");
        await waitForEffects(page);
        await page.evaluate(() => document.fonts.ready);
        expect(await layoutShift(page), "on load").toBeLessThan(0.01);
        await scrollThrough(page);
        await page.waitForTimeout(1_000); // the last reveals finish
        expect(await layoutShift(page), "after scrolling to the bottom").toBeLessThan(0.01);
        await expectNoErrors(page, errors);
      });
    });
  }
});

test.describe("other pages don't load GSAP", () => {
  test.use({ ...desktop, reducedMotion: "no-preference" });

  test("the 404 page, with motion allowed", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await page.waitForLoadState("networkidle");
    expect(await gsapVersions(page)).toBeNull();
  });
});

/** Saves what's on screen as test-results/home/<name>.png. */
async function save(page: Page, testInfo: TestInfo, name: string) {
  const file = path.join(testInfo.project.outputDir, "home", `${name}.png`);
  await page.screenshot({ path: file });
  testInfo.annotations.push({ type: "screenshot", description: file });
}

// Screenshots of what ships, for the owner's look check: at rest, section by section.
for (const [width, options] of [
  [375, phone],
  [1440, desktop],
] as const) {
  test.describe(`production screenshots at ${width}px`, () => {
    test.use({ ...options, reducedMotion: "reduce" });

    test("are saved section by section", async ({ page }, testInfo) => {
      await page.clock.setFixedTime(TUESDAY_11_AM_IST);
      await page.goto("/");
      await expect(page.locator('[data-open-status]:not([data-open-status="pending"])').first()).toBeVisible();
      await showAsMostVisitorsSeeIt(page);
      const sections = await page
        .locator("main section[aria-labelledby]")
        .evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-labelledby")!));
      // Hero, story, services, call to action: no stats or reviews in production.
      expect(sections).toHaveLength(4);
      for (const [index, id] of sections.entries()) {
        await page.locator(`section[aria-labelledby="${id}"]`).evaluate((section) => section.scrollIntoView());
        await save(page, testInfo, `home-${width}-${index + 1}-${id}`);
      }
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await save(page, testInfo, `home-${width}-${sections.length + 1}-end`);
    });
  });
}
