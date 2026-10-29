import { expect, test } from "@playwright/test";

import messages from "../messages/en.json";
import { draftServices } from "../src/server/db/service-seed-data";
import { draftCatalogue } from "../src/server/db/vehicle-seed-data";

import { expectNoErrors, rscPayload, watchErrors } from "./helpers";

// The services pages and /packages (task 18) on a real production build:
// npm run test:e2e. It proves what only the built site can show: every page
// is built ahead of time, an unknown service is a real 404, and no price and
// no draft model ever ships (owner's decisions, 2026-10-29). Sample prices
// and the price finder exist only under `npm run dev`, which e2e/dev/ checks.

const services = draftServices.filter((service) => service.kind === "service");
const notFoundTitle = messages.NotFound.metaTitle.replace("{brand}", messages.Brand.name);
const desktop = { viewport: { width: 1440, height: 900 } };

const routes = ["/services", "/services/periodic-service", "/services/brakes", "/packages"];

/** Every text in all of messages/en.json and the service texts: public words a page may show. */
const publicText = JSON.stringify([messages, draftServices]);

/**
 * Text that only the samples or the price finder hold. None of it may reach
 * a production build. Draft model names count, unless the same word appears
 * in a public text (a brand, a message), where finding it would prove nothing.
 */
const sampleOnly = [
  "₹",
  messages.Packages.finder.title,
  messages.Packages.finder.lead,
  messages.Packages.finder.prompt,
  messages.Packages.finder.notOffered,
  messages.Packages.finder.resultsTitle.split(" {")[0]!,
  messages.Services.price.byType,
  messages.Vehicles.picker.makePlaceholder,
  messages.Vehicles.picker.modelPlaceholder,
  ...draftCatalogue.makes
    .flatMap((make) => make.models.map((model) => model.name.en))
    .filter((name) => name.length >= 5 && !publicText.includes(name)),
];

/** Which of the sample-only texts `text` contains (none, we hope). */
const samplesIn = (text: string) => sampleOnly.filter((sample) => text.includes(sample));

test.describe("the pages", () => {
  test.use(desktop);

  for (const url of routes) {
    test(`${url} is built ahead of time, not rendered per request`, async ({ page }) => {
      const response = await page.request.get(url, { maxRedirects: 0 });
      expect(response.status()).toBe(200);
      const headers = response.headers();
      // Next.js 16.4 sends this header twice ("1, 1"): check it's there.
      expect(headers["x-nextjs-prerender"]).toMatch(/^1(, 1)*$/);
      expect(headers["cache-control"]).not.toContain("no-store");
    });
  }

  test("/services lists every service, each linking to a page that answers 200, and Services is the current page", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto("/services");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.Services.title);
    for (const service of services) {
      const link = page.getByRole("main").getByRole("link", { name: service.name.en, exact: true });
      await expect(link).toHaveAttribute("href", `/services/${service.id}`);
    }
    const nav = page.getByRole("banner").getByRole("navigation", { name: messages.Header.navLabel });
    await expect(nav.getByRole("link", { name: messages.Nav.services })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: messages.Nav.prices })).not.toHaveAttribute("aria-current", "page");
    await expectNoErrors(page, errors);

    for (const service of services) {
      expect((await page.request.get(`/services/${service.id}`)).status(), service.id).toBe(200);
    }
  });

  test("a service page: its heading, what's included, how to get a price, and one action group", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/services/brakes");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Brakes");
    await expect(page).toHaveTitle(/^Brakes in Kiwale, Pune \| /);
    await expect(page.getByRole("heading", { name: messages.Services.service.included })).toBeVisible();
    await expect(page.getByText(messages.Services.price.callForPrice)).toBeVisible();
    // The menu marks Services on a page under it too.
    const nav = page.getByRole("banner").getByRole("navigation", { name: messages.Header.navLabel });
    await expect(nav.getByRole("link", { name: messages.Nav.services })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("main").locator('[data-slot="button"][data-variant="default"]')).toHaveCount(1);
    await expectNoErrors(page, errors);
  });

  test("/packages: Basic, Standard and Comprehensive for cars and two-wheelers, no price finder", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/packages");
    for (const title of [messages.Packages.cars, messages.Packages.twoWheelers]) {
      const section = page.getByRole("region", { name: title });
      await expect(section.getByRole("heading", { level: 3 })).toHaveText([
        "Basic service",
        "Standard service",
        "Comprehensive service",
      ]);
      await expect(section.getByText(messages.Packages.callForPrice)).toHaveCount(3);
    }
    await expect(page.getByText(messages.Packages.finder.title)).toHaveCount(0);
    const nav = page.getByRole("banner").getByRole("navigation", { name: messages.Header.navLabel });
    await expect(nav.getByRole("link", { name: messages.Nav.prices })).toHaveAttribute("aria-current", "page");
    await expectNoErrors(page, errors);
  });
});

test.describe("no price, sample or draft model ever ships", () => {
  test.use(desktop);

  test("the sample-only list holds model names, so the scan below can find a leak", () => {
    expect(sampleOnly.length).toBeGreaterThan(50);
  });

  for (const url of routes) {
    test(`${url}: not on the page, not in its HTML, its page data or what a navigation fetches`, async ({ page }) => {
      await page.goto(url);
      await expect.soft(page.locator("[data-sample]")).toHaveCount(0);

      const html = await (await page.request.get(url)).text();
      const pageData = rscPayload(html);
      // The checks below must be reading the real page, not an empty string.
      expect(pageData.length).toBeGreaterThan(1000);
      expect.soft(samplesIn(html), "in the HTML").toEqual([]);
      expect.soft(samplesIn(pageData), "in the page data inside the HTML").toEqual([]);

      const flight = await page.request.get(url, { headers: { RSC: "1" } });
      expect(flight.headers()["content-type"]).toContain("text/x-component");
      expect.soft(samplesIn(await flight.text()), "in the page data a navigation fetches").toEqual([]);
    });
  }

  test("not in any JavaScript the pages load, the phone menu's lazy panel included", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const scripts = new Set<string>();
    for (const url of routes) {
      const page = await context.newPage();
      page.on("response", (response) => {
        if (response.request().resourceType() === "script") scripts.add(response.url());
      });
      await page.goto(url);
      // Open the phone menu, so its lazily loaded panel is among the files.
      await page.getByRole("button", { name: messages.Header.openMenu }).click();
      await expect(page.getByRole("dialog").getByText(messages.Hours.title)).toBeVisible();
      await page.waitForLoadState("networkidle");
      await page.close();
    }
    await context.close();

    expect(scripts.size).toBeGreaterThan(3);
    const found: Record<string, string[]> = {};
    const scan = await browser.newContext();
    for (const url of scripts) {
      const samples = samplesIn(await (await scan.request.get(url)).text());
      if (samples.length > 0) found[url] = samples;
    }
    await scan.close();
    expect(found).toEqual({});
  });
});

test.describe("an unknown service", () => {
  for (const slug of ["not-a-service", "car-basic"]) {
    test(`/services/${slug}: 404 and noindex, as the server sends it (without JavaScript)`, async ({ page }) => {
      const response = await page.request.get(`/services/${slug}`);
      expect(response.status()).toBe(404);
      const html = await response.text();
      expect(html).toMatch(/<meta name="robots" content="noindex"\s*\/?>/);
      expect(html + rscPayload(html)).toContain(notFoundTitle);
    });
  }

  test("shows the 404 page in a browser", async ({ page }) => {
    const response = await page.goto("/services/not-a-service");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.NotFound.title);
    await expect(page).toHaveTitle(notFoundTitle);
  });
});
