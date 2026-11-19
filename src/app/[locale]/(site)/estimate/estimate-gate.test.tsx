import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { PhotoUploaderLabels } from "@/components/site/photo-uploader";
import type { VehiclePickerLabels } from "@/components/site/vehicle-picker";
import { renderWithIntl } from "@/i18n/test-utils";
import { getCurrentUser } from "@/server/auth/session";
import { listMyVehicles } from "@/server/dal/customer-vehicles";
import { readMyProfile } from "@/server/dal/profile";
import { draftCatalogue } from "@/server/db/vehicle-seed-data";
import messages from "../../../../../messages/en.json";

import { EstimateGate, type EstimateGateProps } from "./estimate-gate";

// EstimateGate is an async Server Component: each test calls it and renders
// what it returns. The session, the profile and the vehicles are stand-ins;
// the form is the real one (estimate-form.test.tsx tests it in depth).
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/dal/profile", () => ({ readMyProfile: vi.fn() }));
vi.mock("@/server/dal/customer-vehicles", () => ({ listMyVehicles: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../../messages/en.json");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "EstimatePage" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const t = messages.EstimatePage;
const asha = { id: "asha", phoneNumber: "+919876500001", role: "customer" as const };

const props: EstimateGateProps = {
  locale: "en",
  action: vi.fn(),
  startPhotos: vi.fn(),
  finishPhotos: vi.fn(),
  catalogue: draftCatalogue,
  labels: {
    vehicleLegend: t.vehicleLegend,
    otherVehicle: t.otherVehicle,
    descriptionLabel: t.descriptionLabel,
    descriptionHint: t.descriptionHint,
    descriptionCount: t.descriptionCount,
    photosLegend: t.photosLegend,
    photosHint: t.photosHint,
    submit: t.submit,
    sending: t.sending,
    waitingForPhotos: t.waitingForPhotos,
    connection: messages.Login.errors.connection,
  },
  // The form only passes these on; the picker isn't shown with a saved vehicle.
  pickerLabels: {} as VehiclePickerLabels,
  photoLabels: messages.Photos.uploader satisfies PhotoUploaderLabels,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(asha);
  vi.mocked(readMyProfile).mockResolvedValue({ name: "Asha Patil", phoneNumber: asha.phoneNumber });
  vi.mocked(listMyVehicles).mockResolvedValue([
    {
      id: "11111111-2222-4333-8444-555555555555",
      kind: "car",
      modelId: "car-honda-city",
      makeName: { en: "Honda" },
      modelName: { en: "City" },
      fuel: "petrol",
      registrationNumber: "MH12AB1234",
      pucExpiresOn: null,
      insuranceExpiresOn: null,
    },
  ]);
});

describe("EstimateGate", () => {
  test("logged out: a line and a link to log in, no form, and nothing personal is read", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    renderWithIntl(await EstimateGate(props));
    expect(screen.getByText(t.loginNote)).toBeTruthy();
    expect(screen.getByRole("link", { name: t.loginLink }).getAttribute("href")).toBe("/login");
    expect(screen.queryByRole("button", { name: t.submit })).toBeNull();
    expect(readMyProfile).not.toHaveBeenCalled();
    expect(listMyVehicles).not.toHaveBeenCalled();
  });

  test("no name yet: a link to the account, where the name form is", async () => {
    vi.mocked(readMyProfile).mockResolvedValue({ name: "", phoneNumber: asha.phoneNumber });
    renderWithIntl(await EstimateGate(props));
    expect(screen.getByText(t.nameNote)).toBeTruthy();
    expect(screen.getByRole("link", { name: t.nameLink }).getAttribute("href")).toBe("/account");
    expect(screen.queryByRole("button", { name: t.submit })).toBeNull();
  });

  test("with a name: the form, the saved vehicle a choice by brand, model and number", async () => {
    renderWithIntl(await EstimateGate(props));
    expect(screen.getByRole("button", { name: t.submit })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Honda City · MH 12 AB 1234" })).toBeTruthy();
  });

  test("no saved vehicle and no catalogue: a line to call instead, no form", async () => {
    vi.mocked(listMyVehicles).mockResolvedValue([]);
    renderWithIntl(await EstimateGate({ ...props, catalogue: { categories: [], makes: [] } }));
    expect(screen.getByText(t.noCatalogue)).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.submit })).toBeNull();
  });
});
