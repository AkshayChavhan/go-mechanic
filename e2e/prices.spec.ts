import { expect, type Page, test } from "@playwright/test";

import messages from "../messages/en.json";

import { expectNoErrors, logInThroughTheForm, TEST_OWNER_NUMBER, watchErrors } from "./helpers";

// The staff price editor (task 39) on the production build: the owner saves a
// real price, and the public pages show it at once (updateTag), still built
// ahead of time; then the owner clears it again.
//
// This spec saves data every other spec reads (they expect no real price), so
// it runs in its own Playwright project, "prices", after all of them
// (playwright.config.ts). It logs the test owner in a second time in the run
// (admin.spec.ts is the first): 2 of the 5 codes an hour for that number.
//
// - expectNoErrors only on the first page load
//   (document/solutions/conventions/playwright-networkidle-hangs-after-second-page-load.md).
// - Next.js keeps pages you leave in the DOM, hidden, so locators are
//   visibility-aware (getByRole, or filter({ visible: true })).

test.describe.configure({ mode: "serial" });

const t = messages.AdminPrices;
const phone = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" as const };

test.use(phone);

const hatchback = (page: Page) => page.getByRole("region", { name: "Hatchback" }).filter({ visible: true });

/** The public service page's car table row for hatchbacks, read logged out. */
async function publicHatchbackPrices(page: Page): Promise<string> {
  await page.goto("/services/periodic-service");
  return (await page.getByRole("table", { name: messages.HomePage.services.vehicles.car }).getByRole("row", { name: /Hatchback/ }).textContent()) ?? "";
}

test("the owner saves a hatchback price and a diesel price; the public pages show them at once, still built ahead of time; clearing them takes them off", async ({
  page,
  browser,
}) => {
  const errors = watchErrors(page);
  await logInThroughTheForm(page, TEST_OWNER_NUMBER);
  await expectNoErrors(page, errors);

  await page.goto("/admin/prices");
  await expect(page.getByRole("heading", { level: 1, name: t.heading })).toBeVisible();
  await page.getByRole("link", { name: /^Periodic service/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Periodic service" })).toBeVisible();

  const card = hatchback(page);
  await card.getByLabel(t.groupLabel).fill("1,500");
  await card.getByText(t.fuelsSummary).click();
  await card.getByLabel("Diesel").fill("1800");
  await card.getByRole("button", { name: "Save Hatchback prices" }).click();
  const saved = card.getByRole("status");
  await expect(saved).toContainText(t.saved);
  await expect(saved).toContainText("Petrol: ₹1,500");
  await expect(saved).toContainText("Diesel: ₹1,800");
  await expect(card.getByLabel("Diesel")).toHaveValue("1,800");

  // A visitor, logged out.
  const visitor = await browser.newContext(phone);
  const site = await visitor.newPage();
  const response = await site.request.get("/services/periodic-service", { maxRedirects: 0 });
  // Next.js 16.4 sends this header twice ("1, 1"): still built ahead of time after the save.
  expect(response.headers()["x-nextjs-prerender"]).toMatch(/^1(, 1)*$/);
  const row = await publicHatchbackPrices(site);
  expect(row).toContain("Petrol: ₹1,500");
  expect(row).toContain("Diesel: ₹1,800");
  await site.goto("/services");
  const tile = site.locator('[data-slot="card"]').filter({ has: site.getByRole("link", { name: "Periodic service" }) });
  await expect(tile).toContainText("From ₹1,500");

  // The owner clears both boxes: no price again.
  await card.getByLabel(t.groupLabel).fill("");
  await card.getByLabel("Diesel").fill("");
  await card.getByRole("button", { name: "Save Hatchback prices" }).click();
  await expect(card.getByRole("status")).toContainText(t.savedNone);

  await site.goto("/services/periodic-service");
  await expect(site.getByText(messages.Services.price.callForPrice)).toBeVisible();
  await expect(site.getByRole("main")).not.toContainText("₹");
  await visitor.close();
});
