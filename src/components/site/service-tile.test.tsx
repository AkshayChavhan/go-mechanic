import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { Service } from "@/domain/services";
import { renderWithIntl } from "@/i18n/test-utils";
import { draftServices } from "@/server/db/service-seed-data";
import messages from "../../../messages/en.json";

import { ServiceTile } from "./service-tile";

const vehicles = messages.HomePage.services.vehicles;

const tile = (overrides: Partial<Service> = {}): Service => ({
  id: "brakes",
  kind: "service",
  name: { en: "Brakes" },
  summary: { en: "Brake pads, shoes, discs and fluid, checked and replaced." },
  vehicleKinds: ["car", "two-wheeler"],
  fuels: ["petrol"],
  included: [{ en: "Pads checked" }],
  signs: [],
  pricedAfterInspection: false,
  ...overrides,
});

const services = draftServices.filter((service) => service.kind === "service");

describe("ServiceTile", () => {
  test("shows the service's name as a heading, and its summary", () => {
    renderWithIntl(<ServiceTile service={tile()} />);
    expect(screen.getByRole("heading", { level: 3, name: "Brakes" })).toBeTruthy();
    expect(screen.getByText("Brake pads, shoes, discs and fluid, checked and replaced.")).toBeTruthy();
  });

  test.each([
    [["car", "two-wheeler"], vehicles.both],
    [["car"], vehicles.car],
    [["two-wheeler"], vehicles.twoWheeler],
  ] as const)("says which vehicles it's for: %j -> %s", (kinds, text) => {
    renderWithIntl(<ServiceTile service={tile({ vehicleKinds: kinds })} />);
    expect(screen.getByText(text)).toBeTruthy();
  });

  test("without href: isn't a link, and holds no link or button", () => {
    const { container } = renderWithIntl(<ServiceTile service={tile()} />);
    expect(container.querySelector("a, button")).toBeNull();
  });

  test("with href: one link, named after the service, stretched over the tile", () => {
    const { container } = renderWithIntl(<ServiceTile service={tile()} href="/services/brakes" />);
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Brakes" }).getAttribute("href")).toBe("/services/brakes");
    expect(links[0]!.className).toContain("after:inset-0");
    expect(container.querySelector('[data-slot="card"]')!.className).toContain("relative");
  });

  test("shows no price unless it gets one", () => {
    const { container } = renderWithIntl(<ServiceTile service={tile()} fromPaise={null} />);
    expect(container.textContent).not.toContain("₹");
  });

  test("a real price: From ₹…, unmarked; a sample: marked with data-sample and the Sample badge", () => {
    const real = renderWithIntl(<ServiceTile service={tile()} fromPaise={129_900} />);
    expect(real.container.textContent).toContain("From ₹1,299");
    expect(real.container.querySelector("[data-sample]")).toBeNull();
    real.unmount();

    const { container } = renderWithIntl(<ServiceTile service={tile()} fromPaise={129_900} sample />);
    const mark = container.querySelector('[data-sample="service-price"]')!;
    expect(mark.textContent).toContain("From ₹1,299");
    expect(mark.textContent).toContain(messages.HomePage.sample);
  });

  test("a service with no icon of its own gets the wrench", () => {
    const wrench = renderWithIntl(<ServiceTile service={tile({ id: "periodic-service" })} />);
    const wrenchClass = wrench.container.querySelector("svg")!.getAttribute("class");
    wrench.unmount();
    const { container } = renderWithIntl(<ServiceTile service={tile({ id: "towing" })} />);
    expect(container.querySelector("svg")!.getAttribute("class")).toBe(wrenchClass);
  });

  test("every seeded service has its own icon, hidden from screen readers", () => {
    const icons = services.map((service) => {
      const { container, unmount } = renderWithIntl(<ServiceTile service={service} />);
      const svg = container.querySelector("svg")!;
      expect(svg.getAttribute("aria-hidden"), service.id).toBe("true");
      const name = svg.getAttribute("class");
      unmount();
      return name;
    });
    expect(new Set(icons).size).toBe(services.length);
  });
});
