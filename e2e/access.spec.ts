import { expect, test } from "@playwright/test";

import messages from "../messages/en.json";

import { expectNoErrors, logInThroughTheForm, watchErrors } from "./helpers";

// Task 16 on the production build: the proxy's real 307s for /account and
// /login, and what happens with a leftover session cookie. Redirect statuses
// are read with the page's own request API (it shares the browser's
// cookies) and maxRedirects: 0, so the 307 itself is seen, not where it ends.
//
// expectNoErrors only on each test's first page load: after a page loads a
// second time, the network never goes quiet in Playwright's eyes
// (document/solutions/conventions/playwright-networkidle-hangs-after-second-page-load.md).

const loginHeading = messages.Login.heading;
const phone = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" as const };

test.use(phone);

test("logged out: /account answers 307 to /login, before any page renders", async ({ page }) => {
  const response = await page.request.get("/account", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(new URL(response.headers().location, "http://localhost").pathname).toBe("/login");
});

test("logged in: /login answers 307 to /account, and /account answers 200", async ({ page }) => {
  const errors = watchErrors(page);
  await logInThroughTheForm(page);

  const login = await page.request.get("/login", { maxRedirects: 0 });
  expect(login.status()).toBe(307);
  expect(new URL(login.headers().location, "http://localhost").pathname).toBe("/account");
  expect((await page.request.get("/account", { maxRedirects: 0 })).status()).toBe(200);
  expect(errors).toEqual([]);
});

test.describe("a leftover session cookie (its session gone)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    // A cookie with the right name and no session behind it, as after a
    // database reset or a deleted session.
    await context.addCookies([{ name: "better-auth.session_token", value: "gone.session", url: baseURL ?? "" }]);
  });

  test("/account ends on /login?session=ended with the login form: no loop", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\?session=ended$/);
    await expect(page.getByRole("heading", { name: loginHeading })).toBeVisible();
    await expectNoErrors(page, errors);
  });

  test("/login also ends on the login form, not in a loop", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login\?session=ended$/);
    await expect(page.getByRole("heading", { name: loginHeading })).toBeVisible();
    // Settled: still there a moment later.
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/login\?session=ended$/);
    expect(errors).toEqual([]);
  });

  test("logging in from there works: the form post isn't redirected, and the new cookie replaces the old", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    const { typed } = await logInThroughTheForm(page);
    await expect(
      page.getByText(messages.Account.signedInAs.replace("{number}", `+91 ${typed}`)),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
});
