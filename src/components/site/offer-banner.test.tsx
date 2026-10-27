import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider, type Locale } from "next-intl";
import { describe, expect, test } from "vitest";

import { currentOffer, type Offer } from "@/content/offer";
import { GARAGE_TIME_ZONE } from "@/i18n/config";
import { renderWithIntl } from "@/i18n/test-utils";
import messages from "../../../messages/en.json";

import { OfferBanner } from "./offer-banner";

const demoOffer: Offer = {
  text: { en: "10% off every car service this week", hi: "इस हफ़्ते हर कार सर्विस पर 10% छूट" },
  href: "/packages",
};

describe("OfferBanner", () => {
  test("renders nothing when there's no offer", () => {
    const { container } = renderWithIntl(<OfferBanner offer={null} />);
    expect(container.innerHTML).toBe("");
  });

  test("there is no offer today (src/content/offer.ts)", () => {
    expect(currentOffer).toBeNull();
  });

  test("shows the offer's text, labelled for screen readers", () => {
    renderWithIntl(<OfferBanner offer={demoOffer} />);
    const banner = screen.getByRole("complementary", { name: messages.Offer.label });
    expect(banner.textContent).toContain(demoOffer.text.en);
  });

  test("shows the Hindi text on a Hindi page", () => {
    // Hindi isn't one of the site's languages yet (src/i18n/config.ts), so the
    // type doesn't allow "hi"; the banner must still pick the Hindi text then.
    const hindi = "hi" as string as Locale;
    render(
      <NextIntlClientProvider locale={hindi} messages={messages} timeZone={GARAGE_TIME_ZONE}>
        <OfferBanner offer={demoOffer} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(demoOffer.text.hi!)).toBeTruthy();
  });

  test("leaves the link out while its page isn't live", () => {
    renderWithIntl(<OfferBanner offer={demoOffer} pages={[{ href: "/packages", live: false }]} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  test("links to the page once it's live", () => {
    renderWithIntl(<OfferBanner offer={demoOffer} pages={[{ href: "/packages", live: true }]} />);
    expect(screen.getByRole("link", { name: messages.Offer.more }).getAttribute("href")).toBe("/packages");
  });

  test("an offer without a link shows only its text", () => {
    renderWithIntl(<OfferBanner offer={{ text: demoOffer.text }} pages={[{ href: "/packages", live: true }]} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
