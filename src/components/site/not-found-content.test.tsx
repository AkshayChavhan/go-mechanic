import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ownerGarage } from "@/server/db/seed-data";
import { renderWithIntl } from "@/i18n/test-utils";
import { telHref } from "@/lib/contact-links";
import messages from "../../../messages/en.json";

import { NotFoundContent } from "./not-found-content";

describe("NotFoundContent (both 404 pages)", () => {
  test("has one level-1 heading and the explanation, from messages", () => {
    renderWithIntl(<NotFoundContent garage={ownerGarage} />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings.map((heading) => heading.textContent)).toEqual([messages.NotFound.title]);
    expect(screen.getByText(messages.NotFound.description)).toBeTruthy();
  });

  test("can show its heading as h2, for a sample on a page that has its own h1", () => {
    renderWithIntl(<NotFoundContent garage={ownerGarage} titleAs="h2" />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(messages.NotFound.title);
  });

  test("leads home with the one blue button", () => {
    renderWithIntl(<NotFoundContent garage={ownerGarage} />);
    const home = screen.getByRole("link", { name: messages.NotFound.backHome });
    expect(home.getAttribute("href")).toBe("/");
    const blue = screen.getAllByRole("link").filter((link) => link.getAttribute("data-variant") === "default");
    expect(blue).toEqual([home]);
  });

  test("offers Call and WhatsApp for a visitor who just wants the garage", () => {
    renderWithIntl(<NotFoundContent garage={ownerGarage} />);
    expect(screen.getByRole("link", { name: messages.Contact.call }).getAttribute("href")).toBe(telHref(ownerGarage.phone));
    const whatsapp = screen.getByRole("link", { name: `${messages.Contact.whatsapp} ${messages.Contact.opensWhatsApp}` });
    expect(whatsapp.getAttribute("target")).toBe("_blank");
  });
});
