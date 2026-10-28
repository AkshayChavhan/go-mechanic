import path from "node:path";

import { expect, test } from "@playwright/test";

import messages from "../../messages/en.json";
import { expectNoErrors, freshNumber, scrollsSideways, showAsMostVisitorsSeeIt, watchErrors } from "../helpers";

// The way the owner logs in under `npm run dev` (task 15): ask for a code on
// /login, read it on /dev/outbox, on a phone. npm run test:design runs it
// against `next dev`, which uses the local database (.pglite/): each run
// leaves one test user and one message there, under a 60000... number
// (`npm run db:reset` clears them). Saves
// test-results/design/screenshots/outbox-375.png.

const t = messages.Login;

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });

test("a code asked for on /login shows on /dev/outbox, readable on a phone", async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  const { typed } = freshNumber();
  const shown = `+91 ${typed}`;

  await page.goto("/login");
  await page.getByLabel(t.phoneLabel, { exact: true }).fill(typed);
  await page.getByLabel(t.ageLabel).check();
  await page.getByLabel(t.consentLabel.replace("{brand}", messages.Brand.name)).check();
  await page.getByRole("button", { name: t.sendCode }).click();
  await expect(page.getByText(t.codeSentTo.replace("{number}", shown))).toBeVisible();

  await page.goto("/dev/outbox");
  // This test's own message, not simply the first: another test running at
  // the same time may have sent a newer one.
  const mine = page.locator("[data-message]", { hasText: `To ${shown}` });
  await expect(mine).toContainText(/\d{6} is your/);
  expect(await scrollsSideways(page)).toBe(false);

  await showAsMostVisitorsSeeIt(page);
  await expect(mine).toBeVisible();
  const file = path.join(testInfo.project.outputDir, "screenshots", "outbox-375.png");
  await page.screenshot({ path: file });
  testInfo.annotations.push({ type: "screenshot", description: file });
  await expectNoErrors(page, errors);
});
