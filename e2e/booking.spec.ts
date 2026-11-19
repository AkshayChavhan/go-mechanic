import { expect, type Locator, type Page, test } from "@playwright/test";

import messages from "../messages/en.json";
import { BOOKING_CODE_ALPHABET } from "../src/domain/bookings";
import { telHref } from "../src/lib/contact-links";
import { ownerGarage } from "../src/server/db/seed-data";

import { expectNoErrors, freshNumber, latestCodeFor, logInThroughTheForm, watchErrors } from "./helpers";

// Booking a service on /book (task 47), on the production build.
//
// - The build's database is a fresh in-memory one per server start: the
//   garage, its slot rules (1-hour slots, 2 places each, from tomorrow), the
//   catalogue and the services, but no real prices yet.
// - Tests run in parallel against that one database, so each uses its own
//   phone number (freshNumber()) and a random registration, and picks a day
//   and a time at random: if every test took the first free slot, they would
//   fill it and fail each other. "Full" is proved in the unit tests instead.
// - expectNoErrors only on each test's first page load; after that, the
//   collected errors are checked directly
//   (document/solutions/conventions/playwright-networkidle-hangs-after-second-page-load.md).
// - Next.js keeps pages you leave in the DOM, hidden, so locators are
//   visibility-aware (getByRole, or filter({ visible: true })).

const booking = messages.Booking;
const wizard = booking.wizard;
const login = messages.Login;
const account = messages.Account;
const vehicles = messages.MyVehicles;
const picker = messages.Vehicles.picker;
const phone = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" as const };

test.use(phone);

/** A booking code as the done screen shows it: "K7Q-4MX". */
const CODE_SHAPE = new RegExp(`^[${BOOKING_CODE_ALPHABET}]{3}-[${BOOKING_CODE_ALPHABET}]{3}$`);

/** "MH 12 AB 4821": a valid number no other test uses (probably). */
function randomRegistration(): { typed: string; shown: string } {
  const digits = String(Math.floor(Math.random() * 10_000)).padStart(4, "0");
  return { typed: `mh 12 ab ${digits}`, shown: `MH 12 AB ${digits}` };
}

/** As in account.spec.ts: Chrome sometimes asks for the missing /favicon.ico after a page change (task 42 adds it). */
const withoutFaviconProbe = (errors: string[]) => errors.filter((error) => !error.includes("/favicon.ico"));

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });
const stepHeading = (page: Page, name: string) => page.getByRole("heading", { level: 2, name });
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

/** The pill around a visually hidden radio: what a finger presses. */
const pill = (radio: Locator) => radio.locator("xpath=..");

/** Presses Continue, which must be enabled and uncovered (Playwright refuses a covered button), and waits for `next`. */
async function continueTo(page: Page, next: string) {
  await button(page, wizard.continue).click();
  await expect(stepHeading(page, next)).toBeVisible();
}

/** Step 1 for a vehicle typed in: a Honda City, the given fuel, and a random registration. */
async function typeVehicle(page: Page, fuel: string = messages.Vehicles.fuels.petrol) {
  const registration = randomRegistration();
  await expect(stepHeading(page, wizard.steps.vehicle)).toBeVisible();
  await page.getByRole("combobox", { name: picker.modelLabel }).selectOption("car-honda-city");
  await pill(page.getByRole("radio", { name: fuel, exact: true })).click();
  await field(page, wizard.registrationLabel).fill(registration.typed);
  await continueTo(page, wizard.steps.services);
  return registration;
}

/** Step 2: the first two services (not packages). Without real prices, there's no amount anywhere. */
async function chooseTwoServices(page: Page) {
  const services = page.getByRole("group", { name: wizard.servicesLegend }).getByRole("checkbox");
  expect(await services.count()).toBeGreaterThanOrEqual(2);
  await services.nth(0).check();
  await services.nth(1).check();
  // The total line (a paragraph; each line's own "price confirmed" is a span).
  await expect(page.getByRole("paragraph").filter({ hasText: new RegExp(`^${wizard.noTotal}$`) })).toBeVisible();
}

/** Clicks one of the group's enabled pills, chosen at random, and returns its text. */
async function pickAtRandom(page: Page, legend: string): Promise<string> {
  const radios = page.getByRole("group", { name: legend }).locator("input[type=radio]:not([disabled])");
  const count = await radios.count();
  expect(count, `no enabled ${legend} to choose`).toBeGreaterThan(0);
  const chosen = pill(radios.nth(Math.floor(Math.random() * count)));
  await chosen.click();
  await expect(chosen.getByRole("radio")).toBeChecked();
  return (await chosen.innerText()).trim();
}

/** Step 3: a random free day, then a random free time on it. */
async function chooseRandomSlot(page: Page, next: string) {
  await expect(stepHeading(page, wizard.steps.slot)).toBeVisible();
  await pickAtRandom(page, wizard.dayLegend);
  await pickAtRandom(page, wizard.timeLegend);
  await continueTo(page, next);
}

/** The code on the done screen. Exactly one is shown. */
async function bookingCode(page: Page): Promise<string> {
  const code = page.locator('p[translate="no"]').filter({ visible: true });
  await expect(code).toHaveCount(1);
  const text = (await code.innerText()).trim();
  expect(text).toMatch(CODE_SHAPE);
  return text;
}

/** On /account after a login: saves a name and waits for the vehicles' heading. */
async function giveName(page: Page, name: string) {
  await field(page, account.nameLabel).fill(name);
  await button(page, account.nameSubmit).click();
  await expect(page.getByRole("heading", { level: 2, name: vehicles.listHeading })).toBeVisible();
}

test("a visitor books from the home page: a car, two services, a time, an inline login and their name, then sees a code and the vehicle on /account", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await expectNoErrors(page, errors);

  // The phone bar's Book opens /book, where the bar isn't shown.
  const actionBar = page.getByRole("navigation", { name: messages.ActionBar.label });
  await actionBar.getByRole("link", { name: messages.ActionBar.book, exact: true }).click();
  await expect(page).toHaveURL(/\/book$/);
  await expect(page.getByRole("heading", { level: 1, name: booking.heading })).toBeVisible();
  await expect(actionBar).toHaveCount(0);

  const registration = await typeVehicle(page);
  await chooseTwoServices(page);
  await continueTo(page, wizard.steps.slot);
  await chooseRandomSlot(page, wizard.steps.login);

  // The login step, inside the page.
  const number = freshNumber();
  const since = new Date();
  await field(page, login.phoneLabel).fill(number.typed);
  await page.getByLabel(login.ageLabel).check();
  await page.getByLabel(login.consentLabel.replace("{brand}", messages.Brand.name)).check();
  await button(page, login.sendCode).click();
  await field(page, login.codeLabel).fill(await latestCodeFor(number.e164, since));
  await button(page, login.logIn).click();

  // Confirm: a summary, with every choice kept.
  await expect(stepHeading(page, wizard.steps.confirm)).toBeVisible();
  await expect(page.getByText(wizard.bookingAs.replace("{phone}", `+91 ${number.typed}`))).toBeVisible();
  await expect(page.getByText(`Honda City, ${registration.shown}`)).toBeVisible();

  // A new customer has no name yet: the first Confirm asks for it (the page
  // can't know before the next request, after an inline login).
  await button(page, wizard.confirm).click();
  await expect(page.getByText(booking.errors.needsName)).toBeVisible();
  await field(page, wizard.nameLabel).fill("Asha Patil");
  await button(page, wizard.confirm).click();

  await expect(stepHeading(page, wizard.doneHeading)).toBeVisible();
  await bookingCode(page);
  await expect(page.getByText(wizard.codeNote)).toBeVisible();
  await expect(page.getByText(`Honda City, ${registration.shown}`)).toBeVisible();

  // The vehicle was saved to the new account, with the name.
  await page.goto("/account");
  await expect(page.getByText(account.greeting.replace("{name}", "Asha Patil"))).toBeVisible();
  const card = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3, name: "Honda City" }) });
  await expect(card.getByText(registration.shown, { exact: true })).toBeVisible();
  expect(withoutFaviconProbe(errors)).toEqual([]);
});

test("a logged-in customer with a saved vehicle books without logging in again", async ({ page }) => {
  const errors = watchErrors(page);
  const number = await logInThroughTheForm(page);
  await expectNoErrors(page, errors);
  await giveName(page, "Ravi Kumar");

  // Save a vehicle on /account first.
  const registration = randomRegistration();
  await page.getByRole("link", { name: vehicles.addLink }).click();
  await expect(page.getByRole("heading", { level: 1, name: vehicles.formHeading })).toBeVisible();
  await page.getByRole("combobox", { name: picker.modelLabel }).selectOption("car-honda-city");
  await pill(page.getByRole("radio", { name: messages.Vehicles.fuels.diesel, exact: true })).click();
  await field(page, vehicles.registrationLabel).fill(registration.typed);
  await button(page, vehicles.submit).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto("/book");
  await expect(page.getByRole("navigation", { name: messages.ActionBar.label })).toHaveCount(0);
  // The saved vehicle is chosen already.
  await expect(stepHeading(page, wizard.steps.vehicle)).toBeVisible();
  const saved = page.getByRole("group", { name: wizard.savedLegend });
  await expect(saved.getByRole("radio", { name: `Honda City, ${registration.shown}` })).toBeChecked();
  await continueTo(page, wizard.steps.services);
  await chooseTwoServices(page);
  await continueTo(page, wizard.steps.slot);
  // Logged in: straight from the time to confirm.
  await chooseRandomSlot(page, wizard.steps.confirm);

  await expect(page.getByText(wizard.bookingAs.replace("{phone}", `+91 ${number.typed}`))).toBeVisible();
  await expect(button(page, wizard.notMe)).toBeVisible();
  await expect(field(page, wizard.nameLabel)).toHaveCount(0);

  // Confirm sits at the bottom of a phone: nothing (no phone bar) covers it.
  const confirm = button(page, wizard.confirm);
  await confirm.scrollIntoViewIfNeeded();
  expect(await confirm.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return top !== null && element.contains(top);
  })).toBe(true);
  await confirm.click();

  await expect(stepHeading(page, wizard.doneHeading)).toBeVisible();
  await bookingCode(page);
  await expect(page.getByText(`Honda City, ${registration.shown}`)).toBeVisible();
  expect(withoutFaviconProbe(errors)).toEqual([]);
});

test.describe("one Confirm, one booking", () => {
  /** Logs a fresh number in, gives a name, and brings a typed-in vehicle to the confirm step of /book. */
  async function reachConfirm(page: Page, errors: string[]) {
    await logInThroughTheForm(page);
    await expectNoErrors(page, errors);
    await giveName(page, "Meera Joshi");
    await page.goto("/book");
    await typeVehicle(page);
    await chooseTwoServices(page);
    await continueTo(page, wizard.steps.slot);
    await chooseRandomSlot(page, wizard.steps.confirm);
  }

  test("double-tapping Confirm shows one code", async ({ page }) => {
    const errors = watchErrors(page);
    await reachConfirm(page, errors);

    await button(page, wizard.confirm).dblclick();
    // Booked, or "Already booked" if the second tap reached the server too:
    // either way one code, the first booking's.
    await expect(
      page.getByRole("heading", { level: 2, name: new RegExp(`^(${wizard.doneHeading}|${wizard.duplicateHeading})$`) }),
    ).toBeVisible();
    await bookingCode(page);
    expect(withoutFaviconProbe(errors)).toEqual([]);
  });

  test("when the answer is lost on the way, Confirm again shows the same booking, not a second one", async ({ page }) => {
    const errors = watchErrors(page);
    await reachConfirm(page, errors);

    // The server saves the booking, but its answer never reaches the phone.
    let lost = false;
    await page.route("**/book", async (route) => {
      const request = route.request();
      if (lost || request.method() !== "POST" || !request.headers()["next-action"]) return route.continue();
      lost = true;
      await route.fetch();
      await route.abort("internetdisconnected");
    });
    await button(page, wizard.confirm).click();
    await expect(page.getByText(wizard.connection)).toBeVisible();
    expect(lost).toBe(true);
    await expect(stepHeading(page, wizard.steps.confirm)).toBeVisible();

    // The same Confirm again (same request token): the booking already made.
    await page.unroute("**/book");
    await button(page, wizard.confirm).click();
    await expect(stepHeading(page, wizard.duplicateHeading)).toBeVisible();
    const code = await bookingCode(page);
    await expect(page.getByText(booking.duplicate.replace("{code}", code))).toBeVisible();

    // The aborted request is the only error: Chrome logs it.
    expect(withoutFaviconProbe(errors).filter((error) => !error.includes("net::ERR_INTERNET_DISCONNECTED"))).toEqual([]);
  });
});

test("with JavaScript off, /book says so and offers the garage's phone and WhatsApp", async ({ browser }) => {
  const context = await browser.newContext({ ...phone, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/book");
  await expect(page.getByRole("heading", { level: 1, name: booking.heading })).toBeVisible();
  await expect(page.getByRole("navigation", { name: messages.ActionBar.label })).toHaveCount(0);
  // CSS locators: Playwright's text and role locators skip whatever is
  // inside <noscript>, even when the browser shows it.
  const noscript = page.locator("noscript");
  await expect(noscript.locator("p")).toBeVisible();
  await expect(noscript.locator("p")).toHaveText(booking.noScript);
  await expect(noscript.locator(`a[href="${telHref(ownerGarage.phone)}"]`)).toBeVisible();
  await expect(noscript.locator(`a[href^="https://wa.me/${ownerGarage.whatsapp.slice(1)}?text="]`)).toBeVisible();
  await context.close();
});
