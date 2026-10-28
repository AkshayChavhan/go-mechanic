import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ownerGarage } from "@/server/db/seed-data";
import { renderWithIntl } from "@/i18n/test-utils";
import messages from "../../../messages/en.json";

import type { NavItem } from "./navigation";
import { SiteFooter } from "./site-footer";

const demoItems: NavItem[] = [
  { label: "services", href: "/services", live: true },
  { label: "about", href: "/about", live: true },
];

function renderFooter(items: readonly NavItem[] = []) {
  renderWithIntl(<SiteFooter items={items} garage={ownerGarage} />);
  return screen.getByRole("contentinfo");
}

describe("SiteFooter", () => {
  test("shows the Wordmark", () => {
    const footer = renderFooter();
    expect(within(footer).getByText(messages.Brand.name)).toBeTruthy();
  });

  test("shows the owner's address exactly, with the PIN code", () => {
    const footer = renderFooter();
    expect(within(footer).getByText("Mukai Chowk, Kiwale, Pune, Maharashtra 412101")).toBeTruthy();
  });

  test("the phone number dials the garage, and says Call to screen readers", () => {
    const footer = renderFooter();
    const phone = within(footer).getByRole("link", { name: `${messages.Contact.call} +91 97647 50567` });
    expect(phone.getAttribute("href")).toBe("tel:+919764750567");
    expect(phone.textContent).toContain("+91 97647 50567");
  });

  test("WhatsApp opens a chat with the general message, in a new tab", () => {
    const footer = renderFooter();
    const link = within(footer).getByRole("link", {
      name: `${messages.Contact.whatsapp} ${messages.Contact.opensWhatsApp}`,
    });
    expect(new URL(link.getAttribute("href")!).searchParams.get("text")).toBe(messages.Contact.whatsappMessage);
    expect(link.getAttribute("target")).toBe("_blank");
  });

  test("lists the hours as day and time pairs, with the India-time note and the live status", () => {
    const footer = renderFooter();
    expect(within(footer).getByRole("heading", { name: messages.Hours.title })).toBeTruthy();
    const rows = [...footer.querySelectorAll("dt")].map((term) => [term.textContent, term.nextElementSibling?.textContent]);
    expect(rows).toEqual([
      ["Monday", messages.Hours.closed],
      ["Tuesday to Sunday", "10:00 am to 7:00 pm"],
    ]);
    expect(within(footer).getByText(messages.Hours.indiaTime)).toBeTruthy();
    expect(footer.querySelector("[data-open-status]")).not.toBeNull();
  });

  test("has no page links while no page is live", () => {
    const footer = renderFooter();
    expect(within(footer).queryByRole("navigation")).toBeNull();
  });

  test("lists the live pages, in order", () => {
    const footer = renderFooter(demoItems);
    const nav = within(footer).getByRole("navigation", { name: messages.Footer.pages });
    expect(within(nav).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      [messages.Nav.services, "/services"],
      [messages.Nav.about, "/about"],
    ]);
  });

  test("its text links are 44px tall on touch screens", () => {
    const footer = renderFooter(demoItems);
    for (const link of within(footer).getAllByRole("link")) {
      expect([...link.classList]).toContain("pointer-coarse:min-h-11");
    }
  });
});
