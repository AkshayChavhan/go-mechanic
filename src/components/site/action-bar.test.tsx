import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { garage } from "@/content/garage";
import { renderWithIntl } from "@/i18n/test-utils";
import { telHref, whatsappHref } from "@/lib/contact-links";
import messages from "../../../messages/en.json";

import { ActionBar } from "./action-bar";
import { bookTarget } from "./navigation";

const bookingHref = whatsappHref(garage.whatsapp, messages.Contact.bookingMessage);
const whatsappBook = bookTarget(bookingHref, { href: "/book", live: false });
const opens = messages.Contact.opensWhatsApp;

function renderBar(book = whatsappBook) {
  renderWithIntl(<ActionBar book={book} garage={garage} />);
  return screen.getByRole("navigation", { name: messages.ActionBar.label });
}

describe("ActionBar (the phone bar)", () => {
  test("is a navigation landmark named from messages, holding Call, WhatsApp and Book in that order", () => {
    const bar = renderBar();
    expect(within(bar).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      telHref(garage.phone),
      whatsappHref(garage.whatsapp, messages.Contact.whatsappMessage),
      bookingHref,
    ]);
  });

  test("Call dials the garage", () => {
    const bar = renderBar();
    expect(within(bar).getByRole("link", { name: messages.Contact.call }).getAttribute("href")).toBe("tel:+919764750567");
  });

  test("WhatsApp opens a chat with the general message, in a new tab, and says so", () => {
    const bar = renderBar();
    const link = within(bar).getByRole("link", { name: `${messages.Contact.whatsapp} ${opens}` });
    expect(new URL(link.getAttribute("href")!).searchParams.get("text")).toBe(messages.Contact.whatsappMessage);
    expect(link.getAttribute("target")).toBe("_blank");
  });

  test("Book opens WhatsApp with the booking message while /book isn't live", () => {
    const bar = renderBar();
    const link = within(bar).getByRole("link", { name: `${messages.ActionBar.book} ${opens}` });
    expect(new URL(link.getAttribute("href")!).searchParams.get("text")).toBe(messages.Contact.bookingMessage);
  });

  test("Book goes to the booking page once it's live", () => {
    const bar = renderBar({ kind: "page", href: "/book" });
    expect(within(bar).getByRole("link", { name: messages.ActionBar.book }).getAttribute("href")).toBe("/book");
  });

  test("exactly one blue button: Book", () => {
    const bar = renderBar();
    const variants = within(bar)
      .getAllByRole("link")
      .map((link) => link.getAttribute("data-variant"));
    expect(variants).toEqual(["secondary", "secondary", "default"]);
  });

  test("className can show it in place (the /dev/design sample): static, and not hidden from 768px", () => {
    renderWithIntl(<ActionBar book={whatsappBook} garage={garage} className="static md:block" />);
    const classes = [...screen.getByRole("navigation", { name: messages.ActionBar.label }).classList];
    expect(classes).toEqual(expect.arrayContaining(["static", "md:block"]));
    expect(classes).not.toContain("fixed");
    expect(classes).not.toContain("md:hidden");
  });

  test("icons are decorative", () => {
    const bar = renderBar();
    for (const icon of bar.querySelectorAll("svg")) expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  test("stacks icon over label: the button's own height and side padding give way", () => {
    // At 320px each link is 88px wide, too narrow for an icon next to
    // "WhatsApp". The layout classes must replace the small button's fixed
    // heights and padding, not sit next to them (cn() merges them).
    const bar = renderBar();
    for (const link of within(bar).getAllByRole("link")) {
      const classes = [...link.classList];
      expect(classes).toContain("flex-col");
      expect(classes).not.toContain("h-9");
      expect(classes).not.toContain("pointer-coarse:h-11");
      expect(classes).not.toContain("px-4");
      expect(classes).not.toContain("has-data-[icon=inline-start]:pl-3");
    }
  });
});
