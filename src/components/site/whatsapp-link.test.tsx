import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Button } from "@/components/ui/button";
import { renderWithIntl } from "@/i18n/test-utils";
import messages from "../../../messages/en.json";

import { WhatsAppLink } from "./whatsapp-link";

const href = "https://wa.me/919764750567?text=Hi";

describe("WhatsAppLink", () => {
  test("opens in a new tab, safely", () => {
    renderWithIntl(<WhatsAppLink href={href}>{messages.Contact.whatsapp}</WhatsAppLink>);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(href);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("tells screen readers it opens WhatsApp, and hides the icon from them", () => {
    renderWithIntl(<WhatsAppLink href={href}>{messages.Contact.whatsapp}</WhatsAppLink>);
    const name = `${messages.Contact.whatsapp} ${messages.Contact.opensWhatsApp}`;
    const link = screen.getByRole("link", { name });
    expect(link.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  test("takes a button's look through <Button asChild>", () => {
    renderWithIntl(
      <Button asChild variant="secondary">
        <WhatsAppLink href={href} target="_self">
          {messages.Contact.whatsapp}
        </WhatsAppLink>
      </Button>,
    );
    const link = screen.getByRole("link");
    expect(link.getAttribute("data-variant")).toBe("secondary");
    // A passed target can't undo the new tab.
    expect(link.getAttribute("target")).toBe("_blank");
  });
});
