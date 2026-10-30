import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import { formatPhoneNumber } from "@/lib/contact-links";
import { readGarage } from "@/server/dal/garage";
import { ownerGarage } from "@/server/db/seed-data";
import messages from "../../../../../messages/en.json";

import { FOOTER_TONE } from "../_components/home-tones";
import ContactPage, { ensureStatic, generateMetadata } from "./page";

// An async Server Component: each test renders `await ContactPage()`, with
// readGarage() and next-intl/server replaced as on the home page's test.
vi.mock("@/server/dal/garage", () => ({ readGarage: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../../messages/en.json");
  return {
    getLocale: async () => "en",
    getTranslations: async (namespace: "ContactPage") => createTranslator({ locale: "en", messages: allMessages, namespace }),
  };
});

const t = messages.ContactPage;

beforeEach(() => {
  vi.mocked(readGarage).mockResolvedValue(ownerGarage);
});

/** Each <section>'s tone, top to bottom, then the footer's. */
function tones(container: HTMLElement): string[] {
  const sections = [...container.querySelectorAll("section")].map((section) =>
    section.classList.contains("dark") ? "dark" : section.classList.contains("surface-grey") ? "grey" : "white",
  );
  return [...sections, FOOTER_TONE];
}

describe("Contact page", () => {
  test("has one h1 and its sections in order", async () => {
    renderWithIntl(await ContactPage());
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual([t.heading]);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      t.findUs,
      messages.Hours.title,
      t.breakdownTitle,
    ]);
  });

  test("shows the garage's address, phone and WhatsApp from the database, not typed-in ones", async () => {
    const other = { ...ownerGarage, phone: "+912012345678", whatsapp: "+919812345678" };
    vi.mocked(readGarage).mockResolvedValue(other);
    renderWithIntl(await ContactPage());

    expect(screen.getByText("Mukai Chowk, Kiwale, Pune, Maharashtra 412101")).toBeTruthy();
    const callLinks = screen.getAllByRole("link").filter((link) => link.getAttribute("href") === "tel:+912012345678");
    // The blue Call button and the breakdown line.
    expect(callLinks).toHaveLength(2);
    expect(callLinks[0].textContent).toContain(formatPhoneNumber(other.phone));
    const whatsapp = screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("https://wa.me/"));
    expect(whatsapp).toHaveLength(1);
    expect(whatsapp[0].getAttribute("href")).toContain("919812345678");
  });

  test("WhatsApp opens a plain chat, not the booking message, and there's no Book link", async () => {
    renderWithIntl(await ContactPage());
    const whatsapp = screen.getAllByRole("link").find((link) => link.getAttribute("href")?.startsWith("https://wa.me/"));
    expect(whatsapp?.getAttribute("href")).toContain(encodeURIComponent(messages.Contact.whatsappMessage));
    expect(screen.queryByRole("link", { name: messages.Header.book })).toBeNull();
  });

  test("has one blue button: Call", async () => {
    const { container } = renderWithIntl(await ContactPage());
    // Button's default (blue) variant is the only one with bg-primary.
    const blue = [...container.querySelectorAll("a")].filter((link) => /(^|\s)bg-primary(\s|$)/.test(link.className));
    expect(blue).toHaveLength(1);
    expect(blue[0].getAttribute("href")).toBe("tel:+919764750567");
  });

  test("links to no map, and the breakdown line promises no towing or round-the-clock help", async () => {
    const { container } = renderWithIntl(await ContactPage());
    const hrefs = [...container.querySelectorAll("a")].map((link) => link.getAttribute("href") ?? "");
    expect(hrefs.filter((href) => /maps\.google|google\.[a-z.]+\/maps|goo\.gl\/maps/.test(href))).toEqual([]);
    expect(t.breakdown).not.toMatch(/24|tow|roadside|any time|anytime/i);
  });

  test("shows the open status and the week's hours", async () => {
    const { container } = renderWithIntl(await ContactPage());
    expect(container.querySelector("[data-open-status]")).toBeTruthy();
    expect(container.querySelector("dl")).toBeTruthy();
  });

  test("neighbouring sections never share a tone, the footer included", async () => {
    const { container } = renderWithIntl(await ContactPage());
    const all = tones(container);
    for (let i = 1; i < all.length; i++) expect(all[i], `section ${i}`).not.toBe(all[i - 1]);
  });

  test("must be built ahead of time, and has its own title and description", async () => {
    expect(ensureStatic).toBe("navigation");
    expect(await generateMetadata()).toEqual({
      title: t.metaTitle.replace("{brand}", messages.Brand.name),
      description: t.metaDescription.replace("{brand}", messages.Brand.name),
    });
  });
});
