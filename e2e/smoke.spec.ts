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

test("text uses the theme font (--font-sans), not the browser default", async ({ page }) => {
  // Guards a past mistake: if --font-sans doesn't connect, browsers fall back
  // to a serif font such as Times. Compares with the variable itself, so it
  // keeps working when task 11 changes the font.
  await page.goto("/");
  const { fontFamily, fontSans } = await page.locator("body").evaluate((el) => ({
    fontFamily: getComputedStyle(el).fontFamily,
    fontSans: getComputedStyle(document.documentElement).getPropertyValue("--font-sans").trim(),
  }));
  // Browsers drop quotes around simple names (`"Geist"` becomes `Geist`), so
  // compare the font names without quotes and spaces.
  const names = (list: string) => list.replace(/["'\s]/g, "");
  expect(fontSans).not.toBe("");
  expect(names(fontFamily)).toBe(names(fontSans));
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
