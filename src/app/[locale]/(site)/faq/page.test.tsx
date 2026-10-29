import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { FAQ_GROUPS, faqSampleCanary, selectFaqItems } from "@/content/faq";
import { renderWithIntl } from "@/i18n/test-utils";
import { readGarage } from "@/server/dal/garage";
import { ownerGarage } from "@/server/db/seed-data";
import messages from "../../../../../messages/en.json";

import { FOOTER_TONE } from "../_components/home-tones";
import FaqPage, { ensureStatic, generateMetadata } from "./page";

vi.mock("@/server/dal/garage", () => ({ readGarage: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../../messages/en.json");
  return {
    getLocale: async () => "en",
    getTranslations: async (namespace: "FaqPage") => createTranslator({ locale: "en", messages: allMessages, namespace }),
  };
});

const t = messages.FaqPage;

beforeEach(() => {
  vi.mocked(readGarage).mockResolvedValue(ownerGarage);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

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

const questions = () => screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent ?? "");

describe("FAQ page in production (no samples)", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  test("shows the confirmed questions only, in their groups; the work group isn't there", async () => {
    const { container } = renderWithIntl(await FaqPage());
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual([t.heading]);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      t.groups.paying,
      t.groups.visit,
    ]);
    expect(questions()).toEqual([
      t.items.howToPay.question,
      t.items.payOnline.question,
      t.items.howToBook.question,
      t.items.hours.question,
    ]);
    expect(container.querySelector("[data-sample]")).toBeNull();
    expect(container.textContent).not.toContain(faqSampleCanary);
  });

  test("paying is cash or UPI at the garage, with no card or online payment offered", async () => {
    const { container } = renderWithIntl(await FaqPage());
    const text = container.textContent ?? "";
    expect(text).toContain("cash");
    expect(text).toContain("UPI");
    expect(text).not.toMatch(/card/i);
  });

  test("booking links WhatsApp and the garage's phone, from the database", async () => {
    vi.mocked(readGarage).mockResolvedValue({ ...ownerGarage, phone: "+912012345678", whatsapp: "+919812345678" });
    const { container } = renderWithIntl(await FaqPage());
    const hrefs = [...container.querySelectorAll("a")].map((link) => link.getAttribute("href") ?? "");
    expect(hrefs).toContain("tel:+912012345678");
    expect(hrefs.some((href) => href.startsWith("https://wa.me/919812345678"))).toBe(true);
  });

  test("the opening hours answer is the garage's week", async () => {
    const { container } = renderWithIntl(await FaqPage());
    expect(container.querySelector("dl")).toBeTruthy();
  });

  test("neighbouring sections never share a tone, the footer included", async () => {
    const { container } = renderWithIntl(await FaqPage());
    expectNoMatchingNeighbours(container);
  });
});

describe("FAQ page under npm run dev (samples)", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
  });

  test("adds every sample answer, each marked Sample, and the work group appears", async () => {
    const { container } = renderWithIntl(await FaqPage());
    const samples = selectFaqItems()!;
    const marked = [...container.querySelectorAll("[data-sample]")];
    expect(marked).toHaveLength(samples.items.length);
    for (const item of marked) expect(item.textContent).toContain(messages.HomePage.sample);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(
      FAQ_GROUPS.map((group) => t.groups[group]),
    );
    expectNoMatchingNeighbours(container);
  });
});

describe("FAQ page metadata", () => {
  test("every group has a heading in the messages", () => {
    for (const group of FAQ_GROUPS) expect(t.groups[group]).toBeTruthy();
  });

  test("must be built ahead of time, and has its own title and description", async () => {
    expect(ensureStatic).toBe("navigation");
    expect(await generateMetadata()).toEqual({
      title: t.metaTitle.replace("{brand}", messages.Brand.name),
      description: t.metaDescription.replace("{brand}", messages.Brand.name),
    });
  });
});
