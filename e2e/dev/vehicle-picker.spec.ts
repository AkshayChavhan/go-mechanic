import { expect, type Page, test } from "@playwright/test";

import messages from "../../messages/en.json";
import { draftCatalogue } from "../../src/server/db/vehicle-seed-data";
import { expectNoErrors, watchErrors } from "../helpers";

// The vehicle picker sample on /dev/design (task 17), in a real browser
// against `next dev`: npm run test:design. The unit tests
// (src/components/site/vehicle-picker.test.tsx) cover each rule; this checks
// the real catalogue from the local database, the hydrated narrowing, and the
// page without JavaScript.
//
// The option counts come from vehicle-seed-data.ts, and `npm run dev` keeps
// its local database between runs. The seed adds missing rows but never
// removes or renames one, so after an edit to the draft these counts fail
// until `npm run db:reset` gives the local database the new draft.

const t = messages.Vehicles;
const picker = (page: Page) => page.locator('[data-sample="vehicle-picker"]');
const brand = (page: Page) => picker(page).getByRole("combobox", { name: t.picker.makeLabel });
const model = (page: Page) => picker(page).getByRole("combobox", { name: t.picker.modelLabel });

const draftModels = draftCatalogue.makes.flatMap((make) => make.models);
const twoWheelerBrands = draftCatalogue.makes.filter((make) => make.kind === "two-wheeler");

/** Opens /dev/design and waits until React has hydrated it (the swatches measure themselves then). */
async function open(page: Page) {
  await page.goto("/dev/design");
  await expect(page.locator("[data-contrast-min]").first()).toBeVisible();
  await expect(page.locator("[data-contrast-min]:not([data-contrast-ratio])")).toHaveCount(0);
}

test("narrows to a type, fills in a model's brand and type, picks its only fuel, and says so", async ({ page }) => {
  const errors = watchErrors(page);
  await open(page);

  // Everything is offered at first: every brand and every model of the draft.
  await expect(brand(page).locator("option")).toHaveCount(draftCatalogue.makes.length + 1);
  await expect(model(page).locator("option")).toHaveCount(draftModels.length + 1);

  await picker(page).getByText(t.kinds.twoWheeler, { exact: true }).click();
  await expect(brand(page).locator("option")).toHaveCount(twoWheelerBrands.length + 1);

  // A model first, with no brand chosen: the brand fills itself in.
  await brand(page).selectOption("");
  await model(page).selectOption("two-wheeler-honda-activa");
  await expect(brand(page)).toHaveValue("two-wheeler-honda");
  await expect(picker(page).getByRole("radio", { name: t.fuels.petrol })).toBeChecked();
  await expect(picker(page).getByRole("status")).toContainText(`${t.picker.makeLabel} set to Honda`);
  await expect(picker(page).getByRole("status")).toContainText(`${t.picker.fuelLegend} set to ${t.fuels.petrol}`);

  await expectNoErrors(page, errors);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("every brand and model is still listed and can be chosen", async ({ page }) => {
    await page.goto("/dev/design");
    await expect(brand(page).locator("option")).toHaveCount(draftCatalogue.makes.length + 1);
    await expect(model(page).locator("option")).toHaveCount(draftModels.length + 1);
    await model(page).selectOption("car-tata-nexon");
    await expect(model(page)).toHaveValue("car-tata-nexon");
  });
});
