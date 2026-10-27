import path from "node:path";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import messages from "../../messages/en.json";
import { sampleReviews, sampleTrustStats } from "../../src/content/home";
import { formatNumber } from "../../src/i18n/format";
import { distance } from "../../src/lib/motion";
import { expectNoErrors, gsapVersions, scrollsSideways, showAsMostVisitorsSeeIt, watchErrors } from "../helpers";

// The home page as `next dev` shows it, with the sample stats and reviews
// (task 13): npm run test:design. It checks the samples, the counting numbers
// and the sticky story in a real browser, and saves the screenshots the owner
// reviews: test-results/design/screenshots/home-*.png.
//
// The clock (plan KTD13): page.clock.setFixedTime freezes Date.now, and GSAP
// times its animations with Date.now, so under a fixed clock no reveal ever
// finishes. So:
// - screenshots and content checks run with reduced motion (GSAP never
//   loads, the page is at rest), and may fix the clock for the open status;
// - motion checks never fix the clock.

const home = messages.HomePage;

// Tuesday 27 Oct 2026, 11:00 India time: the garage is open, so the
// screenshots always show the same status.
const TUESDAY_11_AM_IST = new Date("2026-10-27T05:30:00Z");

/** Each sample stat as the page writes it: "10+", "5,000+", "4.8/5", "6 months". */
const statTexts = sampleTrustStats.map((stat) =>
  home.stats[stat.id].value.replace("<number>{value}</number>", formatNumber(stat.value, "en", stat.decimals)),
);

const stats = (page: Page) => page.getByRole("region", { name: home.stats.title });
const reviews = (page: Page) => page.getByRole("region", { name: home.reviews.title });

/** Both copies of every stat: [the one screen readers read, the one on screen]. */
const statCopies = (page: Page) =>
  stats(page)
    .locator("dd")
    .evaluateAll((values) => values.map((value) => [...value.children].map((copy) => copy.textContent ?? "")));

/** Opens the home page at rest: the fixed clock for the open status, Inter. Use with reduced motion. */
async function openAtRest(page: Page) {
  await page.clock.setFixedTime(TUESDAY_11_AM_IST);
  await page.goto("/");
  await expect(page.locator('[data-open-status]:not([data-open-status="pending"])').first()).toBeVisible();
  await showAsMostVisitorsSeeIt(page);
}

/** Saves what's on screen as test-results/design/screenshots/<name>.png. */
async function save(page: Page, testInfo: TestInfo, name: string) {
  const file = path.join(testInfo.project.outputDir, "screenshots", `${name}.png`);
  await page.screenshot({ path: file });
  testInfo.annotations.push({ type: "screenshot", description: file });
}

test.describe("at rest (reduced motion)", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

  test("the sample stats and reviews show, every one marked Sample", async ({ page }) => {
    const errors = watchErrors(page);
    await openAtRest(page);
    await expect(stats(page)).toBeVisible();
    await expect(reviews(page)).toBeVisible();

    const statTiles = stats(page).locator("dl > [data-sample]");
    await expect(statTiles).toHaveCount(sampleTrustStats.length);
    const reviewCards = reviews(page).locator("[data-sample]");
    await expect(reviewCards).toHaveCount(sampleReviews.length);
    for (const item of [...(await statTiles.all()), ...(await reviewCards.all())]) {
      await expect(item.getByText(home.sample, { exact: true })).toBeVisible();
    }
    await expectNoErrors(page, errors);
  });

  test("GSAP never loads, and every number shows its final value without scrolling", async ({ page }) => {
    await openAtRest(page);
    await page.waitForLoadState("networkidle");
    expect(await gsapVersions(page)).toBeNull();
    expect(await statCopies(page)).toEqual(statTexts.map((text) => [text, text]));
  });
});

test.describe("with motion allowed (no fixed clock)", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });

  test("a number scrolled into view counts up to exactly its final text; the copy screen readers read never changes", async ({
    page,
  }) => {
    await page.goto("/");
    await expect.poll(() => gsapVersions(page)).not.toBeNull();
    // Below the first screen, the counting digits wait at zero (the warranty doesn't count).
    await expect.poll(() => stats(page).locator("[data-scene-count]").allTextContents()).toEqual(["0", "0", "0.0"]);

    // Record both copies on every frame while the numbers count.
    await stats(page).evaluate((region) => {
      const values = [...region.querySelectorAll("dd")];
      const frames: string[][][] = [];
      (window as unknown as { statFrames: typeof frames }).statFrames = frames;
      const record = () => {
        frames.push(values.map((value) => [...value.children].map((copy) => copy.textContent ?? "")));
        if (frames.length < 600) requestAnimationFrame(record);
      };
      requestAnimationFrame(record);
    });
    await stats(page).scrollIntoViewIfNeeded();

    await expect.poll(() => statCopies(page)).toEqual(statTexts.map((text) => [text, text]));
    const frames = await page.evaluate(() => (window as unknown as { statFrames: string[][][] }).statFrames);
    // The copy screen readers read held the final text on every frame...
    for (const frame of frames) expect(frame.map(([read]) => read)).toEqual(statTexts);
    // ...while the one on screen really counted: some frames caught it partway.
    const partway = frames.filter((frame) =>
      frame.some(([, shown], index) => shown !== statTexts[index] && !/^0(?:\.0)?\D/.test(shown)),
    );
    expect(partway.length).toBeGreaterThanOrEqual(2);
  });

  test("mid-story: the picture stays below the header and on screen, scaled between its start and 1", async ({
    page,
  }, testInfo) => {
    const errors = watchErrors(page);
    await page.goto("/");
    await expect.poll(() => gsapVersions(page)).not.toBeNull();
    await page.evaluate(() => {
      const story = document.querySelector("[data-scene-story]")!;
      const top = story.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top + story.clientHeight / 2 - window.innerHeight / 2);
    });
    // The scale follows the scroll position directly (scrub); give it a moment.
    await page.waitForTimeout(500);

    const visual = await page.locator("[data-scene-story-visual]").evaluate((element) => {
      const box = element.getBoundingClientRect();
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      const header = document.querySelector("header")!.getBoundingClientRect().bottom;
      return { top: box.top, bottom: box.bottom, header, viewport: window.innerHeight, scale: matrix.a };
    });
    expect(visual.top).toBeGreaterThanOrEqual(visual.header - 0.5);
    expect(visual.bottom).toBeLessThanOrEqual(visual.viewport + 0.5);
    expect(visual.scale).toBeGreaterThan(distance.storyScale);
    expect(visual.scale).toBeLessThanOrEqual(1);
    expect(await scrollsSideways(page)).toBe(false);

    await showAsMostVisitorsSeeIt(page);
    await save(page, testInfo, "home-1440-motion-mid-story");
    await expectNoErrors(page, errors);
  });
});

// Screenshots for the owner's look check, at rest, section by section.
const shots = [
  { width: 375, height: 812, touch: true },
  { width: 768, height: 1024, touch: true },
  { width: 1024, height: 768, touch: false },
  { width: 1440, height: 900, touch: false },
] as const;

for (const shot of shots) {
  test.describe(`screenshots at ${shot.width}px, at rest`, () => {
    test.use({
      viewport: { width: shot.width, height: shot.height },
      hasTouch: shot.touch,
      isMobile: shot.touch,
      reducedMotion: "reduce",
    });

    test("are saved section by section, with no sideways scrolling and no console errors", async ({
      page,
    }, testInfo) => {
      const errors = watchErrors(page);
      await openAtRest(page);
      expect(await scrollsSideways(page)).toBe(false);
      const sections = await page
        .locator("main section[aria-labelledby]")
        .evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-labelledby")!));
      // Hero, story, services, stats, reviews, call to action.
      expect(sections).toHaveLength(6);
      for (const [index, id] of sections.entries()) {
        // scrollIntoView stops below the sticky header (scroll-padding-top).
        await page.locator(`section[aria-labelledby="${id}"]`).evaluate((section) => section.scrollIntoView());
        await save(page, testInfo, `home-${shot.width}-${index + 1}-${id}`);
      }
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await save(page, testInfo, `home-${shot.width}-${sections.length + 1}-end`);
      await expectNoErrors(page, errors);
    });
  });
}
