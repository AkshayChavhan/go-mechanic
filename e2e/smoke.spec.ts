import { expect, type Page, test } from "@playwright/test";

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

// The first family name in each next/font variable.
async function fontFamilies(page: Page) {
  const variables = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return { inter: root.getPropertyValue("--font-inter"), devanagari: root.getPropertyValue("--font-devanagari") };
  });
  return { inter: firstFamily(variables.inter), devanagari: firstFamily(variables.devanagari) };
}

// The font file paths of every @font-face rule on the page, by family name.
function fontFilesByFamily(page: Page) {
  return page.evaluate(() => {
    const files: Record<string, string[]> = {};
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        const family = rule.style.getPropertyValue("font-family").replace(/["']/g, "");
        const urls = [...rule.style.getPropertyValue("src").matchAll(/url\(["']?([^"')]+)/g)];
        // A url() in CSS is relative to the stylesheet's own address, not the page's.
        const base = sheet.href ?? location.href;
        files[family] = [...(files[family] ?? []), ...urls.map(([, url]) => new URL(url, base).pathname)];
      }
    }
    return files;
  });
}

// The path of every file the page has downloaded so far.
function downloadedFiles(page: Page) {
  return page.evaluate(() => performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname));
}

// The faces of one family the browser has downloaded and used ("loaded").
function loadedFaces(page: Page, family: string) {
  return page.evaluate(
    (family) =>
      [...document.fonts]
        .filter((face) => face.family.replace(/["']/g, "") === family && face.status === "loaded")
        .map((face) => ({ unicodeRange: face.unicodeRange })),
    family,
  );
}

// Whether a unicode-range such as "U+0-FF, U+20B9, U+1F??" covers a character.
// In "U+1F??" each ? stands for any hex digit (U+1F00 to U+1FFF).
function covers(unicodeRange: string, codePoint: number) {
  return unicodeRange.split(",").some((part) => {
    const [start, end = start] = part.trim().replace(/^U\+/i, "").split("-");
    const low = parseInt(start.replace(/\?/g, "0"), 16);
    const high = parseInt(end.replace(/\?/g, "F"), 16);
    return codePoint >= low && codePoint <= high;
  });
}

test("Inter is preloaded; the Hindi font is neither preloaded nor downloaded on an English page", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  const { inter, devanagari } = await fontFamilies(page);
  const files = await fontFilesByFamily(page);
  const interFiles = files[inter] ?? [];
  const devanagariFiles = files[devanagari] ?? [];
  // Both fonts are on the page; otherwise the checks below would prove nothing.
  expect(interFiles.length).toBeGreaterThan(0);
  expect(devanagariFiles.length).toBeGreaterThan(0);

  const preloaded = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]')].map(
      (link) => new URL(link.href).pathname,
    ),
  );
  expect(preloaded.length).toBeGreaterThan(0);
  for (const file of preloaded) expect(interFiles).toContain(file);

  const downloaded = await downloadedFiles(page);
  for (const file of devanagariFiles) expect(downloaded).not.toContain(file);
  expect(await loadedFaces(page, devanagari)).toEqual([]);
});

test("a price (₹) is drawn in Inter, so it never downloads the Hindi font", async ({ page }) => {
  // Assumption A3: Inter's latin-ext face covers the rupee sign (U+20B9) and
  // loads only when a ₹ appears. Noto Sans Devanagari covers ₹ too, so if Inter
  // didn't, every price on an English page would download the Hindi font.
  await page.goto("/");
  const { inter, devanagari } = await fontFamilies(page);
  // Draw a price the way Android and Windows do: the text stack without
  // Apple's system font. On a Mac, San Francisco would draw it and prove nothing.
  await page.evaluate(() => {
    const stack = getComputedStyle(document.documentElement).getPropertyValue("--font-sans-stack");
    const price = document.createElement("p");
    price.style.fontFamily = stack.replace(/-apple-system,\s*BlinkMacSystemFont,\s*/, "");
    price.textContent = "₹1,499";
    document.body.append(price);
  });

  // An Inter face whose unicode-range covers ₹ gets loaded...
  await expect
    .poll(async () => (await loadedFaces(page, inter)).some((face) => covers(face.unicodeRange, 0x20b9)))
    .toBe(true);
  // ...and none of the Hindi font's files are downloaded.
  await page.evaluate(() => document.fonts.ready);
  const devanagariFiles = (await fontFilesByFamily(page))[devanagari] ?? [];
  expect(devanagariFiles.length).toBeGreaterThan(0);
  const downloaded = await downloadedFiles(page);
  for (const file of devanagariFiles) expect(downloaded).not.toContain(file);
});

test("the Hindi font loads when Devanagari text needs it", async ({ page }) => {
  await page.goto("/");
  const { devanagari } = await fontFamilies(page);
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
