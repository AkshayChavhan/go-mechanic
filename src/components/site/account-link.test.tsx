import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import messages from "../../../messages/en.json";

import { AccountLink } from "./account-link";

describe("AccountLink", () => {
  test("one link named Account, to /account, at every width", () => {
    renderWithIntl(<AccountLink />);
    const links = screen.getAllByRole("link", { name: messages.Account.headerLink });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/account");
  });

  test("the word is the name below 1024px too: hidden only visually there, the icon hidden from screen readers", () => {
    renderWithIntl(<AccountLink />);
    const link = screen.getByRole("link", { name: messages.Account.headerLink });
    const word = link.querySelector("span")!;
    expect(word.textContent).toBe(messages.Account.headerLink);
    expect(word.className).toContain("sr-only");
    expect(word.className).toContain("lg:not-sr-only");
    expect(link.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });

  test("never the blue default button: a ghost one", () => {
    renderWithIntl(<AccountLink />);
    expect(screen.getByRole("link", { name: messages.Account.headerLink }).getAttribute("data-variant")).toBe("ghost");
  });
});
