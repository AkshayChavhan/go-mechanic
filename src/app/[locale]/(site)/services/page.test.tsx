import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import { readServicePrices, readServices } from "@/server/dal/services";
import { draftServices } from "@/server/db/service-seed-data";
import messages from "../../../../../messages/en.json";

import ServicesPage, { ensureStatic, generateMetadata } from "./page";

// The page is an async Server Component: each test renders `await
// ServicesPage()`, with the cached reads replaced by the draft services and
// no real prices, and next-intl/server by next-intl's own translator.
vi.mock("@/server/dal/services", () => ({ readServices: vi.fn(), readServicePrices: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../../messages/en.json");
  return {
    getLocale: async () => "en",
    getTranslations: async (namespace: "Services") => createTranslator({ locale: "en", messages: allMessages, namespace }),
  };
});

const t = messages.Services;
const services = draftServices.filter((service) => service.kind === "service");

beforeEach(() => {
  vi.mocked(readServices).mockResolvedValue([...draftServices]);
  vi.mocked(readServicePrices).mockResolvedValue([]);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/services", () => {
  test("is built ahead of time, with a title naming the area", async () => {
    expect(ensureStatic).toBe("navigation");
    const metadata = await generateMetadata();
    expect(metadata.title).toContain("Kiwale, Pune");
    expect(metadata.description).toBeTruthy();
  });

  test("lists the eleven services in order, each a link to its page, and no packages", async () => {
    renderWithIntl(await ServicesPage());
    expect(screen.getByRole("heading", { level: 1, name: t.title })).toBeTruthy();
    const links = within(screen.getByRole("list")).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual(
      services.map((service) => [service.name.en, `/services/${service.id}`]),
    );
  });

  test("outside npm run dev: no price and no sample anywhere", async () => {
    const { container } = renderWithIntl(await ServicesPage());
    expect(container.textContent).not.toContain("₹");
    expect(container.querySelector("[data-sample]")).toBeNull();
  });

  test("under npm run dev: a sample 'From' price on each list-priced service, marked", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { container } = renderWithIntl(await ServicesPage());
    const priced = services.filter((service) => !service.pricedAfterInspection);
    const marks = container.querySelectorAll('[data-sample="service-price"]');
    expect(marks).toHaveLength(priced.length);
    for (const mark of marks) {
      expect(mark.textContent).toMatch(/^From ₹[\d,]+/);
      expect(mark.textContent).toContain(messages.HomePage.sample);
    }
  });

  test("with a real price: that price, in every build, without the Sample mark", async () => {
    vi.mocked(readServicePrices).mockResolvedValue([
      { serviceId: "brakes", categoryId: "hatchback", fuel: null, pricePaise: 140_000 },
    ]);
    const { container } = renderWithIntl(await ServicesPage());
    expect(container.querySelector("[data-sample]")).toBeNull();
    const brakes = screen.getByRole("link", { name: "Brakes" }).closest('[data-slot="card"]')!;
    expect(brakes.textContent).toContain("From ₹1,400");
  });
});
