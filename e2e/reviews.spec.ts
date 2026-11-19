import { expect, test } from "@playwright/test";

import messages from "../messages/en.json";

import { expectNoErrors, logInThroughTheForm, watchErrors } from "./helpers";

// Task 37 on the production build. A test can't make a completed job here
// (there's no staff page to move one yet, and each `next start` has its own
// fresh database), so writing a review and the 3-review home page are proven
// in Vitest (src/server/dal/reviews.test.ts, the home page test). These check
// what a visitor and a customer can reach today.

const reviewsPage = messages.ReviewsPage;
const reviewPage = messages.ReviewPage;
const account = messages.Account;
const SOME_BOOKING = "6f1c1f0e-8a7c-4c1e-9d55-0b7a2a8c1e11";

/** The errors, without Chrome's 404 for /favicon.ico (task 42 adds the icon; see e2e/account.spec.ts). */
const withoutFaviconProbe = (errors: string[]) => errors.filter((error) => !error.includes("/favicon.ico"));

test("/reviews: its title and, with no reviews yet, the empty state and how to leave one", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/reviews");
  await expectNoErrors(page, errors);
  await expect(page).toHaveTitle("Customer reviews | GoMechanic");
  await expect(page.getByRole("heading", { level: 1, name: reviewsPage.heading })).toBeVisible();
  await expect(page.getByText(reviewsPage.empty)).toBeVisible();
  await expect(page.getByText(reviewsPage.howTo)).toBeVisible();
});

test("the review page, logged out, is a real 307 to /login", async ({ page }) => {
  const response = await page.request.get(`/account/reviews/${SOME_BOOKING}`, { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toMatch(/\/login$/);
});

test("a customer opening a booking that isn't theirs (or doesn't exist) sees a note, not the form", async ({ page }) => {
  const errors = watchErrors(page);
  await logInThroughTheForm(page);
  await expectNoErrors(page, errors);
  await page.getByLabel(account.nameLabel, { exact: true }).filter({ visible: true }).fill("Asha Patil");
  await page.getByRole("button", { name: account.nameSubmit }).click();
  await expect(page.getByText("Hello, Asha Patil.")).toBeVisible();

  await page.goto(`/account/reviews/${SOME_BOOKING}`);
  await expect(page.getByRole("heading", { level: 1, name: reviewPage.heading })).toBeVisible();
  await expect(page.getByText(reviewPage.notFound)).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  expect(withoutFaviconProbe(errors)).toEqual([]);
});
