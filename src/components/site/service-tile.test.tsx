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

  test("isn't a link, and holds no link or button (no prices or service pages yet)", () => {
    const { container } = renderWithIntl(<ServiceTile service={tile()} />);
    expect(container.querySelector("a, button")).toBeNull();
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
