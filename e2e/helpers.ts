import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { expect, type Page } from "@playwright/test";

import messages from "../messages/en.json";

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

// --- Login codes (task 15) ----------------------------------------------------
//
// The production build the tests run has no /dev/outbox page. Instead,
// playwright.config.ts sets E2E_OUTBOX_FILE for its server, and the fake SMS
// provider adds every message to that file as one JSON line. The server
// refuses that setting outside local runs (src/server/env.ts), so this path
// can never work on a deployment.

/** The fake SMS provider's file. Outside test-results/, which a filtered run empties. */
export const OUTBOX_FILE = path.join(os.tmpdir(), "gomechanic-e2e-outbox.jsonl");

type OutboxLine = { to: string; text: string; sentAt: string };

/** The SMS sent to `number` (E.164) since `since`, oldest first. The file outlives runs, so `since` matters. */
export function smsSentTo(number: string, since: Date): OutboxLine[] {
  if (!existsSync(OUTBOX_FILE)) return [];
  return readFileSync(OUTBOX_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as OutboxLine)
    .filter((line) => line.to === number && new Date(line.sentAt) >= since);
}

/** The code in the newest SMS to `number` since `since`; waits up to 10 s for it. */
export async function latestCodeFor(number: string, since: Date): Promise<string> {
  let code: string | undefined;
  await expect
    .poll(
      () => {
        code = /^(\d{6}) /.exec(smsSentTo(number, since).at(-1)?.text ?? "")?.[1];
        return code;
      },
      { timeout: 10_000 },
    )
    .toBeDefined();
  return code as string;
}

/**
 * A mobile number no other test (or earlier run) uses: "60000" and 5 random
 * digits. Indian mobiles start with 6 to 9, so it passes the checks, and the
 * 60000 prefix makes test users easy to spot in a database.
 */
export function freshNumber(): { typed: string; e164: string } {
  const rest = String(Math.floor(Math.random() * 100_000)).padStart(5, "0");
  return { typed: `60000 ${rest}`, e164: `+9160000${rest}` };
}

/**
 * Logs a fresh number in through the real /login form (codes from the fake
 * SMS provider's file) and waits for /account. Returns the number.
 */
export async function logInThroughTheForm(page: Page): Promise<{ typed: string; e164: string }> {
  const t = messages.Login;
  const number = freshNumber();
  const since = new Date();
  await page.goto("/login");
  await page.getByLabel(t.phoneLabel, { exact: true }).fill(number.typed);
  await page.getByLabel(t.ageLabel).check();
  await page.getByLabel(t.consentLabel.replace("{brand}", messages.Brand.name)).check();
  await page.getByRole("button", { name: t.sendCode }).click();
  await page.getByLabel(t.codeLabel).fill(await latestCodeFor(number.e164, since));
  await page.getByRole("button", { name: t.logIn, exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  return number;
}
