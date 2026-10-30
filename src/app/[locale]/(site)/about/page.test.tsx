import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { isLivePage } from "@/components/site/navigation";
import { aboutSampleCanary, selectAboutTopics } from "@/content/about";
import { renderWithIntl } from "@/i18n/test-utils";
import { readGarage } from "@/server/dal/garage";
import { ownerGarage } from "@/server/db/seed-data";
import messages from "../../../../../messages/en.json";

import { FOOTER_TONE } from "../_components/home-tones";
import AboutPage, { ensureStatic, generateMetadata } from "./page";

vi.mock("@/server/dal/garage", () => ({ readGarage: vi.fn() }));
// The real selector, which one test replaces once with real (owner-given) topics.
vi.mock("@/content/about", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/content/about")>();
  return { ...actual, selectAboutTopics: vi.fn(actual.selectAboutTopics) };
});
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../../messages/en.json");
  return {
    getLocale: async () => "en",
    getTranslations: async (namespace: "AboutPage") => createTranslator({ locale: "en", messages: allMessages, namespace }),
  };
});

const t = messages.AboutPage;

beforeEach(() => {
  vi.mocked(readGarage).mockResolvedValue(ownerGarage);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Each <section>'s tone, top to bottom, then the footer's. */
function tones(container: HTMLElement): string[] {
  const sections = [...container.querySelectorAll("section")].map((section) =>
    section.classList.contains("dark") ? "dark" : section.classList.contains("surface-grey") ? "grey" : "white",
  );
  return [...sections, FOOTER_TONE];
}

function expectNoMatchingNeighbours(container: HTMLElement) {
  const all = tones(container);
  for (let i = 1; i < all.length; i++) expect(all[i], `section ${i}`).not.toBe(all[i - 1]);
}

describe("About page in production (no samples)", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  test("shows only the confirmed facts: one h1, then visiting and hours", async () => {
    const { container } = renderWithIntl(await AboutPage());
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual([t.heading]);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      t.visitTitle,
      messages.Hours.title,
    ]);
    expect(container.querySelector("[data-sample]")).toBeNull();
    expect(container.textContent).not.toContain(aboutSampleCanary);
    expect(container.textContent).not.toContain(messages.HomePage.sample);
  });

  test("neighbouring sections never share a tone, the footer included", async () => {
    const { container } = renderWithIntl(await AboutPage());
    expectNoMatchingNeighbours(container);
  });
});

describe("About page under npm run dev (samples)", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
  });

  test("shows every sample topic, each marked Sample", async () => {
    const { container } = renderWithIntl(await AboutPage());
    const samples = selectAboutTopics();
    expect(samples?.sample).toBe(true);
    const marked = [...container.querySelectorAll("[data-sample]")];
    expect(marked).toHaveLength(samples!.items.length);
    for (const article of marked) expect(article.textContent).toContain(messages.HomePage.sample);
  });

  test("neighbouring sections still never share a tone", async () => {
    const { container } = renderWithIntl(await AboutPage());
    expectNoMatchingNeighbours(container);
  });
});

describe("About page once the owner gives real topics", () => {
  test("shows them in every build, without a Sample mark", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(selectAboutTopics).mockReturnValueOnce({
      items: [{ id: "story", title: { en: "Our story" }, body: { en: "Real words from the owner." } }],
      sample: false,
    });
    const { container } = renderWithIntl(await AboutPage());
    expect(screen.getByRole("heading", { level: 2, name: "Our story" })).toBeTruthy();
    expect(container.querySelector("[data-sample]")).toBeNull();
    expect(container.textContent).not.toContain(messages.HomePage.sample);
    expectNoMatchingNeighbours(container);
  });
});

describe("About page links", () => {
  test("Book goes somewhere that exists (WhatsApp until /book is live), and Call dials the garage", async () => {
    const { container } = renderWithIntl(await AboutPage());
    const hrefs = [...container.querySelectorAll("a")].map((link) => link.getAttribute("href") ?? "");
    for (const href of hrefs.filter((href) => href.startsWith("/"))) expect(isLivePage(href), href).toBe(true);
    expect(hrefs).toContain("tel:+919764750567");
    expect(hrefs.some((href) => href.startsWith("https://wa.me/"))).toBe(true);
  });

  test("must be built ahead of time, and has its own title and description", async () => {
    expect(ensureStatic).toBe("navigation");
    expect(await generateMetadata()).toEqual({
      title: t.metaTitle.replace("{brand}", messages.Brand.name),
      description: t.metaDescription.replace("{brand}", messages.Brand.name),
    });
  });
});
