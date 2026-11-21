import { screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import type { ServicePrice } from "@/domain/services";
import type { VehicleCatalogue } from "@/domain/vehicles";
import { renderWithIntl } from "@/i18n/test-utils";
import { draftServices } from "@/server/db/service-seed-data";
import { draftCatalogue } from "@/server/db/vehicle-seed-data";
import messages from "../../../messages/en.json";

import { ServicePriceEditor } from "./service-price-editor";

vi.mock("@/server/actions/prices", () => ({ savePrices: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../messages/en.json");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "AdminPrices" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const t = messages.AdminPrices;
const byId = (id: string) => draftServices.find((service) => service.id === id)!;

async function editor(id: string, prices: ServicePrice[] = [], catalogue: VehicleCatalogue = draftCatalogue) {
  return renderWithIntl(await ServicePriceEditor({ locale: "en", service: byId(id), prices, catalogue }));
}

const cards = () => screen.getAllByRole("region").map((card) => within(card).getByRole("heading").textContent);

describe("ServicePriceEditor", () => {
  test("a car package: a card per car type, each with its own named Save button, and a link back", async () => {
    await editor("car-basic");
    expect(screen.getByRole("heading", { level: 1, name: "Basic service, for cars" })).toBeTruthy();
    expect(screen.getByRole("link", { name: t.back }).getAttribute("href")).toBe("/admin/prices");
    expect(cards()).toEqual(["Hatchback", "Sedan", "SUV or MUV"]);
    for (const group of ["Hatchback", "Sedan", "SUV or MUV"]) {
      const card = screen.getByRole("region", { name: group });
      expect(within(card).getByRole("button", { name: `Save ${group} prices` })).toBeTruthy();
    }
  });

  test("a two-wheeler package: its types; one that runs on one fuel only has no fold", async () => {
    await editor("two-wheeler-basic");
    expect(cards()).toEqual(["Scooter", "Motorcycle", "Premium motorcycle"]);
    // Premium motorcycles are all petrol in the draft catalogue.
    expect(within(screen.getByRole("region", { name: "Premium motorcycle" })).queryByText(t.fuelsSummary)).toBeNull();
    // Motorcycles run on petrol and CNG, and the package covers both.
    const motorcycle = screen.getByRole("region", { name: "Motorcycle" });
    expect(within(motorcycle).getByText(t.fuelsSummary)).toBeTruthy();
    expect(within(motorcycle).getByLabelText("CNG")).toBeTruthy();
  });

  test("the boxes start with the saved amounts; the fold is open when a fuel has its own price", async () => {
    await editor("periodic-service", [
      { serviceId: "periodic-service", categoryId: "hatchback", fuel: null, pricePaise: 150_000 },
      { serviceId: "periodic-service", categoryId: "hatchback", fuel: "diesel", pricePaise: 180_000 },
      { serviceId: "brakes", categoryId: "hatchback", fuel: null, pricePaise: 1 },
    ]);
    const hatchback = screen.getByRole("region", { name: "Hatchback" });
    expect((within(hatchback).getByLabelText(t.groupLabel) as HTMLInputElement).value).toBe("1,500");
    expect((within(hatchback).getByLabelText("Diesel") as HTMLInputElement).value).toBe("1,800");
    expect(hatchback.querySelector("details")?.open).toBe(true);
    const sedan = screen.getByRole("region", { name: "Sedan" });
    expect((within(sedan).getByLabelText(t.groupLabel) as HTMLInputElement).value).toBe("");
    expect(sedan.querySelector("details")?.open).toBe(false);
  });

  test.each([
    ["only that fuel's own price", [250_000]],
    ["an every-fuel price and that fuel's own price", [200_000, 250_000]],
  ])("a one-fuel group shows the price its customers pay: %s", async (_, amounts) => {
    // Premium motorcycles are all petrol: the card has no fold, so its one box
    // must show what priceFor charges (the fuel's own row wins), or a Save
    // without a change would replace that price with the box's.
    const rows: ServicePrice[] = amounts.map((pricePaise, index) => ({
      serviceId: "two-wheeler-basic",
      categoryId: "premium-motorcycle",
      fuel: index === amounts.length - 1 ? "petrol" : null,
      pricePaise,
    }));
    await editor("two-wheeler-basic", rows);
    const card = screen.getByRole("region", { name: "Premium motorcycle" });
    expect((within(card).getByLabelText(t.groupLabel) as HTMLInputElement).value).toBe("2,500");
  });

  test("a group none of whose models runs on a covered fuel: a note, no form", async () => {
    const electricSuvs: VehicleCatalogue = {
      ...draftCatalogue,
      makes: draftCatalogue.makes.map((make) => ({
        ...make,
        models: make.models.map((model) => (model.categoryId === "suv" ? { ...model, fuels: ["electric"] } : model)),
      })),
    };
    await editor("car-basic", [], electricSuvs);
    const suv = screen.getByRole("region", { name: "SUV or MUV" });
    expect(within(suv).getByText(t.notOffered)).toBeTruthy();
    expect(within(suv).queryByRole("button")).toBeNull();
  });

  test("a service priced after an inspection: the note, no cards", async () => {
    await editor("denting-painting");
    expect(screen.getByText(t.onInspectionNote)).toBeTruthy();
    expect(screen.queryAllByRole("region")).toEqual([]);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
