import { expect, type Page, test } from "@playwright/test";

import messages from "../messages/en.json";

import { expectNoErrors, logInThroughTheForm, watchErrors } from "./helpers";

// Task 32 on the production build: a guest is asked to log in; a customer
// asks for a free estimate with the picker and one photo (resized in the
// browser, uploaded to the fake photo storage, checked by the server) and
// finds the request at the top of /account.
//
// - Each test logs in a fresh number (freshNumber()): parallel tests share
//   one database.
// - expectNoErrors only on each test's first page load; after that, the
//   collected errors are checked directly
//   (document/solutions/conventions/playwright-networkidle-hangs-after-second-page-load.md).
// - Next.js keeps pages you leave in the DOM, hidden (<Activity>), so
//   locators are visibility-aware.

const page_ = messages.EstimatePage;
const mine = messages.MyEstimates;
const account = messages.Account;
const uploader = messages.Photos.uploader;
const phone = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" as const };

test.use(phone);

/** The errors, without Chrome's 404 for /favicon.ico (task 42 adds the icon; see e2e/account.spec.ts). */
const withoutFaviconProbe = (errors: string[]) => errors.filter((error) => !error.includes("/favicon.ico"));

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });

/** A small real JPEG, drawn on a canvas in the page: the uploader only takes what a browser can open. */
async function jpeg(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 48;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#c0392b";
    context.fillRect(0, 0, 64, 48);
    return canvas.toDataURL("image/jpeg", 0.9).split(",")[1]!;
  });
  return Buffer.from(base64, "base64");
}

test("a guest sees what the estimate is and a link to log in, but no form", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/estimate");
  await expectNoErrors(page, errors);
  await expect(page.getByRole("heading", { level: 1, name: page_.heading })).toBeVisible();
  await expect(page.getByText(page_.loginNote)).toBeVisible();
  await expect(page.getByRole("link", { name: page_.loginLink, exact: true })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("button", { name: page_.submit })).toHaveCount(0);
});

test("a customer asks for an estimate with the picker and a photo, and finds it at the top of their account", async ({ page }) => {
  const errors = watchErrors(page);
  await logInThroughTheForm(page);
  await expectNoErrors(page, errors);
  await field(page, account.nameLabel).fill("Asha Patil");
  await page.getByRole("button", { name: account.nameSubmit }).click();
  await expect(page.getByText(mine.empty)).toBeVisible();

  await page.getByRole("link", { name: mine.requestLink }).click();
  await expect(page).toHaveURL(/\/estimate$/);
  await expect(page.getByRole("button", { name: page_.submit })).toBeVisible();

  // No saved vehicle: only the picker.
  await page.getByRole("combobox", { name: messages.Vehicles.picker.modelLabel }).selectOption("car-honda-city");
  await page.locator("form").filter({ visible: true }).getByText(messages.Vehicles.fuels.petrol, { exact: true }).click();

  // Too short first: the error, with everything kept.
  await field(page, page_.descriptionLabel).fill("Noise");
  await page.getByRole("button", { name: page_.submit }).click();
  await expect(page.getByText(page_.errors["description-too-short"])).toBeVisible();
  await expect(field(page, page_.descriptionLabel)).toHaveValue("Noise");

  // A photo: picked, Send waits; uploaded, Send is free again.
  await page.locator('input[type="file"]').setInputFiles({ name: "dent.jpg", mimeType: "image/jpeg", buffer: await jpeg(page) });
  await expect(page.getByText(page_.waitingForPhotos)).toBeVisible();
  await expect(page.getByRole("button", { name: page_.submit })).toBeDisabled();
  await page.getByRole("button", { name: uploader.upload }).click();
  await expect(page.getByText(uploader.stored, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: page_.submit })).toBeEnabled();

  const description = "Brakes squeal when I stop, mostly in the morning.";
  await field(page, page_.descriptionLabel).fill(description);
  await page.getByRole("button", { name: page_.submit }).click();

  await expect(page).toHaveURL(/\/account$/);
  const card = page.getByRole("listitem").filter({ hasText: description });
  await expect(card.getByRole("heading", { level: 3, name: "Honda City" })).toBeVisible();
  await expect(card.getByText(mine.waiting)).toBeVisible();
  await expect(card.getByText("1 photo", { exact: true })).toBeVisible();
  // The requests come before the vehicles, so the new one shows first.
  const headings = await page.getByRole("heading", { level: 2 }).filter({ visible: true }).allTextContents();
  expect(headings.indexOf(mine.heading)).toBeLessThan(headings.indexOf(messages.MyVehicles.listHeading));
  expect(withoutFaviconProbe(errors)).toEqual([]);
});
