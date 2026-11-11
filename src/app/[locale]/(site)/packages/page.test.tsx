import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import { readGarage } from "@/server/dal/garage";
import { readServicePrices, readServices } from "@/server/dal/services";
import { readVehicleCatalogue } from "@/server/dal/vehicles";
import { ownerGarage } from "@/server/db/seed-data";
import { draftServices } from "@/server/db/service-seed-data";
import { draftCatalogue } from "@/server/db/vehicle-seed-data";
import messages from "../../../../../messages/en.json";

import PackagesPage, { ensureStatic, generateMetadata } from "./page";

// An async Server Component: each test renders `await PackagesPage()` with the
// cached reads replaced by the seed data and no real prices, and
// next-intl/server by next-intl's own translator.
vi.mock("@/server/dal/garage", () => ({ readGarage: vi.fn() }));
vi.mock("@/server/dal/services", () => ({ readServices: vi.fn(), readServicePrices: vi.fn() }));
vi.mock("@/server/dal/vehicles", () => ({ readVehicleCatalogue: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../../messages/en.json");
  return {
    getLocale: async () => "en",
    getTranslations: async (namespace: "Packages") => createTranslator({ locale: "en", messages: allMessages, namespace }),
  };
});

const t = messages.Packages;
const packages = draftServices.filter((service) => service.kind === "package");

beforeEach(() => {
  vi.mocked(readGarage).mockResolvedValue(ownerGarage);
  vi.mocked(readServices).mockResolvedValue([...draftServices]);
  vi.mocked(readServicePrices).mockResolvedValue([]);
  vi.mocked(readVehicleCatalogue).mockResolvedValue(draftCatalogue);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** The package names (h3) in one kind's section. */
function cardsOf(title: string) {
  const section = screen.getByRole("heading", { level: 2, name: title }).closest("section")!;
  return within(section).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
}

describe("/packages", () => {
  test("is built ahead of time, with a title naming the area", async () => {
    expect(ensureStatic).toBe("navigation");
    expect((await generateMetadata()).title).toContain("Kiwale, Pune");
  });

  test("shows Basic, Standard and Comprehensive for cars, then for two-wheelers, with their checklists", async () => {
    renderWithIntl(await PackagesPage());
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      t.cars,
      t.twoWheelers,
      t.actionsTitle,
    ]);
    const names = ["Basic service", "Standard service", "Comprehensive service"];
    expect(cardsOf(t.cars)).toEqual(names);
    expect(cardsOf(t.twoWheelers)).toEqual(names);
    const carBasic = packages[0]!;
    for (const line of carBasic.included) expect(screen.getAllByText(line.en).length).toBeGreaterThan(0);
  });

  test("links to each kind's section from the top", async () => {
    renderWithIntl(await PackagesPage());
    const jump = screen.getByRole("navigation", { name: t.jumpTo });
    const links = within(jump).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["#cars", "#two-wheelers"]);
    expect(document.getElementById("cars")).toBeTruthy();
    expect(document.getElementById("two-wheelers")).toBeTruthy();
  });

  test("outside npm run dev: no price finder, no price, and each card says to call or WhatsApp", async () => {
    const { container } = renderWithIntl(await PackagesPage());
    expect(container.textContent).not.toContain("₹");
    expect(container.querySelector("[data-sample]")).toBeNull();
    expect(screen.queryByText(t.finder.title)).toBeNull();
    expect(screen.getAllByText(t.callForPrice)).toHaveLength(packages.length);
    expect(readVehicleCatalogue).not.toHaveBeenCalled();
  });

  test("with a real price: that card's From price in every build, unmarked; the others ask to call; no finder", async () => {
    vi.mocked(readServicePrices).mockResolvedValue([
      { serviceId: "car-basic", categoryId: "hatchback", fuel: null, pricePaise: 249_900 },
    ]);
    const { container } = renderWithIntl(await PackagesPage());
    expect(container.querySelector("[data-sample]")).toBeNull();
    const basic = screen.getAllByRole("heading", { level: 3, name: "Basic service" })[0]!.closest('[data-slot="card"]')!;
    expect(basic.textContent).toContain("From ₹2,499");
    expect(screen.getAllByText(t.callForPrice)).toHaveLength(packages.length - 1);
    expect(screen.queryByText(t.finder.title)).toBeNull();
  });

  test("one action group at the end: Book as the only blue button", async () => {
    const { container } = renderWithIntl(await PackagesPage());
    const blue = container.querySelectorAll('[data-slot="button"][data-variant="default"]');
    expect(blue).toHaveLength(1);
    expect(blue[0]!.closest("section")).toBe(
      screen.getByRole("heading", { name: t.actionsTitle }).closest("section"),
    );
  });

  test("under npm run dev: the price finder first, and a marked sample 'From' price on each card", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { container } = renderWithIntl(await PackagesPage());
    expect(container.querySelector('[data-sample="price-finder"]')).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: new RegExp(t.finder.title) })).toBeTruthy();
    const prices = container.querySelectorAll('[data-sample="package-price"]');
    expect(prices).toHaveLength(packages.length);
    expect(prices[0]!.textContent).toContain("From ₹2,499");
  });
});
