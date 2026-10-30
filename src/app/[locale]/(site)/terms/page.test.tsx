import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import { readGarage } from "@/server/dal/garage";
import { ownerGarage } from "@/server/db/seed-data";
import messages from "../../../../../messages/en.json";

import TermsPage, { ensureStatic, generateMetadata } from "./page";

vi.mock("@/server/dal/garage", () => ({ readGarage: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../../messages/en.json");
  return {
    getLocale: async () => "en",
    getTranslations: async (namespace: "TermsPage") => createTranslator({ locale: "en", messages: allMessages, namespace }),
  };
});

const t = messages.TermsPage;

beforeEach(() => {
  vi.mocked(readGarage).mockResolvedValue(ownerGarage);
});

describe("Terms page", () => {
  test("has one h1, the draft line and a fixed last-updated date", async () => {
    const { container } = renderWithIntl(await TermsPage());
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual([t.heading]);
    expect(screen.getByText(t.draft)).toBeTruthy();
    expect(t.updatedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(container.textContent).toContain(t.updated.replace("{date}", "29 Oct 2026"));
  });

  test("says paying is at the garage in cash or by UPI, and lists what isn't decided instead of inventing it", async () => {
    const { container } = renderWithIntl(await TermsPage());
    const text = container.textContent ?? "";
    expect(text).toContain("cash");
    expect(text).toContain("UPI");
    expect(text).not.toMatch(/card/i);
    expect(screen.getByRole("heading", { name: t.undecided.title })).toBeTruthy();
  });

  test("links the privacy notice and the garage's phone and WhatsApp from the database", async () => {
    vi.mocked(readGarage).mockResolvedValue({ ...ownerGarage, phone: "+912012345678", whatsapp: "+919812345678" });
    const { container } = renderWithIntl(await TermsPage());
    const hrefs = [...container.querySelectorAll("a")].map((link) => link.getAttribute("href") ?? "");
    expect(hrefs).toContain("/privacy");
    expect(hrefs).toContain("tel:+912012345678");
    expect(hrefs.some((href) => href.startsWith("https://wa.me/919812345678"))).toBe(true);
  });

  test("must be built ahead of time, and stays out of search results while it's a draft", async () => {
    expect(ensureStatic).toBe("navigation");
    expect(await generateMetadata()).toEqual({
      title: t.metaTitle.replace("{brand}", messages.Brand.name),
      description: t.metaDescription.replace("{brand}", messages.Brand.name),
      robots: { index: false },
    });
  });
});
