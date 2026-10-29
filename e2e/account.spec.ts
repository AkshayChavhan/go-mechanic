import { expect, type Page, test } from "@playwright/test";

import messages from "../messages/en.json";

import { expectNoErrors, logInThroughTheForm, watchErrors } from "./helpers";

// Task 21 on the production build: the name step, adding vehicles, the list,
// and what a second customer on the same phone sees.
//
// - Each test logs in fresh numbers (freshNumber()), and registration
//   numbers are random: parallel tests share one database.
// - expectNoErrors only on each test's first page load; after that, the
//   collected errors are checked directly (a second page load never lets the
//   network go quiet in Playwright's eyes:
//   document/solutions/conventions/playwright-networkidle-hangs-after-second-page-load.md).
// - Next.js keeps pages you leave in the DOM, hidden (<Activity>), so
//   locators are visibility-aware: getByRole, or getByLabel filtered to
//   visible elements.

const account = messages.Account;
const vehicles = messages.MyVehicles;
const picker = messages.Vehicles.picker;
const phone = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" as const };

test.use(phone);

/** "MH 12 AB 4821": a valid state-series number no other test uses (probably). */
function randomRegistration(): { typed: string; shown: string } {
  const digits = String(Math.floor(Math.random() * 10_000)).padStart(4, "0");
  return { typed: `mh-12 ab ${digits}`, shown: `MH 12 AB ${digits}` };
}

/**
 * The errors, without Chrome's 404 for /favicon.ico. The site has icon.svg
 * but no favicon.ico yet (task 42 adds the icons), and in these longer flows
 * Chrome sometimes asks for /favicon.ico after a page change: in a different
 * test on each full run of task 21. Every other error still fails the test.
 */
const withoutFaviconProbe = (errors: string[]) => errors.filter((error) => !error.includes("/favicon.ico"));

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });

/** Saves `name` in the name form on /account and waits for the account to show it. */
async function giveName(page: Page, name: string) {
  await field(page, account.nameLabel).fill(name);
  await page.getByRole("button", { name: account.nameSubmit }).click();
  await expect(page.getByRole("heading", { level: 2, name: vehicles.listHeading })).toBeVisible();
}

/** Opens the add page from /account's link and waits for its form. */
async function openAddPage(page: Page) {
  await page.getByRole("link", { name: vehicles.addLink }).click();
  await expect(page).toHaveURL(/\/account\/vehicles\/new$/);
  await expect(page.getByRole("heading", { level: 1, name: vehicles.formHeading })).toBeVisible();
}

/** Picks a model and a fuel in the add form, and types a registration number. */
async function fillVehicle(page: Page, { model, fuel, registration }: { model: string; fuel: string; registration: string }) {
  await page.getByRole("combobox", { name: picker.modelLabel }).selectOption(model);
  // The radios are visually hidden inside their pills: press the pill.
  await page.locator("form").filter({ visible: true }).getByText(fuel, { exact: true }).click();
  await field(page, vehicles.registrationLabel).fill(registration);
}

/** Presses "Save vehicle". It must be clickable above the phone action bar (Playwright refuses a covered button). */
async function save(page: Page) {
  await page.getByRole("button", { name: vehicles.submit }).click();
}

test("a new customer gives their name once, adds a vehicle, sees it listed, and the add form starts empty again", async ({ page }) => {
  const errors = watchErrors(page);
  const number = await logInThroughTheForm(page);
  await expectNoErrors(page, errors);

  // The name step, under the "Logged in as" line.
  await expect(page.getByText(account.signedInAs.replace("{number}", `+91 ${number.typed}`))).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: account.nameHeading })).toBeVisible();
  await field(page, account.nameLabel).fill("A");
  await page.getByRole("button", { name: account.nameSubmit }).click();
  await expect(page.getByText(account.nameErrors["name-too-short"])).toBeVisible();
  await expect(field(page, account.nameLabel)).toHaveValue("A");

  await giveName(page, "Asha Patil");
  await expect(page.getByText(account.greeting.replace("{name}", "Asha Patil"))).toBeVisible();
  await expect(page.getByText(account.signedInAs.replace("{number}", `+91 ${number.typed}`))).toBeVisible();
  await expect(page.getByText(vehicles.empty)).toBeVisible();

  // Add a petrol Honda City, typed the messy way, with a PUC date.
  const registration = randomRegistration();
  await openAddPage(page);
  await fillVehicle(page, { model: "car-honda-city", fuel: messages.Vehicles.fuels.petrol, registration: registration.typed });
  await field(page, vehicles.pucLabel).fill("2027-03-12");
  await save(page);

  await expect(page).toHaveURL(/\/account$/);
  const card = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3, name: "Honda City" }) });
  await expect(card.getByText(registration.shown, { exact: true })).toBeVisible();
  await expect(card.getByText(vehicles.pucUntil.replace("{date}", "12 Mar 2027"))).toBeVisible();
  await expect(card.getByText(vehicles.insuranceMissing)).toBeVisible();

  // Back to the add page: empty again, not the last vehicle.
  await openAddPage(page);
  await expect(page.getByRole("combobox", { name: picker.modelLabel })).toHaveValue("");
  await expect(field(page, vehicles.registrationLabel)).toHaveValue("");
  await expect(field(page, vehicles.pucLabel)).toHaveValue("");
  expect(withoutFaviconProbe(errors)).toEqual([]);
});

test("a refused number keeps the chosen model and fuel; fixing only the number saves that vehicle", async ({ page }) => {
  const errors = watchErrors(page);
  await logInThroughTheForm(page);
  await expectNoErrors(page, errors);
  await giveName(page, "Ravi Kumar");
  await openAddPage(page);

  await fillVehicle(page, { model: "car-honda-city", fuel: messages.Vehicles.fuels.diesel, registration: "MX 12 AB 1234" });
  await save(page);
  await expect(page.getByText(vehicles.errors["registration-unknown-state"])).toBeVisible();
  await expect(page.getByRole("combobox", { name: picker.modelLabel })).toHaveValue("car-honda-city");
  await expect(page.getByRole("radio", { name: messages.Vehicles.fuels.diesel })).toBeChecked();
  await expect(field(page, vehicles.registrationLabel)).toHaveAttribute("aria-invalid", "true");

  const registration = randomRegistration();
  await field(page, vehicles.registrationLabel).fill(registration.typed);
  await save(page);
  await expect(page).toHaveURL(/\/account$/);
  const card = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3, name: "Honda City" }) });
  await expect(card.getByText(messages.Vehicles.fuels.diesel, { exact: true })).toBeVisible();
  await expect(card.getByText(registration.shown, { exact: true })).toBeVisible();
  expect(withoutFaviconProbe(errors)).toEqual([]);
});

test("on a shared phone, the next customer gets their own empty forms, none of the first one's vehicles, and may save the same number", async ({ page }) => {
  const errors = watchErrors(page);
  await logInThroughTheForm(page);
  await expectNoErrors(page, errors);
  await giveName(page, "Asha Patil");
  const registration = randomRegistration();
  await openAddPage(page);
  await fillVehicle(page, { model: "car-honda-city", fuel: messages.Vehicles.fuels.petrol, registration: registration.typed });
  await save(page);
  await expect(page.getByText(registration.shown, { exact: true })).toBeVisible();

  // A starts another vehicle, leaves it unsaved, and logs out.
  await openAddPage(page);
  await field(page, vehicles.registrationLabel).fill("KA 01 AB 0001");
  await page.getByRole("link", { name: vehicles.backLink }).click();
  await page.getByRole("button", { name: account.logOut }).click();
  await expect(page).toHaveURL(/\/$/);

  // B, on the same phone.
  await logInThroughTheForm(page);
  await expect(field(page, account.nameLabel)).toHaveValue("");
  await giveName(page, "Ravi Kumar");
  await expect(page.getByText(vehicles.empty)).toBeVisible();
  await expect(page.getByText(registration.shown, { exact: true })).toHaveCount(0);

  await openAddPage(page);
  await expect(field(page, vehicles.registrationLabel)).toHaveValue("");

  // The same number as A's: two customers may each save it.
  await fillVehicle(page, { model: "car-honda-city", fuel: messages.Vehicles.fuels.petrol, registration: registration.typed });
  await save(page);
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(registration.shown, { exact: true })).toBeVisible();
  expect(withoutFaviconProbe(errors)).toEqual([]);
});

test("a customer without a name who opens the add page ends on /account, at the name form", async ({ page }) => {
  const errors = watchErrors(page);
  await logInThroughTheForm(page);
  await expectNoErrors(page, errors);
  await page.goto("/account/vehicles/new");
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { level: 2, name: account.nameHeading })).toBeVisible();
  expect(withoutFaviconProbe(errors)).toEqual([]);
});

test("logged out, the header's Account link leads to the login page", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await expectNoErrors(page, errors);
  await page.getByRole("banner").getByRole("link", { name: account.headerLink }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1, name: messages.Login.heading })).toBeVisible();
});
