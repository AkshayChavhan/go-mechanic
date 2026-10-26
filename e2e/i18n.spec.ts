import { expect, test } from "@playwright/test";

import messages from "../messages/en.json";

// Language routing, 404 pages, static files and prerendering, checked on a
// real production build. Expected text comes from messages/en.json, so these
// tests keep working when the wording changes.

test.describe("English URLs", () => {
  test("/en redirects to / (English URLs have no prefix)", async ({ page }) => {
    const response = await page.request.get("/en", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toBe("/");

    await page.goto("/en");
    expect(new URL(page.url()).pathname).toBe("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.HomePage.title);
  });

  test("/en/<page> redirects to /<page>", async ({ page }) => {
    const response = await page.request.get("/en/services", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toBe("/services");
  });
});

test.describe("pages that don't exist", () => {
  test("an unknown page shows the 404 page", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.NotFound.title);
    await expect(page.locator("title")).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("/hi is a 404 until Hindi is switched on", async ({ page }) => {
    // Flip this test when Hindi ships.
    const response = await page.request.get("/hi", { maxRedirects: 0 });
    expect(response.status()).toBe(404);
  });

  test("a path with a dot is a 404, not a server error", async ({ page }) => {
    // Dotted paths skip the proxy (it treats them as files) and reach
    // [locale] with "foo.bar" as the locale; request.ts must answer 404.
    // The body is Next.js's bare error page, not our 404 design: notFound()
    // runs inside the root layout itself. Accepted in task 10 (still 404 +
    // noindex); task 12 weighs narrowing the proxy matcher.
    const response = await page.request.get("/foo.bar", { maxRedirects: 0 });
    expect(response.status()).toBe(404);
  });
});

test.describe("static files", () => {
  test("the site icon is served and linked from every page", async ({ page }) => {
    const icon = await page.request.get("/icon.svg");
    expect(icon.status()).toBe(200);
    expect(icon.headers()["content-type"]).toContain("image/svg+xml");

    await page.goto("/");
    await expect(page.locator('head link[rel="icon"]')).toHaveCount(1);
  });
});

test.describe("prerendering", () => {
  test("the home page is built ahead of time, not rendered per request", async ({ page }) => {
    // A page rendered per request is sent with "no-store". A prerendered one
    // is cacheable and marked by Next.js with x-nextjs-prerender.
    const response = await page.request.get("/", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    const headers = response.headers();
    // Next.js 16.4 sends this header twice, so it reads "1, 1": check that
    // it's there rather than its exact value.
    expect(headers["x-nextjs-prerender"]).toMatch(/^1(, 1)*$/);
    expect(headers["cache-control"]).not.toContain("no-store");
    expect(headers["cache-control"]).toContain("s-maxage");
  });
});
