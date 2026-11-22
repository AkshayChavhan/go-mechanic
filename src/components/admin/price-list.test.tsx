import { screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import { draftServices } from "@/server/db/service-seed-data";
import { draftCatalogue } from "@/server/db/vehicle-seed-data";
import messages from "../../../messages/en.json";

import { PriceList } from "./price-list";

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../messages/en.json");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "AdminPrices" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const t = messages.AdminPrices;

async function list(prices: { serviceId: string; categoryId: string; fuel: null; pricePaise: number }[] = []) {
  return renderWithIntl(await PriceList({ locale: "en", services: draftServices, prices, catalogue: draftCatalogue }));
}

describe("PriceList", () => {
  test("services, then packages named with their vehicles, each a link to its price page", async () => {
    await list();
    expect(screen.getByRole("heading", { level: 1, name: t.heading })).toBeTruthy();
    const services = screen.getByRole("region", { name: t.servicesHeading });
    expect(within(services).getByRole("link", { name: /^Periodic service/ }).getAttribute("href")).toBe("/admin/prices/periodic-service");
    const packages = screen.getByRole("region", { name: t.packagesHeading });
    expect(within(packages).getByRole("link", { name: /^Basic service, for cars/ }).getAttribute("href")).toBe("/admin/prices/car-basic");
    expect(within(packages).getByRole("link", { name: /^Basic service, for two-wheelers/ })).toBeTruthy();
  });

  test("how many vehicle types are priced, none yet, or priced after inspection", async () => {
    await list([
      { serviceId: "periodic-service", categoryId: "hatchback", fuel: null, pricePaise: 150_000 },
      { serviceId: "periodic-service", categoryId: "sedan", fuel: null, pricePaise: 170_000 },
    ]);
    // Periodic service covers cars and two-wheelers: 3 car groups and 3 two-wheeler groups.
    expect(screen.getByRole("link", { name: /^Periodic service/ }).textContent).toContain("2 of 6 vehicle types priced");
    expect(screen.getByRole("link", { name: /^Brakes/ }).textContent).toContain(t.listStatus.none);
    expect(screen.getByRole("link", { name: /^Denting and painting/ }).textContent).toContain(t.listStatus.onInspection);
  });
});
