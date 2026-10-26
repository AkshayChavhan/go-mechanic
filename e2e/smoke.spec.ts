import { expect, test } from "@playwright/test";

import messages from "../messages/en.json";

// Smoke test: the most basic "is the site alive?" check in a real browser.

test("home page loads with its heading", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.HomePage.title);
});

test("the page language is English", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

// Fonts (src/app/fonts.ts and --font-sans-stack in src/app/globals.css).
// Browsers drop quotes around simple names (`'Inter'` becomes `Inter`), so
// font lists are compared without quotes and spaces.
const names = (list: string) => list.replace(/["'\s]/g, "");
// Chrome on a Mac reports BlinkMacSystemFont as system-ui. That alias is
// Mac-only in Chromium, so on Android and Windows the name is skipped and Inter
// is used, as planned. The raw --font-sans-stack keeps the name as written.
const computedNames = (list: string) => names(list).replace("BlinkMacSystemFont", "system-ui");
// The first family in a next/font variable: `'Inter', 'Inter Fallback'` -> `Inter`.
const firstFamily = (list: string) => list.split(",")[0].replace(/["']/g, "").trim();

// The 404 page has its own <html> (global-not-found.tsx), so it must load the
// fonts too. Checking it guards that file forgetting the font classes.
for (const path of ["/", "/this-page-does-not-exist"]) {
  test(`text on ${path} uses San Francisco on Apple devices and Inter elsewhere`, async ({ page }) => {
    await page.goto(path);
    const fonts = await page.locator("body").evaluate((body) => {
      const root = getComputedStyle(document.documentElement);
      return {
        body: getComputedStyle(body).fontFamily,
        stack: root.getPropertyValue("--font-sans-stack").trim(),
        inter: root.getPropertyValue("--font-inter").trim(),
        devanagari: root.getPropertyValue("--font-devanagari").trim(),
      };
    });
    // Empty if a next/font variable is missing: the whole stack becomes
    // invalid and browsers fall back to a serif font such as Times.
    expect(fonts.stack).not.toBe("");
    expect(computedNames(fonts.body)).toBe(computedNames(fonts.stack));
    expect(fonts.body.toLowerCase()).not.toContain("times");
    // Apple's system font first: -apple-system (Safari), BlinkMacSystemFont (Chrome).
    expect(names(fonts.stack)).toMatch(/^-apple-system,BlinkMacSystemFont,/);
    // Then Inter, before the Hindi font, so other devices draw English in Inter.
    expect(fonts.inter).not.toBe("");
    expect(fonts.devanagari).not.toBe("");
    const stack = names(fonts.stack);
    expect(stack).toContain(names(fonts.inter));
    expect(stack.indexOf(names(fonts.inter))).toBeLessThan(stack.indexOf(names(fonts.devanagari)));
  });
}

test("Inter is preloaded; the Hindi font is neither preloaded nor downloaded on an English page", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const families = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      inter: root.getPropertyValue("--font-inter").trim(),
      devanagari: root.getPropertyValue("--font-devanagari").trim(),
    };
  });
  const inter = firstFamily(families.inter);
  const devanagari = firstFamily(families.devanagari);

  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    // The font file URLs of every @font-face rule, by family name. A url() in
    // CSS is relative to the stylesheet's own address, not the page's.
    const files: Record<string, string[]> = {};
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        const family = rule.style.getPropertyValue("font-family").replace(/["']/g, "");
        const urls = [...rule.style.getPropertyValue("src").matchAll(/url\(["']?([^"')]+)/g)];
        const base = sheet.href ?? location.href;
        files[family] = [...(files[family] ?? []), ...urls.map(([, url]) => new URL(url, base).pathname)];
      }
    }
    return {
      files,
      preloaded: [...document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]')].map(
        (link) => new URL(link.href).pathname,
      ),
      downloaded: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
      // "loaded" means the browser downloaded and used that face.
      faceStatuses: [...document.fonts].map((face) => ({
        family: face.family.replace(/["']/g, ""),
        status: face.status,
      })),
    };
  });

  const interFiles = fonts.files[inter] ?? [];
  const devanagariFiles = fonts.files[devanagari] ?? [];
  // Both fonts are on the page; otherwise the checks below would prove nothing.
  expect(interFiles.length).toBeGreaterThan(0);
  expect(devanagariFiles.length).toBeGreaterThan(0);

  expect(fonts.preloaded.length).toBeGreaterThan(0);
  for (const file of fonts.preloaded) expect(interFiles).toContain(file);
  for (const file of devanagariFiles) expect(fonts.downloaded).not.toContain(file);

  const devanagariFaces = fonts.faceStatuses.filter((face) => face.family === devanagari);
  expect(devanagariFaces.length).toBeGreaterThan(0);
  expect(devanagariFaces.map((face) => face.status)).not.toContain("loaded");
});

test("the Hindi font loads when Devanagari text needs it", async ({ page }) => {
  await page.goto("/");
  const devanagari = firstFamily(
    await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--font-devanagari")),
  );
  // Asks the browser for the font as a Hindi page would ("namaste").
  const loaded = await page.evaluate(
    (family) => document.fonts.load(`16px "${family}"`, "नमस्ते").then((faces) => faces.map((face) => face.status)),
    devanagari,
  );
  expect(loaded.length).toBeGreaterThan(0);
  expect(loaded.every((status) => status === "loaded")).toBe(true);
});

test("no errors in the browser console", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});
