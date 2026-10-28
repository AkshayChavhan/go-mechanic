import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import messages from "../../messages/en.json";
import { sampleTrustStats } from "../../src/content/home";
import { effectiveOpacities, gsapVersions, scrollsSideways } from "../helpers";

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
  // The switch sets the font on <html> in an effect, just after the click.
  // Wait for that, then make the browser lay the page out (which starts the
  // font downloads) before waiting for the fonts: otherwise fonts.ready can
  // resolve too early and a screenshot catches text mid-swap.
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).fontFamily))
    .not.toMatch(/^-apple-system/);
  await page.evaluate(async () => {
    void document.body.offsetHeight;
    await document.fonts.ready;
  });
}

// Two samples open a menu sheet with the same labels: the plain Sheet
// component and the real phone menu (Layout shell). data-sample tells them apart.
const sample = (page: Page, name: string) => page.locator(`[data-sample="${name}"]`);

const noQuotes = (family: string) => family.replace(/["']/g, "").trim();

test("answers in development, in English, with one h1 and a noindex robots tag", async ({ page }) => {
  const response = await open(page);
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("no console errors while loading, switching the font, opening both sheets and playing the motion demo", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await open(page);
  await useInter(page);
  await sample(page, "sheet").getByRole("button", { name: "Open the menu" }).click();
  const sheet = page.getByRole("dialog", { name: "Menu" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: messages.Common.close }).click();
  await expect(sheet).toBeHidden();
  // The real phone menu, with the open status, hours and contact buttons.
  await sample(page, "phone-menu").getByRole("button", { name: messages.Header.openMenu }).click();
  const menu = page.getByRole("dialog", { name: messages.Header.menuTitle });
  await expect(menu.locator('[data-open-status]:not([data-open-status="pending"])')).toBeVisible();
  await menu.getByRole("button", { name: messages.Common.close }).click();
  await expect(menu).toBeHidden();
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
  // ...and with the switch on Inter, the stack starts with Inter: on the page,
  // on <body>, and in the sheet, which renders outside the page (a portal).
  await useInter(page);
  const firstFont = async (element: ReturnType<Page["locator"]>) =>
    noQuotes((await element.evaluate((node) => getComputedStyle(node).fontFamily)).split(",")[0]);
  expect(await firstFont(heading)).toBe(inter);
  expect(await firstFont(page.locator("body"))).toBe(inter);
  await sample(page, "sheet").getByRole("button", { name: "Open the menu" }).click();
  const sheetTitle = page.getByRole("dialog", { name: "Menu" }).getByRole("heading", { name: "Menu" });
  await expect(sheetTitle).toBeVisible();
  expect(await firstFont(sheetTitle)).toBe(inter);
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

test("the page blocks: illustrations in three tones, a slot, a wide and a normal tile, marked samples and the scroll values", async ({
  page,
}) => {
  await open(page);
  await expect(sample(page, "illustrations").locator("svg[aria-hidden='true']")).toHaveCount(3);
  await expect(sample(page, "visual-slot").locator("svg")).toHaveCount(1);
  const tiles = sample(page, "service-tiles").locator("li");
  await expect(tiles).toHaveCount(2);
  // The wide tile is twice as wide as the normal one (from 640px).
  const [wide, normal] = await tiles.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().width));
  expect(wide).toBeGreaterThan(normal * 1.9);
  await expect(sample(page, "stat-tiles").locator("[data-sample]")).toHaveCount(sampleTrustStats.length);
  await expect(sample(page, "stat-tiles").getByText(messages.HomePage.sample, { exact: true })).toHaveCount(
    sampleTrustStats.length,
  );
  await expect(sample(page, "review-card").getByText(messages.HomePage.sample, { exact: true })).toBeVisible();
  await expect(sample(page, "sample-badge").getByText(messages.HomePage.sample, { exact: true })).toBeVisible();
  await expect(sample(page, "scroll-values").locator("dt")).toHaveCount(5);
});

test("the checkbox field: native boxes, ticked by pressing the label's text, the error tied to its box", async ({
  page,
}) => {
  await open(page);
  const boxes = sample(page, "checkbox-field").getByRole("checkbox");
  await expect(boxes).toHaveCount(3);
  await expect(boxes.nth(0)).not.toBeChecked();
  await expect(boxes.nth(1)).toBeChecked();
  await sample(page, "checkbox-field").getByText("Send me a reminder the day before my booking.").click();
  await expect(boxes.nth(0)).toBeChecked();
  const error = sample(page, "checkbox-field").getByText("Tick this box to continue.");
  await expect(boxes.nth(2)).toHaveAttribute("aria-invalid", "true");
  await expect(boxes.nth(2)).toHaveAttribute("aria-describedby", (await error.getAttribute("id"))!);
});

test.describe("the scroll scene demo", () => {
  const targets = '[data-sample="scroll-scene"] :is([data-scene-reveal], [data-scene-reveal-group] > *)';

  test.describe("with reduce motion off", () => {
    test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });

    test("waits hidden below the screen, then rises in and counts once scrolled to", async ({ page }) => {
      await open(page);
      await expect.poll(() => gsapVersions(page)).not.toBeNull();
      // Far below the first screen: hidden (opacity 0) while it waits, the number at 0.
      await expect.poll(() => effectiveOpacities(page, targets)).toEqual([0, 0, 0, 0]);
      const digits = sample(page, "scroll-scene").locator("[data-scene-count]");
      await expect(digits).toHaveText("0");
      await sample(page, "scroll-scene").scrollIntoViewIfNeeded();
      await expect.poll(() => effectiveOpacities(page, targets)).toEqual([1, 1, 1, 1]);
      await expect(digits).toHaveText("5,000");
    });
  });

  test.describe("with reduce motion on", () => {
    test.use({ reducedMotion: "reduce" });

    test("shows everything straight away: nothing waits hidden, the number is final", async ({ page }) => {
      // (GSAP itself is on this page anyway: the motion demo above imports it.
      // The home page's tests check that reduced motion never downloads it.)
      await open(page);
      await page.waitForLoadState("networkidle");
      expect(await effectiveOpacities(page, targets)).toEqual([1, 1, 1, 1]);
      await expect(sample(page, "scroll-scene").locator("[data-scene-count]")).toHaveText("5,000");
    });
  });
});

test.describe("on a phone (375px, touch screen)", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test("touch emulation makes (pointer: coarse) match, so small controls grow", async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
  });

  test("every visible button, button link, field and checkbox row is at least 44px tall; icon buttons are 44px wide", async ({
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
          // A checkbox (CheckboxField) is a 20px box inside a label row at
          // least 44px tall, and the whole row is what a thumb presses: so
          // the row is measured, not the box.
          const target = element.matches('input[type="checkbox"]') ? (element.closest("label") ?? element) : element;
          const box = target.getBoundingClientRect();
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

test.describe("on a tablet (768px, touch screen)", () => {
  test.use({ viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true });

  test("the header sample fits every menu item on one line, without overflowing", async ({ page }) => {
    await open(page);
    const header = sample(page, "header").locator("header");
    const layout = await header.evaluate((element) => {
      const bar = element.firstElementChild as HTMLElement;
      const links = [...element.querySelectorAll("nav a")].map((link) => link.getBoundingClientRect());
      return {
        // --header-height (56px) plus the 1px bottom border: nothing wrapped onto a second line.
        height: element.getBoundingClientRect().height,
        overflows: bar.scrollWidth > bar.clientWidth,
        links: links.length,
        rows: new Set(links.map((box) => Math.round(box.top))).size,
      };
    });
    expect(layout).toEqual({ height: 57, overflows: false, links: 4, rows: 1 });
  });
});

test.describe("on a desktop (1440px, mouse)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the phone bar sample has the same 88px buttons as a real 320px phone", async ({ page }) => {
    await open(page);
    const widths = await sample(page, "action-bar")
      .locator("a")
      .evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().width)));
    expect(widths).toEqual([88, 88, 88]);
  });

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
      // Record the tile's right edge on every animation frame, inside the
      // page. Timing it from the test with waits was flaky on a busy machine:
      // the ease-out curve covers most of the distance early.
      await page.evaluate(() => {
        const tile = document.querySelector("[data-motion-tile]")!;
        const frames: number[] = [];
        (window as unknown as { tileFrames: number[] }).tileFrames = frames;
        const record = () => {
          frames.push(tile.getBoundingClientRect().right);
          if (frames.length < 600) requestAnimationFrame(record);
        };
        requestAnimationFrame(record);
      });
      await page.getByRole("button", { name: "Play" }).click();
      await expect.poll(async () => {
        const end = await positions(page);
        return Math.abs(end.trackEnd - end.tileEnd);
      }).toBeLessThan(1);
      const { trackEnd } = await positions(page);
      const frames = await page.evaluate(() => (window as unknown as { tileFrames: number[] }).tileFrames);
      // It moved gradually: at least two frames caught it partway, not a jump.
      const partway = frames.filter((right) => right > start.tileEnd + 1 && right < trackEnd - 1);
      expect(partway.length).toBeGreaterThanOrEqual(2);
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
    // Reduced motion: a full-page capture doesn't scroll, so the scroll
    // scene demo would still be waiting, hidden, below the first screen.
    test.use({
      viewport: { width: shot.width, height: shot.height },
      hasTouch: shot.touch,
      isMobile: shot.touch,
      reducedMotion: "reduce",
    });

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
