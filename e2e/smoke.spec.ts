import { expect, test } from "@playwright/test";

// Smoke test: the most basic "is the site alive?" check in a real browser.

test("home page loads with its heading", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("GoMechanic");
});

test("the page language is English", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("text uses the sans-serif theme font, not the browser default", async ({ page }) => {
  // Guards a past mistake: if --font-sans doesn't connect, browsers fall back
  // to a serif font such as Times.
  await page.goto("/");
  const fontFamily = await page.locator("body").evaluate((el) => getComputedStyle(el).fontFamily);
  expect(fontFamily).toContain("Geist");
  expect(fontFamily.toLowerCase()).not.toContain("times");
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
