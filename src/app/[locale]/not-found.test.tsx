import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import { readGarage } from "@/server/dal/garage";
import { ownerGarage } from "@/server/db/seed-data";
import messages from "../../../messages/en.json";

import NotFound, { generateMetadata } from "./not-found";

// The 404 for pages that call notFound() (task 18's unknown services, and
// /dev/design in production). Production sends it as Next.js's error
// document and draws it in the browser, so the e2e tests can't check its
// content without JavaScript: this test does.

// The page is an async Server Component that reads the garage from the
// database: each test renders `await NotFound()`, with readGarage() replaced
// by a stand-in that returns the owner's details (or what a test sets).
vi.mock("@/server/dal/garage", () => ({ readGarage: vi.fn() }));

beforeEach(() => {
  vi.mocked(readGarage).mockResolvedValue(ownerGarage);
});

// generateMetadata reads its text with getTranslations from
// next-intl/server, which only works inside a Next.js render. Here it's
// next-intl's own translator over the real messages.
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../messages/en.json");
  return {
    getTranslations: async (namespace: "NotFound" | "Brand") =>
      createTranslator({ locale: "en", messages: allMessages, namespace }),
  };
});

describe("[locale]/not-found.tsx (the slim 404)", () => {
  test("has one header, with the Wordmark linking home", async () => {
    renderWithIntl(await NotFound());
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: messages.Brand.name }).getAttribute("href")).toBe("/");
    expect(screen.getAllByRole("banner")).toHaveLength(1);
  });

  test("has exactly one main, which the page's skip links can target", async () => {
    const { container } = renderWithIntl(await NotFound());
    const mains = container.querySelectorAll("main");
    expect(mains).toHaveLength(1);
    expect(mains[0].id).toBe("main");
  });

  test("has exactly one level-1 heading: the 404 title", async () => {
    renderWithIntl(await NotFound());
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings.map((heading) => heading.textContent)).toEqual([messages.NotFound.title]);
  });

  test("leads home", async () => {
    renderWithIntl(await NotFound());
    expect(screen.getByRole("link", { name: messages.NotFound.backHome }).getAttribute("href")).toBe("/");
  });

  test("Call and WhatsApp use the numbers from the database", async () => {
    vi.mocked(readGarage).mockResolvedValue({ ...ownerGarage, phone: "+912012345678", whatsapp: "+919876543210" });
    renderWithIntl(await NotFound());
    const call = screen.getByRole("link", { name: messages.Contact.call });
    const whatsapp = screen.getByRole("link", { name: `${messages.Contact.whatsapp} ${messages.Contact.opensWhatsApp}` });
    expect(call.getAttribute("href")).toBe("tel:+912012345678");
    expect(new URL(whatsapp.getAttribute("href")!).pathname).toBe("/919876543210");
  });

  test("its title is the branded 404 title", async () => {
    const brandedTitle = messages.NotFound.metaTitle.replace("{brand}", messages.Brand.name);
    expect(await generateMetadata()).toEqual({ title: brandedTitle });
  });
});
