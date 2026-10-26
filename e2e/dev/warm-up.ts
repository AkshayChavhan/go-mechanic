import { chromium, type FullConfig } from "@playwright/test";

// Runs once before the dev specs (globalSetup in playwright.dev.config.ts),
// after the dev server is up.
//
// `next dev` compiles each page the first time it's asked for. When that
// happens while a test has another page open, the dev server can push the
// fresh code into that open page, and React remounts its components. Seen in
// task 12: the motion demo's tile jumped back to the start between Play and
// the measurement, on the first run after a code change. So every page the
// specs visit is loaded once here, in a real browser (which also compiles
// the page's JavaScript), before any test runs.
const pages = ["/dev/design", "/", "/this-page-does-not-exist"];

export default async function warmUp(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL;
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const page = await browser.newPage();
    for (const path of pages) {
      await page.goto(new URL(path, baseURL).href, { timeout: 180_000 });
      await page.waitForLoadState("networkidle", { timeout: 180_000 });
    }
  } finally {
    await browser.close();
  }
}
