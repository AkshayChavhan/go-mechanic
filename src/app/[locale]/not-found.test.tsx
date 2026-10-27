import { screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import messages from "../../../messages/en.json";

import NotFound, { generateMetadata } from "./not-found";

// The 404 for pages that call notFound() (task 18's unknown services, and
// /dev/design in production). Production sends it as Next.js's error
// document and draws it in the browser, so the e2e tests can't check its
// content without JavaScript: this test does.

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
  test("has one header, with the Wordmark linking home", () => {
    renderWithIntl(<NotFound />);
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: messages.Brand.name }).getAttribute("href")).toBe("/");
    expect(screen.getAllByRole("banner")).toHaveLength(1);
  });

  test("has exactly one main, which the page's skip links can target", () => {
    const { container } = renderWithIntl(<NotFound />);
    const mains = container.querySelectorAll("main");
    expect(mains).toHaveLength(1);
    expect(mains[0].id).toBe("main");
  });

  test("has exactly one level-1 heading: the 404 title", () => {
    renderWithIntl(<NotFound />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings.map((heading) => heading.textContent)).toEqual([messages.NotFound.title]);
  });

  test("leads home", () => {
    renderWithIntl(<NotFound />);
    expect(screen.getByRole("link", { name: messages.NotFound.backHome }).getAttribute("href")).toBe("/");
  });

  test("its title is the branded 404 title", async () => {
    const brandedTitle = messages.NotFound.metaTitle.replace("{brand}", messages.Brand.name);
    expect(await generateMetadata()).toEqual({ title: brandedTitle });
  });
});
