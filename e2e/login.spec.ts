import { expect, type Page, test } from "@playwright/test";

import messages from "../messages/en.json";

import { expectNoErrors, freshNumber, latestCodeFor, smsSentTo, watchErrors } from "./helpers";

// Logging in with a mobile number and an SMS code (task 15), on the
// production build. Codes come from the fake SMS provider's file
// (e2e/helpers.ts): every test uses its own fresh number, so tests running
// in parallel, and earlier runs, never mix their codes up.

const t = messages.Login;
const brand = messages.Brand.name;
const phone = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" as const };

test.use(phone);

const SESSION_COOKIE = "better-auth.session_token";

async function askForCode(page: Page, typed: string, { tick = true } = {}) {
  // exact: getByLabel matches by substring, and the consent label ("...use my
  // mobile number...") contains "Mobile number" too.
  await page.getByLabel(t.phoneLabel, { exact: true }).fill(typed);
  if (tick) {
    await page.getByLabel(t.ageLabel).check();
    await page.getByLabel(t.consentLabel.replace("{brand}", brand)).check();
  }
  await page.getByRole("button", { name: t.sendCode }).click();
}

const codeField = (page: Page) => page.getByLabel(t.codeLabel);

test("a new number logs in with the SMS code, stays logged in, and logs out", async ({ page, context }) => {
  const errors = watchErrors(page);
  const since = new Date();
  const { typed, e164 } = freshNumber();
  const shown = `+91 ${typed}`;

  await page.goto("/login");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  // Here, on the first page load, a missing file or script would show.
  await expectNoErrors(page, errors);
  await askForCode(page, typed);

  await expect(page.getByText(t.codeSentTo.replace("{number}", shown))).toBeVisible();
  const code = await latestCodeFor(e164, since);
  // As pasted from an SMS app, with a space.
  await codeField(page).fill(`${code.slice(0, 3)} ${code.slice(3)}`);
  await page.getByRole("button", { name: t.logIn, exact: true }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(messages.Account.signedInAs.replace("{number}", shown))).toBeVisible();

  const session = (await context.cookies()).find((cookie) => cookie.name === SESSION_COOKIE);
  expect(session).toMatchObject({ httpOnly: true, sameSite: "Lax", secure: false });

  // Still logged in after a reload; /login sends a logged-in visitor to /account.
  await page.reload();
  await expect(page.getByText(messages.Account.signedInAs.replace("{number}", shown))).toBeVisible();
  await page.goto("/login");
  await expect(page).toHaveURL(/\/account$/);

  await page.getByRole("button", { name: messages.Account.logOut }).click();
  await expect(page).toHaveURL(/\/$/);
  expect((await context.cookies()).some((cookie) => cookie.name === SESSION_COOKIE)).toBe(false);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: t.heading })).toBeVisible();
  // Not expectNoErrors here: it waits for the network to go quiet, which
  // never happens once a page has been loaded a second time in the same
  // browser. Chrome keeps Next.js's prefetches of "/" open in Playwright's
  // eyes, though the server answered them in milliseconds (seen in task 15,
  // on a reload of "/" too, so not something the login pages do).
  expect(errors).toEqual([]);
});

test("without both boxes ticked: the consent error, and no SMS", async ({ page }) => {
  const since = new Date();
  const { typed, e164 } = freshNumber();
  await page.goto("/login");
  // The boxes are required: the browser stops the form before it's sent.
  // Take that away to see the server's own check.
  await page.locator("form").first().evaluate((form) => form.setAttribute("novalidate", ""));
  await askForCode(page, typed, { tick: false });

  await expect(page.getByText(t.errors.consentMissing)).toBeVisible();
  expect(smsSentTo(e164, since)).toEqual([]);
});

test("a wrong code says so, and the phone step again sends no second SMS", async ({ page }) => {
  const since = new Date();
  const { typed, e164 } = freshNumber();
  await page.goto("/login");
  await askForCode(page, typed);
  const code = await latestCodeFor(e164, since);

  await codeField(page).fill(code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: t.logIn, exact: true }).click();
  await expect(page.getByText(t.errors.wrongCode)).toBeVisible();

  // Back to the phone step and send again: the code is still usable, so
  // nothing is sent and the code step comes back.
  await page.getByRole("button", { name: t.changeNumber }).click();
  await page.getByRole("button", { name: t.sendCode }).click();
  await expect(codeField(page)).toBeVisible();
  expect(smsSentTo(e164, since)).toHaveLength(1);
});

test("Better Auth has no web address: its send-code path answers 404", async ({ request }) => {
  const response = await request.post("/api/auth/phone-number/send-otp", {
    data: { phoneNumber: "+919876543210" },
  });
  expect(response.status()).toBe(404);
});
