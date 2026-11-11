import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import { readGarage } from "@/server/dal/garage";
import { readVehicleCatalogue } from "@/server/dal/vehicles";
import { ownerGarage } from "@/server/db/seed-data";
import { draftCatalogue } from "@/server/db/vehicle-seed-data";
import messages from "../../../../../../../messages/en.json";

import AddVehiclePage, { generateMetadata } from "./page";

// The page is an async Server Component: each test renders `await
// AddVehiclePage()`. Stand-ins replace what only works inside a Next.js
// request: the cached reads, the Server Action, and getTranslations
// (next-intl's own translator over the real messages). The gate reads the
// session: it's tested on its own (add-vehicle-gate.test.tsx), and here it's
// a marker, so the test can see where the page puts it.
vi.mock("@/server/dal/garage", () => ({ readGarage: vi.fn() }));
vi.mock("@/server/dal/vehicles", () => ({ readVehicleCatalogue: vi.fn() }));
vi.mock("@/server/actions/account", () => ({ addVehicle: vi.fn() }));
vi.mock("./add-vehicle-gate", () => ({ AddVehicleGate: () => <span data-testid="add-vehicle-gate" /> }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../../../../messages/en.json");
  return {
    getLocale: async () => "en",
    getTranslations: async (namespace: string | { locale: "en"; namespace: string }) =>
      createTranslator({
        locale: "en",
        messages: allMessages,
        namespace: (typeof namespace === "string" ? namespace : namespace.namespace) as "MyVehicles",
      }),
  };
});

const t = messages.MyVehicles;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readGarage).mockResolvedValue(ownerGarage);
  vi.mocked(readVehicleCatalogue).mockResolvedValue(draftCatalogue);
});

describe("/account/vehicles/new", () => {
  test("one h1, why the details are asked, the form and the way back", async () => {
    renderWithIntl(await AddVehiclePage());
    expect(screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent)).toEqual([t.formHeading]);
    expect(screen.getByText(t.formNote)).toBeTruthy();
    expect(screen.getByRole("combobox", { name: messages.Vehicles.picker.modelLabel })).toBeTruthy();
    expect(screen.getByLabelText(t.registrationLabel)).toBeTruthy();
    expect(screen.getByRole("link", { name: t.backLink }).getAttribute("href")).toBe("/account");
  });

  test("the gate (it reads the session) sits outside the form, so the form is built ahead of time", async () => {
    renderWithIntl(await AddVehiclePage());
    const gate = screen.getByTestId("add-vehicle-gate");
    expect(screen.getByRole("button", { name: t.submit }).closest("form")!.contains(gate)).toBe(false);
  });

  test("offers the garage's phone and WhatsApp for a vehicle the picker doesn't list", async () => {
    renderWithIntl(await AddVehiclePage());
    expect(screen.getByText(t.notListed)).toBeTruthy();
    expect(screen.getByRole("link", { name: messages.Contact.call }).getAttribute("href")).toBe(`tel:${ownerGarage.phone}`);
    expect(screen.getByRole("link", { name: new RegExp(messages.Contact.whatsapp) }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\//);
  });

  test("with an empty catalogue: the message and the contact links, no form", async () => {
    vi.mocked(readVehicleCatalogue).mockResolvedValue({ categories: [], makes: [] });
    renderWithIntl(await AddVehiclePage());
    expect(screen.getByText(t.noCatalogue)).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: t.submit })).toBeNull();
    expect(screen.getByRole("link", { name: messages.Contact.call })).toBeTruthy();
  });

  test("metadata: the title with the brand, and noindex", async () => {
    expect(await generateMetadata()).toEqual({
      title: `Add a vehicle | ${messages.Brand.name}`,
      robots: { index: false, follow: false },
    });
  });
});
