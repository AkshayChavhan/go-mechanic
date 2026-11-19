import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import { readGarage } from "@/server/dal/garage";
import { readVehicleCatalogue } from "@/server/dal/vehicles";
import { ownerGarage } from "@/server/db/seed-data";
import { draftCatalogue } from "@/server/db/vehicle-seed-data";
import messages from "../../../../../messages/en.json";

import type { EstimateGateProps } from "./estimate-gate";
import EstimatePage, { generateMetadata } from "./page";

// The page is an async Server Component: each test renders `await
// EstimatePage()`. Stand-ins replace what only works inside a Next.js
// request: the cached reads, the Server Actions, and getTranslations
// (next-intl's own translator over the real messages). The gate reads the
// session: it's tested on its own (estimate-gate.test.tsx), and here it's a
// marker that keeps the props it was given.
vi.mock("@/server/dal/garage", () => ({ readGarage: vi.fn() }));
vi.mock("@/server/dal/vehicles", () => ({ readVehicleCatalogue: vi.fn() }));
vi.mock("@/server/actions/estimates", () => ({ sendEstimateRequest: vi.fn() }));
vi.mock("@/server/actions/photos", () => ({ startPhotos: vi.fn(), finishPhotos: vi.fn() }));
const gateProps = vi.hoisted(() => ({ last: null as null | EstimateGateProps }));
vi.mock("./estimate-gate", () => ({
  EstimateGate: (props: EstimateGateProps) => {
    gateProps.last = props;
    return <span data-testid="estimate-gate" />;
  },
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../../../messages/en.json");
  return {
    getLocale: async () => "en",
    getTranslations: async (namespace: string | { locale: "en"; namespace: string }) =>
      createTranslator({
        locale: "en",
        messages: allMessages,
        namespace: (typeof namespace === "string" ? namespace : namespace.namespace) as "EstimatePage",
      }),
  };
});

const t = messages.EstimatePage;

beforeEach(() => {
  vi.clearAllMocks();
  gateProps.last = null;
  vi.mocked(readGarage).mockResolvedValue(ownerGarage);
  vi.mocked(readVehicleCatalogue).mockResolvedValue(draftCatalogue);
});

describe("/estimate", () => {
  test("one h1, the lead, and the three steps in order", async () => {
    renderWithIntl(await EstimatePage());
    expect(screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent)).toEqual([t.heading]);
    expect(screen.getByText(t.lead)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: t.stepsHeading })).toBeTruthy();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      `1${t.steps.describe}`,
      `2${t.steps.photos}`,
      `3${t.steps.reply}`,
    ]);
  });

  test("the gate gets the cached catalogue, the actions and the form's words", async () => {
    renderWithIntl(await EstimatePage());
    expect(screen.getByTestId("estimate-gate")).toBeTruthy();
    expect(gateProps.last).toMatchObject({
      locale: "en",
      catalogue: draftCatalogue,
      labels: { submit: t.submit, descriptionCount: t.descriptionCount, waitingForPhotos: t.waitingForPhotos },
      photoLabels: { choose: messages.Photos.uploader.choose },
    });
    expect(typeof gateProps.last?.action).toBe("function");
    expect(typeof gateProps.last?.startPhotos).toBe("function");
  });

  test("offers the garage's phone and WhatsApp to anyone who'd rather talk", async () => {
    renderWithIntl(await EstimatePage());
    expect(screen.getByText(t.talkNote)).toBeTruthy();
    expect(screen.getByRole("link", { name: messages.Contact.call }).getAttribute("href")).toBe(`tel:${ownerGarage.phone}`);
    expect(screen.getByRole("link", { name: new RegExp(messages.Contact.whatsapp) }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\//);
  });

  test("metadata: the title with the brand and a description; indexable", async () => {
    expect(await generateMetadata()).toEqual({
      title: `Free estimate | ${messages.Brand.name}`,
      description: t.metaDescription,
    });
  });
});
