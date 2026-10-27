import { expect, type Page } from "@playwright/test";

// Helpers shared by the browser tests: e2e/*.spec.ts (production build) and
// e2e/dev/*.spec.ts (next dev). Not a spec itself, so Playwright doesn't run it.

// Chrome logs this line for every resource that answers 404, with that
// resource's address as the message's location. For a 404 page it logs it
// once for the page itself: that's the browser reporting the status, not an
// error. The same line for anything else (a missing script, font, image...)
// is a real error.
const NOT_FOUND_LINE = "Failed to load resource: the server responded with a status of 404 (Not Found)";

/** Collects console errors and page errors, except Chrome's note about a 404 page's own status. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const { url } = message.location();
    const pagesOwnStatus = message.text() === NOT_FOUND_LINE && url === page.url();
    if (!pagesOwnStatus) errors.push(`${message.text()} (${url})`);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/**
 * Expects no errors, once the page has no requests left in flight: a missing
 * image or script fails, and is logged, after the page itself has loaded.
 */
export async function expectNoErrors(page: Page, errors: string[]) {
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
}

/**
 * The React Server Components data in a page's HTML: the strings Next.js
 * pushes to self.__next_f, decoded and joined.
 */
export function rscPayload(html: string): string {
  return [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)]
    .map(([, literal]) => JSON.parse(literal) as string)
    .join("");
}

/**
 * Starts adding up layout shifts (CLS) before the page's first paint. Call it
 * before page.goto(); read the total with layoutShift(). Shifts right after
 * an input (a click, a key) don't count, as in Google's Core Web Vitals.
 * Transforms never count: moving something with transform isn't a shift.
 */
export async function trackLayoutShift(page: Page) {
  await page.addInitScript(() => {
    const total = { value: 0 };
    (window as unknown as { layoutShift: typeof total }).layoutShift = total;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!entry.hadRecentInput) total.value += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

/** The layout shift added up so far, two frames from now (so the latest shifts are reported). */
export async function layoutShift(page: Page): Promise<number> {
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  return page.evaluate(() => (window as unknown as { layoutShift: { value: number } }).layoutShift.value);
}

/**
 * Prepares a page for a screenshot the owner reviews: Inter, as on Android
 * and Windows (most visitors; this Mac would show San Francisco), and no
 * Next.js dev badge (not part of the page). Waits for the fonts.
 */
export async function showAsMostVisitorsSeeIt(page: Page) {
  await page.addStyleTag({
    content: `:root:root { --font-sans-stack: var(--font-inter), var(--font-devanagari), sans-serif; }
      nextjs-portal { display: none !important; }`,
  });
  await page.evaluate(async () => {
    void document.body.offsetHeight;
    await document.fonts.ready;
  });
}

/** Whether the page is wider than the screen (it scrolls sideways). */
export const scrollsSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

/**
 * The GSAP versions loaded on the page, or null if GSAP never loaded. GSAP
 * adds itself to window.gsapVersions when it starts
 * (node_modules/gsap/gsap-core.js).
 */
export const gsapVersions = (page: Page) =>
  page.evaluate(() => (window as unknown as { gsapVersions?: string[] }).gsapVersions ?? null);

/**
 * How visible each matching element really is: its opacity times every
 * ancestor's, so a link inside a hidden box counts as hidden too.
 * Playwright's toBeVisible() treats opacity 0 as visible, so animated pages
 * check this instead (plan KTD13).
 */
export const effectiveOpacities = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => {
      let opacity = 1;
      for (let node: Element | null = element; node; node = node.parentElement) {
        opacity *= Number(getComputedStyle(node).opacity);
      }
      return opacity;
    }),
  );
