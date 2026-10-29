import { expect, type Page, test } from "@playwright/test";

import messages from "../../messages/en.json";
import { draftServices } from "../../src/server/db/service-seed-data";
import { expectNoErrors, watchErrors } from "../helpers";

// The services pages and /packages under `npm run dev` (task 18), where the
// sample prices and the price finder show: npm run test:design. The
// production build shows neither (e2e/services.spec.ts checks that).

const t = messages.Packages;
const sampleMark = messages.HomePage.sample;

/** The price finder's own result line (the picker has a live region of its own, for screen readers only). */
const results = (page: Page) => page.locator('[data-sample="price-finder"] p[role="status"]:not(.sr-only)');

test("/services: a marked sample From price on each list-priced service", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/services");
  const priced = draftServices.filter((service) => service.kind === "service" && !service.pricedAfterInspection);
  const marks = page.locator('[data-sample="service-price"]');
  await expect(marks).toHaveCount(priced.length);
  await expect(marks.first()).toContainText(/From ₹[\d,]+/);
  await expect(marks.first()).toContainText(sampleMark);
  await expectNoErrors(page, errors);
});

test("a service page: the sample price table, per vehicle kind, marked", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/services/periodic-service");
  const block = page.locator('[data-sample="service-prices"]');
  await expect(block.getByRole("table")).toHaveCount(2);
  await expect(block.getByText(sampleMark, { exact: true })).toBeVisible();
  await expect(block.getByRole("row", { name: /Hatchback/ })).toContainText("Diesel: ₹3,499");
  await expectNoErrors(page, errors);
});

test("/packages: the price finder lists one vehicle's package prices, and an electric one gets none", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/packages");
  const finder = page.locator('[data-sample="price-finder"]');
  await expect(finder.getByRole("heading", { name: new RegExp(t.finder.title) })).toBeVisible();
  await expect(results(page)).toHaveText(t.finder.prompt);

  // Wait for React to take over the picker before choosing (a choice made
  // before hydration is lost: the known gap in the task 17 learning doc).
  await page.waitForLoadState("networkidle");
  await finder.getByRole("combobox", { name: messages.Vehicles.picker.modelLabel }).selectOption("car-honda-city");
  await finder.getByText(messages.Vehicles.fuels.diesel, { exact: true }).click();
  await expect(results(page)).toHaveText("Prices for Honda City, Diesel");
  // The rows under the result line (the picker above holds no list).
  const rows = results(page).locator("xpath=..").getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("Basic service");
  await expect(rows.first()).toContainText("₹3,399");

  // Switching the type clears the Honda car brand, so every two-wheeler model is offered.
  await finder.getByText(messages.Vehicles.kinds.twoWheeler, { exact: true }).click();
  await finder.getByRole("combobox", { name: messages.Vehicles.picker.modelLabel }).selectOption("two-wheeler-ather-rizta");
  await expect(results(page)).toHaveText("Prices for Ather Rizta, Electric");
  await expect(rows).toHaveText(Array(3).fill(new RegExp(t.finder.notOffered)));
  await expectNoErrors(page, errors);
});

test("/packages: each card's price line is a marked sample", async ({ page }) => {
  await page.goto("/packages");
  const prices = page.locator('[data-sample="package-price"]');
  await expect(prices).toHaveCount(6);
  await expect(prices.first()).toContainText("From ₹2,499");
  await expect(prices.first()).toContainText(sampleMark);
});
