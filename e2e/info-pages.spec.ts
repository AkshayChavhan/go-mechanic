import { expect, test } from "@playwright/test";

import messages from "../messages/en.json";
import { aboutSampleCanary, sampleAboutTopics } from "../src/content/about";
import { faqSampleCanary, sampleFaqItems } from "../src/content/faq";

import { expectNoErrors, logInThroughTheForm, rscPayload, scrollsSideways, watchErrors } from "./helpers";

// The info pages (task 19) on a real production build: npm run test:e2e.
// It proves what only the built site can show: each page is built ahead of
// time, loads without errors, ships no sample text (owner's decision,
// 2026-10-29), keeps the drafts out of search results, and is linked from
// the shell.

const pages = [
  { path: "/contact", heading: messages.ContactPage.heading },
  { path: "/about", heading: messages.AboutPage.heading },
  { path: "/faq", heading: messages.FaqPage.heading },
  { path: "/privacy", heading: messages.PrivacyPage.heading },
  { path: "/terms", heading: messages.TermsPage.heading },
] as const;

const phone = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };

/** Text that exists only in the samples: none of it may reach a production build. */
const sampleOnly = [
  aboutSampleCanary,
  faqSampleCanary,
  ...sampleAboutTopics.flatMap((topic) => [topic.title.en, topic.body.en]),
  ...sampleFaqItems.flatMap((item) => [item.question.en, item.answer.en]),
  messages.FaqPage.groups.work,
];

const samplesIn = (text: string) => sampleOnly.filter((sample) => text.includes(sample));

for (const { path, heading } of pages) {
  test.describe(path, () => {
    test("answers 200 with its one h1, and logs no errors on load", async ({ page }) => {
      const errors = watchErrors(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      await expectNoErrors(page, errors);
    });

    test("is built ahead of time, not rendered per request", async ({ page }) => {
      const response = await page.request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(200);
      const headers = response.headers();
      expect(headers["x-nextjs-prerender"]).toMatch(/^1(, 1)*$/);
      expect(headers["cache-control"]).not.toContain("no-store");
    });

    test("doesn't scroll sideways on a 375px phone", async ({ browser }) => {
      const context = await browser.newContext(phone);
      const page = await context.newPage();
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      expect(await scrollsSideways(page)).toBe(false);
      await context.close();
    });
  });
}

test.describe("what the production build ships", () => {
  for (const path of ["/about", "/faq"]) {
    test(`${path}: no sample text on the page, in its HTML, its page data or its scripts`, async ({ page }) => {
      const scripts = new Set<string>();
      page.on("response", (response) => {
        if (response.request().resourceType() === "script") scripts.add(response.url());
      });
      await page.goto(path);
      await expect.soft(page.locator("[data-sample]")).toHaveCount(0);

      const html = await (await page.request.get(path)).text();
      // The checks must be reading the real page, not an empty string.
      expect(html).toContain(path === "/about" ? messages.AboutPage.heading : messages.FaqPage.heading);
      expect.soft(samplesIn(html), "in the HTML").toEqual([]);
      expect.soft(samplesIn(rscPayload(html)), "in the page data inside the HTML").toEqual([]);
      const flight = await (await page.request.get(path, { headers: { RSC: "1" } })).text();
      expect.soft(samplesIn(flight), "in the page data a navigation fetches").toEqual([]);

      await page.waitForLoadState("networkidle");
      for (const src of await page.locator("script[src]").evaluateAll((tags) => tags.map((tag) => (tag as HTMLScriptElement).src))) {
        scripts.add(src);
      }
      expect(scripts.size).toBeGreaterThan(3);
      const found: Record<string, string[]> = {};
      for (const url of scripts) {
        const samples = samplesIn(await (await page.request.get(url)).text());
        if (samples.length > 0) found[url] = samples;
      }
      expect(found).toEqual({});
    });
  }

  for (const { path, draft } of [
    { path: "/privacy", draft: messages.PrivacyPage.draft },
    { path: "/terms", draft: messages.TermsPage.draft },
  ]) {
    test(`${path}: a draft, kept out of search results`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await expect(page.getByText(draft)).toBeVisible();
    });
  }

  for (const path of ["/contact", "/about", "/faq"]) {
    test(`${path}: search engines may list it`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    });
  }
});

test.describe("links to the info pages", () => {
  test("the header lists About and Contact; the footer adds FAQ, Privacy and Terms", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: messages.Nav.about })).toHaveAttribute("href", "/about");
    await expect(header.getByRole("link", { name: messages.Nav.contact })).toHaveAttribute("href", "/contact");
    await expect(header.getByRole("link", { name: messages.Nav.faq })).toHaveCount(0);

    const footer = page.getByRole("contentinfo");
    for (const [label, href] of [
      [messages.Nav.about, "/about"],
      [messages.Nav.contact, "/contact"],
      [messages.Nav.faq, "/faq"],
      [messages.Nav.privacy, "/privacy"],
      [messages.Nav.terms, "/terms"],
    ] as const) {
      await expect(footer.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
    }
  });

  test("after logging in, the website has set one cookie, the login's, as the privacy notice says", async ({ page, context }) => {
    // PrivacyPage.cookies promises exactly this. A later Better Auth setting
    // (its cookie cache, say) would add cookies and make the notice untrue.
    await logInThroughTheForm(page);
    const names = (await context.cookies()).map((cookie) => cookie.name);
    expect(names).toEqual(["better-auth.session_token"]);
  });

  test("the language cookie is set only for a request that names no language, as the privacy notice says", async ({ page }) => {
    // next-intl's proxy sets NEXT_LOCALE when the browser's languages pick
    // another locale than the page's (syncCookie). With English only, that's
    // a request with no Accept-Language at all: browsers always send one.
    const browserLike = await page.request.get("/contact", { headers: { "accept-language": "mr-IN,mr;q=0.9,hi;q=0.8" } });
    expect(browserLike.headers()["set-cookie"] ?? "").not.toContain("NEXT_LOCALE");
    const noLanguage = await page.request.get("/contact");
    expect(noLanguage.headers()["set-cookie"] ?? "").toContain("NEXT_LOCALE=en");
  });

  test("the login notice links the privacy notice, opening a new tab", async ({ page }) => {
    await page.goto("/login");
    const link = page.locator('a[href="/privacy"]');
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toContainText("privacy notice");
  });
});
