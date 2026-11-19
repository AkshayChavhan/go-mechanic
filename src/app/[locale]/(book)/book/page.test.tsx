import { screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ServicePrice } from "@/domain/services";
import { defaultLocale, GARAGE_TIME_ZONE } from "@/i18n/config";
import { renderWithIntl } from "@/i18n/test-utils";
import { readGarage } from "@/server/dal/garage";
import { readServicePrices, readServices } from "@/server/dal/services";
import { readVehicleCatalogue } from "@/server/dal/vehicles";
import { ownerGarage } from "@/server/db/seed-data";
import { draftServices } from "@/server/db/service-seed-data";
import { draftCatalogue } from "@/server/db/vehicle-seed-data";
import messages from "../../../../../messages/en.json";

import { BookingLoader } from "./booking-loader";
import BookPage, { generateMetadata } from "./page";

// /book is an async Server Component: each test renders `await BookPage()`.
// Stand-ins replace what only works inside a Next.js request: the cached
// reads, the Server Actions and getTranslations (next-intl's own translator
// over the real messages). The loader reads the session and the live slots:
// it's tested on its own (booking-loader.test.tsx), and here it's a marker
// that records what the page passes it.
vi.mock("@/server/dal/garage", () => ({ readGarage: vi.fn() }));
vi.mock("@/server/dal/vehicles", () => ({ readVehicleCatalogue: vi.fn() }));
vi.mock("@/server/dal/services", () => ({ readServices: vi.fn(), readServicePrices: vi.fn() }));
vi.mock("@/server/actions/booking", () => ({ bookingLoginStep: vi.fn(), confirmBooking: vi.fn(), notMe: vi.fn() }));
vi.mock("./booking-loader", () => ({ BookingLoader: vi.fn(() => <span data-testid="booking-loader" />) }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../../messages/en.json");
  return {
    getLocale: async () => "en",
    getMessages: async () => allMessages,
    getTranslations: async (namespace: string | { locale: "en"; namespace: string }) =>
      createTranslator({
        locale: "en",
        messages: allMessages,
        namespace: (typeof namespace === "string" ? namespace : namespace.namespace) as "Booking",
      }),
  };
});

const t = messages.Booking;
const brand = messages.Brand.name;
const realPrices: ServicePrice[] = [{ serviceId: draftServices[0].id, categoryId: "hatchback", fuel: null, pricePaise: 249_900 }];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readGarage).mockResolvedValue(ownerGarage);
  vi.mocked(readVehicleCatalogue).mockResolvedValue(draftCatalogue);
  vi.mocked(readServices).mockResolvedValue([...draftServices]);
  vi.mocked(readServicePrices).mockResolvedValue(realPrices);
});

/** The props the page gave the loader on its last render. */
function loaderProps() {
  return vi.mocked(BookingLoader).mock.lastCall![0];
}

describe("/book", () => {
  test("one h1 and the intro, then the wizard's loader", async () => {
    renderWithIntl(await BookPage());
    expect(screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent)).toEqual([t.heading]);
    expect(screen.getByText(t.intro)).toBeTruthy();
    expect(screen.getByTestId("booking-loader")).toBeTruthy();
  });

  test("gives the loader the cached reads: the catalogue, the services, the real prices and the wizard's words", async () => {
    renderWithIntl(await BookPage());
    const props = loaderProps();
    expect(props.catalogue).toBe(draftCatalogue);
    expect(props.services).toEqual(draftServices);
    // Exactly what readServicePrices answered: never the dev sample prices.
    expect(props.prices).toBe(realPrices);
    expect(props.labels).toEqual(t.wizard);
    expect(props.loginLabels.phoneLabel).toBe(messages.Login.phoneLabel);
    expect(props.loginLabels.consentLabel).toBe(messages.Login.consentLabel.replace("{brand}", brand));
  });

  test("the contact links: Call dials the garage, WhatsApp opens with the booking message", async () => {
    renderWithIntl(await BookPage());
    renderWithIntl(<>{loaderProps().contactLinks}</>);
    expect(screen.getByRole("link", { name: messages.Contact.call }).getAttribute("href")).toBe(`tel:${ownerGarage.phone}`);
    const whatsapp = screen.getByRole("link", { name: new RegExp(messages.Contact.whatsapp) });
    expect(new URL(whatsapp.getAttribute("href")!).searchParams.get("text")).toBe(messages.Contact.bookingMessage);
  });

  test("without JavaScript: the server's HTML has a <noscript> saying so, with Call and WhatsApp", async () => {
    // React in the browser leaves <noscript> empty, so this reads the HTML
    // the server sends, which is what a visitor without JavaScript gets.
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale={defaultLocale} messages={messages} timeZone={GARAGE_TIME_ZONE}>
        {await BookPage()}
      </NextIntlClientProvider>,
    );
    const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(html)?.[1] ?? "";
    expect(noscript).toContain(t.noScript);
    expect(noscript).toContain(`href="tel:${ownerGarage.phone}"`);
    expect(noscript).toContain('href="https://wa.me/');
  });

  test("metadata: the title and description with the brand, and indexable (no robots)", async () => {
    expect(await generateMetadata()).toEqual({
      title: `Book a service | ${brand}`,
      description: t.metaDescription.replace("{brand}", brand),
    });
  });
});
