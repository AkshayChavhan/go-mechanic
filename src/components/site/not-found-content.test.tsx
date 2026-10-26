import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { garage } from "@/content/garage";
import { renderWithIntl } from "@/i18n/test-utils";
import { telHref } from "@/lib/contact-links";
import messages from "../../../messages/en.json";

import { NotFoundContent } from "./not-found-content";

describe("NotFoundContent (both 404 pages)", () => {
  test("has one level-1 heading and the explanation, from messages", () => {
    renderWithIntl(<NotFoundContent garage={garage} />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings.map((heading) => heading.textContent)).toEqual([messages.NotFound.title]);
    expect(screen.getByText(messages.NotFound.description)).toBeTruthy();
  });

  test("leads home with the one blue button", () => {
    renderWithIntl(<NotFoundContent garage={garage} />);
    const home = screen.getByRole("link", { name: messages.NotFound.backHome });
    expect(home.getAttribute("href")).toBe("/");
    const blue = screen.getAllByRole("link").filter((link) => link.getAttribute("data-variant") === "default");
    expect(blue).toEqual([home]);
  });

  test("offers Call and WhatsApp for a visitor who just wants the garage", () => {
    renderWithIntl(<NotFoundContent garage={garage} />);
    expect(screen.getByRole("link", { name: messages.Contact.call }).getAttribute("href")).toBe(telHref(garage.phone));
    const whatsapp = screen.getByRole("link", { name: `${messages.Contact.whatsapp} ${messages.Contact.opensWhatsApp}` });
    expect(whatsapp.getAttribute("target")).toBe("_blank");
  });
});
