import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import messages from "../../messages/en.json";

// Real-browser checks of the /dev/design preview (src/app/[locale]/dev/design),
// against `next dev`: npm run test:design. Unit tests can't see these things:
// sizes on a touch screen, live contrast, focus outlines, motion, fonts.
// It also saves the screenshots the owner reviews.

const PAGE = "/dev/design";
const TOUCH = 44; // the smallest comfortable target for a thumb, in px

/** Opens the page and waits until it's interactive (React has hydrated). */
async function open(page: Page) {
  const response = await page.goto(PAGE);
  // Each colour swatch measures itself after hydration, so once they all have
  // a ratio, clicks work and colours are final.
  await expect(page.locator("[data-contrast-min]").first()).toBeVisible();
  await expect(page.locator("[data-contrast-min]:not([data-contrast-ratio])")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  return response;
}

/** Switches the preview to Inter, the font Android and Windows visitors get. */
async function useInter(page: Page) {
  await page.getByRole("button", { name: "Inter", exact: true }).click();
  await expect(page.getByRole("button", { name: "Inter", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => document.fonts.ready);
}

/** Whether the page is wider than the screen (it scrolls sideways). */
const scrollsSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

const noQuotes = (family: string) => family.replace(/["']/g, "").trim();

test("answers in development, in English, with one h1 and a noindex robots tag", async ({ page }) => {
  const response = await open(page);
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("no console errors while loading, switching the font, opening the sheet and playing the motion demo", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await open(page);
  await useInter(page);
  await page.getByRole("button", { name: "Open the menu" }).click();
  const sheet = page.getByRole("dialog", { name: "Menu" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: messages.Common.close }).click();
  await expect(sheet).toBeHidden();
  await page.getByRole("button", { name: "Play" }).click();
  await page.waitForTimeout(1_000);
  expect(errors).toEqual([]);
});

test("every colour swatch reaches its contrast minimum", async ({ page }) => {
  await open(page);
  const swatches = await page
    .locator("[data-contrast-ratio]")
    .evaluateAll((elements) =>
      elements.map((element) => ({
        label: element.querySelector("figcaption span")?.textContent ?? "",
        ratio: Number(element.getAttribute("data-contrast-ratio")),
        minimum: Number(element.getAttribute("data-contrast-min")),
      })),
    );
  // 27 pairs in each of the three tones (white, grey band, black showcase).
  expect(swatches.length).toBe(81);
  expect(swatches.filter((swatch) => !(swatch.ratio >= swatch.minimum))).toEqual([]);
});

test("the Hindi line loads the Devanagari font and has no negative letter-spacing", async ({ page }) => {
  await open(page);
  const devanagari = noQuotes(
    (await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--font-devanagari"))).split(
      ",",
    )[0],
  );
  await expect
    .poll(() =>
      page.evaluate(
        (family) =>
          [...document.fonts].some((face) => face.family.replace(/["']/g, "") === family && face.status === "loaded"),
        devanagari,
      ),
    )
    .toBe(true);
  const letterSpacing = await page.locator("[data-hindi-specimen]").evaluate((element) => getComputedStyle(element).letterSpacing);
  expect(["normal", "0px"]).toContain(letterSpacing);
});

test("the font switch shows Inter, the font of most Android visitors", async ({ page }) => {
  await open(page);
  const heading = page.locator("h1");
  const inter = noQuotes(
    (await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--font-inter"))).split(",")[0],
  );
  // On this Mac, San Francisco comes first...
  expect(await heading.evaluate((element) => getComputedStyle(element).fontFamily)).toMatch(/^-apple-system/);
  // ...and with the switch on Inter, the stack starts with Inter.
  await useInter(page);
  const family = await heading.evaluate((element) => getComputedStyle(element).fontFamily);
  expect(noQuotes(family.split(",")[0])).toBe(inter);
});

test("pressing Tab to the first main button shows a solid 2px outline in the ring colour", async ({ page }) => {
  await open(page);
  let isMainButton = false;
  for (let presses = 0; presses < 80 && !isMainButton; presses++) {
    await page.keyboard.press("Tab");
    isMainButton = await page.evaluate(
      () => document.activeElement?.matches('[data-slot="button"][data-variant="default"]') ?? false,
    );
  }
  expect(isMainButton, "Tab never reached a main (default) button").toBe(true);
  const focusOutline = () =>
    page.evaluate(() => {
      const element = document.activeElement as HTMLElement;
      const style = getComputedStyle(element);
      // The ring colour as the browser resolves it, for comparison.
      const probe = document.createElement("span");
      probe.style.color = "var(--ring)";
      element.append(probe);
      const ring = getComputedStyle(probe).color;
      probe.remove();
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth), sameAsRing: style.outlineColor === ring };
    });
  // The button's transition-all fades the outline in (about 250ms), so wait
  // for it to settle before comparing colours.
  await expect.poll(focusOutline).toEqual({ style: "solid", width: 2, sameAsRing: true });
});

test.describe("on a phone (375px, touch screen)", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test("touch emulation makes (pointer: coarse) match, so small controls grow", async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
  });

  test("every visible button, button link and field is at least 44px tall; icon buttons are 44px wide", async ({
    page,
  }) => {
    await open(page);
    const controls = await page.locator('button, a[data-slot="button"], input').evaluateAll((elements) =>
      elements
        // Playwright also finds elements inside shadow roots, such as the
        // Next.js dev badge's button. Only the page's own controls count.
        .filter((element) => element.getRootNode() === document)
        .filter((element) => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
        .map((element) => {
          const box = element.getBoundingClientRect();
          return {
            name: element.getAttribute("aria-label") || element.textContent?.trim() || element.id || element.tagName,
            height: box.height,
            width: box.width,
            iconOnly: (element.getAttribute("data-size") ?? "").startsWith("icon"),
          };
        }),
    );
    expect(controls.length).toBeGreaterThan(30);
    const tooSmall = controls.filter(
      (control) => control.height < TOUCH - 0.5 || (control.iconOnly && control.width < TOUCH - 0.5),
    );
    expect(tooSmall).toEqual([]);
  });

  test("the page never scrolls sideways, in either font", async ({ page }) => {
    await open(page);
    expect(await scrollsSideways(page)).toBe(false);
    await useInter(page);
    expect(await scrollsSideways(page)).toBe(false);
  });
});

test.describe("on a desktop (1440px, mouse)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a size="sm" button stays 36px tall with a mouse', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(false);
    const box = await page.locator('[data-slot="button"][data-size="sm"]').first().boundingBox();
    expect(box?.height).toBe(36);
  });
});

test.describe("motion demo", () => {
  /** Where the tile's right edge is, and where the track ends. */
  async function positions(page: Page) {
    const [tile, track] = await Promise.all([
      page.locator("[data-motion-tile]").boundingBox(),
      page.locator("[data-motion-track]").boundingBox(),
    ]);
    if (!tile || !track) throw new Error("motion demo not found");
    return { tileEnd: tile.x + tile.width, trackEnd: track.x + track.width };
  }

  test.describe("with reduce motion on", () => {
    test.use({ reducedMotion: "reduce" });

    test("Play puts the tile at the end straight away", async ({ page }) => {
      await open(page);
      await page.getByRole("button", { name: "Play" }).click();
      const { tileEnd, trackEnd } = await positions(page);
      expect(Math.abs(trackEnd - tileEnd)).toBeLessThan(1);
    });
  });

  test.describe("with reduce motion off", () => {
    test.use({ reducedMotion: "no-preference" });

    test("Play moves the tile over time, to the end", async ({ page }) => {
      await open(page);
      const start = await positions(page);
      await page.getByRole("button", { name: "Play" }).click();
      await page.waitForTimeout(150);
      const early = await positions(page);
      await page.waitForTimeout(150);
      const later = await positions(page);
      // Moving, and not there yet after 150ms of an 800ms move.
      expect(early.tileEnd).toBeGreaterThan(start.tileEnd);
      expect(later.tileEnd).toBeGreaterThan(early.tileEnd);
      expect(later.trackEnd - later.tileEnd).toBeGreaterThan(1);
      await expect.poll(async () => {
        const end = await positions(page);
        return Math.abs(end.trackEnd - end.tileEnd);
      }).toBeLessThan(1);
    });
  });
});

// Screenshots for the owner's review: test-results/design/screenshots/.
// Inter at every width (what most visitors get), plus San Francisco at 1440px.
const shots = [
  { width: 375, height: 812, touch: true, font: "inter" },
  { width: 768, height: 1024, touch: true, font: "inter" },
  { width: 1024, height: 768, touch: false, font: "inter" },
  { width: 1440, height: 900, touch: false, font: "inter" },
  { width: 1440, height: 900, touch: false, font: "san-francisco" },
] as const;

for (const shot of shots) {
  test.describe(`screenshot at ${shot.width}px in ${shot.font}`, () => {
    test.use({ viewport: { width: shot.width, height: shot.height }, hasTouch: shot.touch, isMobile: shot.touch });

    test("is saved", async ({ page }, testInfo) => {
      await open(page);
      if (shot.font === "inter") await useInter(page);
      // Hide the Next.js dev badge (not part of the page), and pin the sticky
      // header to the top: a full-page capture can draw it over the footer.
      await page.addStyleTag({
        content: "nextjs-portal { display: none !important; } header { position: static !important; }",
      });
      // Chrome can't capture more than 16,384px in one go: past that, the
      // image starts again from the top of the page. So the page is saved in
      // parts of at most 12,000px: design-375-inter-1-of-3.png and so on.
      const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      const partHeight = 12_000;
      const parts = Math.ceil(pageHeight / partHeight);
      for (let part = 0; part < parts; part++) {
        const y = part * partHeight;
        const name = `design-${shot.width}-${shot.font}-${part + 1}-of-${parts}.png`;
        const file = path.join(testInfo.project.outputDir, "screenshots", name);
        await page.screenshot({
          path: file,
          fullPage: true,
          clip: { x: 0, y, width: shot.width, height: Math.min(partHeight, pageHeight - y) },
        });
        testInfo.annotations.push({ type: "screenshot", description: file });
      }
    });
  });
}
