import { type BrowserContext, expect, type Locator, type Page, test } from "@playwright/test";

import messages from "../messages/en.json";
import { BOOKING_CODE_ALPHABET } from "../src/domain/bookings";
import { formatPhoneNumber } from "../src/lib/contact-links";

import { expectNoErrors, freshNumber, latestCodeFor, logInThroughTheForm, TEST_OWNER_NUMBER, watchErrors } from "./helpers";

// The staff area, /admin (task 26), on the production build.
//
// - playwright.config.ts gives the server OWNER_PHONE_NUMBER =
//   TEST_OWNER_NUMBER, so logging in with that number makes the owner.
//   LOGIN_RULES allows a number 5 codes an hour, so the owner logs in once,
//   in one test.
// - The tests run one after another (serial): a customer books first, and
//   the later tests look for that booking. Other specs book in parallel on
//   the same database, so the board is searched by the booking's code, never
//   counted.
// - The logged-out 307s are in access.spec.ts, with the other proxy checks.
// - expectNoErrors only on each test's first page load
//   (document/solutions/conventions/playwright-networkidle-hangs-after-second-page-load.md).
// - Next.js keeps pages you leave in the DOM, hidden, so locators are
//   visibility-aware (getByRole, or filter({ visible: true })).

test.describe.configure({ mode: "serial" });

const admin = messages.Admin;
const wizard = messages.Booking.wizard;
const login = messages.Login;
const account = messages.Account;
const phone = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" as const };

test.use(phone);

/** Words only staff pages show: none may reach a customer's HTML. */
const STAFF_WORDS = [
  admin.nav.label,
  admin.nav.bookings,
  admin.nav.estimates,
  admin.overview.heading,
  admin.overview.intro,
  admin.overview.bookingsDescription,
  admin.overview.estimatesDescription,
  admin.overview.pricesDescription,
  admin.overview.mechanicNote,
  admin.bookings.empty,
  admin.bookings.dayNavLabel,
  admin.bookings.previousDay,
  admin.bookings.nextDay,
  admin.bookings.dateLabel,
  admin.bookings.dateNote,
  account.staffLink,
  // The price editor (task 39). Not Admin.nav.prices ("Prices"): too common a word.
  messages.AdminPrices.intro,
  messages.AdminPrices.groupHint,
  messages.AdminPrices.fuelsSummary,
  messages.AdminPrices.onInspectionNote,
];

const CODE_SHAPE = new RegExp(`^[${BOOKING_CODE_ALPHABET}]{3}-[${BOOKING_CODE_ALPHABET}]{3}$`);

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const stepHeading = (page: Page, name: string) => page.getByRole("heading", { level: 2, name });
const pill = (radio: Locator) => radio.locator("xpath=..");

/** As in booking.spec.ts: Chrome sometimes asks for the missing /favicon.ico after a page change (task 42 adds it). */
const withoutFaviconProbe = (errors: string[]) => errors.filter((error) => !error.includes("/favicon.ico"));

async function continueTo(page: Page, next: string) {
  await button(page, wizard.continue).click();
  await expect(stepHeading(page, next)).toBeVisible();
}

/** Clicks one of the group's enabled pills at random; returns the radio's value. */
async function pickAtRandom(page: Page, legend: string): Promise<string> {
  const radios = page.getByRole("group", { name: legend }).locator("input[type=radio]:not([disabled])");
  const count = await radios.count();
  expect(count, `no enabled ${legend} to choose`).toBeGreaterThan(0);
  const radio = radios.nth(Math.floor(Math.random() * count));
  await pill(radio).click();
  await expect(radio).toBeChecked();
  return radio.inputValue();
}

/** What the customer's booking left behind, for the later tests. */
const booked = {
  code: "",
  /** The India date of the slot, "2026-11-20": the radio's value. */
  day: "",
  name: "Kavya Deshpande",
  phone: "",
  registration: "",
  /** The customer's login cookies, so the next test opens /admin as them. */
  storage: undefined as Awaited<ReturnType<BrowserContext["storageState"]>> | undefined,
};

test("a customer books a visit on /book (the booking the owner looks for)", async ({ page, context }) => {
  const errors = watchErrors(page);
  const number = await logInThroughTheForm(page);
  await expectNoErrors(page, errors);
  booked.phone = number.e164;

  await field(page, account.nameLabel).fill(booked.name);
  await button(page, account.nameSubmit).click();
  await expect(page.getByText(account.greeting.replace("{name}", booked.name))).toBeVisible();

  await page.goto("/book");
  await expect(stepHeading(page, wizard.steps.vehicle)).toBeVisible();
  const digits = String(Math.floor(Math.random() * 10_000)).padStart(4, "0");
  booked.registration = `MH 12 AB ${digits}`;
  await page.getByRole("combobox", { name: messages.Vehicles.picker.modelLabel }).selectOption("car-honda-city");
  await pill(page.getByRole("radio", { name: messages.Vehicles.fuels.petrol, exact: true })).click();
  await field(page, wizard.registrationLabel).fill(booked.registration);
  await continueTo(page, wizard.steps.services);

  await page.getByRole("group", { name: wizard.servicesLegend }).getByRole("checkbox").first().check();
  await continueTo(page, wizard.steps.slot);
  booked.day = await pickAtRandom(page, wizard.dayLegend);
  expect(booked.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await pickAtRandom(page, wizard.timeLegend);
  await continueTo(page, wizard.steps.confirm);

  await button(page, wizard.confirm).click();
  await expect(stepHeading(page, wizard.doneHeading)).toBeVisible();
  const code = page.locator('p[translate="no"]').filter({ visible: true });
  await expect(code).toHaveCount(1);
  booked.code = (await code.innerText()).trim();
  expect(booked.code).toMatch(CODE_SHAPE);

  booked.storage = await context.storageState();
  expect(withoutFaviconProbe(errors)).toEqual([]);
});

test("a customer opening a staff page sees the 404 page, and its HTML holds no staff word or booking", async ({
  browser,
}) => {
  expect(booked.storage, "the booking test ran first").toBeDefined();
  const context = await browser.newContext({ ...phone, storageState: booked.storage });
  const page = await context.newPage();
  const errors = watchErrors(page);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1, name: messages.NotFound.title })).toBeVisible();
  await expectNoErrors(page, errors);

  await page.goto(`/admin/bookings?date=${booked.day}`);
  await expect(page.getByRole("heading", { level: 1, name: messages.NotFound.title })).toBeVisible();

  // The raw HTML, with the customer's cookies (the page's request API shares
  // them): what the server sent, page data included, not just what's shown.
  for (const path of [
    "/admin",
    "/admin/bookings",
    `/admin/bookings?date=${booked.day}`,
    "/admin/prices",
    "/admin/prices/periodic-service",
  ]) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    // A 404 inside <Suspense> streams with status 200 (CLAUDE.md, "Roles and access").
    expect(response.status(), path).toBe(200);
    const html = await response.text();
    expect(html, path).toContain(messages.NotFound.title);
    for (const word of STAFF_WORDS) expect(html, `${path}: "${word}"`).not.toContain(word);
    expect(html, path).not.toContain(booked.code);
    expect(html, path).not.toContain(booked.code.replace("-", ""));
    expect(html, path).not.toContain(booked.name);
    expect(html, path).not.toContain(booked.registration);
  }

  expect(withoutFaviconProbe(errors)).toEqual([]);
  await context.close();
});

test("the manifest and home-screen icons answer for anyone, and only /admin links the manifest", async ({ page }) => {
  const manifest = await page.request.get("/admin.webmanifest", { maxRedirects: 0 });
  expect(manifest.status()).toBe(200);
  expect(manifest.headers()["content-type"]).toContain("application/manifest+json");
  const body = (await manifest.json()) as { start_url: string; icons: { src: string }[] };
  expect(body.start_url).toBe("/admin");

  const iconPaths = [...body.icons.map((icon) => icon.src), "/admin-apple-icon.png"];
  for (const path of iconPaths) {
    const icon = await page.request.get(path, { maxRedirects: 0 });
    expect(icon.status(), path).toBe(200);
    expect(icon.headers()["content-type"], path).toBe("image/png");
    // PNG's signature.
    expect([...(await icon.body()).subarray(0, 4)], path).toEqual([0x89, 0x50, 0x4e, 0x47]);
  }

  const home = await (await page.request.get("/")).text();
  expect(home).not.toContain('rel="manifest"');
  expect(home).not.toContain("/admin.webmanifest");
});

test("the owner opens the staff area from /account, finds the booking on its day, then a customer on the same phone presses Back and sees nothing of it", async ({
  page,
}) => {
  expect(booked.code, "the booking test ran first").not.toBe("");
  const errors = watchErrors(page);
  await logInThroughTheForm(page, TEST_OWNER_NUMBER);
  await expectNoErrors(page, errors);

  // /account: the owner has no name yet, and the staff link is above the form.
  const staffLink = page.getByRole("link", { name: account.staffLink });
  await expect(staffLink).toBeVisible();
  await staffLink.click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1, name: admin.overview.heading })).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/admin.webmanifest");

  // The staff nav's Bookings: today's board.
  const staffNav = page.getByRole("navigation", { name: admin.nav.label });
  await staffNav.getByRole("link", { name: admin.nav.bookings, exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/bookings$/);
  await expect(page.getByText(admin.bookings.today).filter({ visible: true }).first()).toBeVisible();

  // The booking's day, through the date field (a plain GET form).
  await field(page, admin.bookings.dateLabel).fill(booked.day);
  await button(page, admin.bookings.showDate).click();
  await expect(page).toHaveURL(new RegExp(`/admin/bookings\\?date=${booked.day}$`));
  const card = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { level: 2, name: new RegExp(booked.code) }) });
  await expect(card).toHaveCount(1);
  await expect(card.getByText(booked.name, { exact: true })).toBeVisible();
  await expect(card.getByText(booked.registration, { exact: true })).toBeVisible();
  await expect(card.getByRole("link", { name: formatPhoneNumber(booked.phone) })).toHaveAttribute(
    "href",
    `tel:${booked.phone}`,
  );

  // Two client-side moves, so the board sits in the router's memory (and
  // Next.js's hidden <Activity>) when the owner logs out.
  const days = page.getByRole("navigation", { name: admin.bookings.dayNavLabel });
  await days.getByRole("link", { name: admin.bookings.previousDay }).click();
  await expect(page).not.toHaveURL(new RegExp(`date=${booked.day}$`));
  await days.getByRole("link", { name: admin.bookings.nextDay }).click();
  await expect(page).toHaveURL(new RegExp(`date=${booked.day}$`));
  await expect(card).toHaveCount(1);

  // Shared phone: the owner logs out from the staff bar...
  await button(page, account.logOut).click();
  await expect(page).toHaveURL(/\/$/);

  // ...and a customer logs in on the same tab, through the header's Account link.
  await page.getByRole("link", { name: account.headerLink }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  const customer = freshNumber();
  const since = new Date();
  await field(page, login.phoneLabel).fill(customer.typed);
  await page.getByLabel(login.ageLabel).check();
  await page.getByLabel(login.consentLabel.replace("{brand}", messages.Brand.name)).check();
  await button(page, login.sendCode).click();
  await field(page, login.codeLabel).fill(await latestCodeFor(customer.e164, since));
  await button(page, login.logIn).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(account.signedInAs.replace("{number}", `+91 ${customer.typed}`))).toBeVisible();

  // Back, step by step, through every page this tab has seen, until there's
  // nothing older (goBack leaves the URL as it was) or it leaves the site. Each read is
  // right after the navigation and doesn't retry: a board painted from
  // memory even for a moment would be caught.
  const seen: string[] = [];
  for (let step = 0; step < 12; step += 1) {
    const before = page.url();
    await page.goBack();
    if (page.url() === before || !page.url().startsWith("http://localhost")) break;
    const text = await page.evaluate(() => document.body.innerText);
    seen.push(new URL(page.url()).pathname + new URL(page.url()).search);
    expect(text, `right after Back to ${page.url()}`).not.toContain(booked.code);
    expect(text, `right after Back to ${page.url()}`).not.toContain(booked.name);
    expect(text, `right after Back to ${page.url()}`).not.toMatch(new RegExp(`^${admin.nav.bookings}$`, "m"));
    expect(text, `right after Back to ${page.url()}`).not.toContain(admin.overview.heading);
    // And once the page has settled.
    await page.waitForTimeout(500);
    const settled = await page.evaluate(() => document.body.innerText);
    expect(settled, `settled on ${page.url()}`).not.toContain(booked.code);
    expect(settled, `settled on ${page.url()}`).not.toMatch(new RegExp(`^${admin.nav.bookings}$`, "m"));
  }
  // Back really went through the staff pages.
  expect(seen.some((path) => path.startsWith("/admin")), `Back went through ${seen.join(", ")}`).toBe(true);
});
