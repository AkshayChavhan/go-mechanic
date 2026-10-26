import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { garage } from "@/content/garage";
import { formatAddress } from "@/i18n/format";
import { renderWithIntl } from "@/i18n/test-utils";
import { telHref, whatsappHref } from "@/lib/contact-links";
import messages from "../../../messages/en.json";

import { bookTarget, type NavItem } from "./navigation";
import { SiteHeader } from "./site-header";

// Expected text and links come from messages/en.json and src/content/garage.ts.
const bookingHref = whatsappHref(garage.whatsapp, messages.Contact.bookingMessage);
const whatsappBook = bookTarget(bookingHref, { href: "/book", live: false });
const demoItems: NavItem[] = [
  { label: "services", href: "/services", live: true },
  { label: "contact", href: "/contact", live: true },
];

describe("SiteHeader with no live pages (today)", () => {
  test("is the page's banner, with the Wordmark linking home", () => {
    renderWithIntl(<SiteHeader items={[]} book={whatsappBook} garage={garage} />);
    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("link", { name: messages.Brand.name }).getAttribute("href")).toBe("/");
  });

  test("has no navigation landmark when there's nothing to link to", () => {
    renderWithIntl(<SiteHeader items={[]} book={whatsappBook} garage={garage} />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  test('"Book a service" opens WhatsApp with the booking message, in a new tab, and says so', () => {
    renderWithIntl(<SiteHeader items={[]} book={whatsappBook} garage={garage} />);
    const book = screen.getByRole("link", { name: `${messages.Header.book} ${messages.Contact.opensWhatsApp}` });
    expect(book.getAttribute("href")).toBe(bookingHref);
    expect(new URL(book.getAttribute("href")!).searchParams.get("text")).toBe(messages.Contact.bookingMessage);
    expect(book.getAttribute("target")).toBe("_blank");
    // The one blue button in the header.
    expect(book.getAttribute("data-variant")).toBe("default");
  });

  test("the phone menu button is named from messages", () => {
    renderWithIntl(<SiteHeader items={[]} book={whatsappBook} garage={garage} />);
    expect(screen.getByRole("button", { name: messages.Header.openMenu })).toBeTruthy();
  });
});

describe("SiteHeader with live pages", () => {
  test("links to each page, in order, with labels from messages", () => {
    renderWithIntl(<SiteHeader items={demoItems} book={whatsappBook} garage={garage} />);
    const nav = screen.getByRole("navigation", { name: messages.Header.navLabel });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      [messages.Nav.services, "/services"],
      [messages.Nav.contact, "/contact"],
    ]);
  });

  test('"Book a service" goes to the booking page once it\'s live, in the same tab', () => {
    renderWithIntl(<SiteHeader items={[]} book={{ kind: "page", href: "/book" }} garage={garage} />);
    const book = screen.getByRole("link", { name: messages.Header.book });
    expect(book.getAttribute("href")).toBe("/book");
    expect(book.getAttribute("target")).toBeNull();
  });
});

describe("SiteHeader's phone menu", () => {
  function openMenu(items: NavItem[] = []) {
    renderWithIntl(<SiteHeader items={items} book={whatsappBook} garage={garage} />);
    fireEvent.click(screen.getByRole("button", { name: messages.Header.openMenu }));
    return screen.getByRole("dialog", { name: messages.Header.menuTitle });
  }

  test("holds the open status, the hours and the address, even with no live pages", () => {
    const menu = openMenu();
    expect(menu.querySelector("[data-open-status]")).not.toBeNull();
    expect(within(menu).getByRole("heading", { name: messages.Hours.title })).toBeTruthy();
    expect(within(menu).getByText(messages.Hours.indiaTime)).toBeTruthy();
    expect(within(menu).getByText(formatAddress(garage.address, "en"))).toBeTruthy();
    expect(within(menu).queryByRole("navigation")).toBeNull();
  });

  test("calls the garage, and opens WhatsApp with the general message", () => {
    const menu = openMenu();
    expect(within(menu).getByRole("link", { name: messages.Contact.call }).getAttribute("href")).toBe(
      telHref(garage.phone),
    );
    const whatsapp = within(menu).getByRole("link", {
      name: `${messages.Contact.whatsapp} ${messages.Contact.opensWhatsApp}`,
    });
    expect(new URL(whatsapp.getAttribute("href")!).searchParams.get("text")).toBe(messages.Contact.whatsappMessage);
  });

  test("lists the live pages, and following one closes the menu", () => {
    const menu = openMenu(demoItems);
    const nav = within(menu).getByRole("navigation", { name: messages.Header.navLabel });
    // jsdom can't load another page. This listener on document runs after
    // React's own click handling (React listens lower down, on its root), so
    // the menu still sees a normal click; it only stops jsdom's page load.
    const stayOnPage = (event: Event) => event.preventDefault();
    document.addEventListener("click", stayOnPage);
    try {
      fireEvent.click(within(nav).getByRole("link", { name: messages.Nav.services }));
    } finally {
      document.removeEventListener("click", stayOnPage);
    }
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
