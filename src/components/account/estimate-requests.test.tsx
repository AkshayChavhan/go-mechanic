import { screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import type { EstimateRequestRow } from "@/server/dal/estimate-requests";
import messages from "../../../messages/en.json";

import { descriptionPreview, EstimateRequests } from "./estimate-requests";

// EstimateRequests is an async Server Component: each test calls it and
// renders what it returns, with next-intl's own translator over the real
// messages standing in for getTranslations.
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../messages/en.json");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "MyEstimates" | "Vehicles" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const t = messages.MyEstimates;

function row(changes: Partial<EstimateRequestRow> = {}): EstimateRequestRow {
  return {
    id: "r1",
    // 19 Nov 2026, 01:00 in India (19:30 UTC the day before).
    createdAt: new Date("2026-11-18T19:30:00Z"),
    kind: "car",
    makeName: { en: "Honda" },
    modelName: { en: "City" },
    fuel: "petrol",
    registrationNumber: "MH12AB1234",
    description: "Brakes squeal when I stop",
    photoSetId: "s1",
    photoCount: 2,
    ...changes,
  };
}

describe("EstimateRequests", () => {
  test("none yet: one line and the link to /estimate", async () => {
    renderWithIntl(await EstimateRequests({ requests: [], locale: "en" }));
    expect(screen.getByRole("heading", { level: 2, name: t.heading })).toBeTruthy();
    expect(screen.getByText(t.empty)).toBeTruthy();
    expect(screen.getByRole("link", { name: t.requestLink }).getAttribute("href")).toBe("/estimate");
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  test("a request: vehicle, fuel, number, the India date, the description, waiting, and the photo count", async () => {
    renderWithIntl(await EstimateRequests({ requests: [row()], locale: "en" }));
    const item = screen.getByRole("listitem");
    expect(item.querySelector("h3")?.textContent).toBe("Honda City");
    expect(item.textContent).toContain("Petrol");
    expect(item.textContent).toContain("MH 12 AB 1234");
    // Already 19 Nov in India.
    expect(item.textContent).toContain("Sent on 19 Nov 2026");
    expect(item.textContent).toContain("Brakes squeal when I stop");
    expect(item.textContent).toContain(t.waiting);
    expect(item.textContent).toContain("2 photos");
  });

  test("a picker vehicle shows no number; no photos says so", async () => {
    renderWithIntl(await EstimateRequests({ requests: [row({ registrationNumber: null, photoCount: 0, photoSetId: null })], locale: "en" }));
    const item = screen.getByRole("listitem");
    expect(item.textContent).not.toContain("MH 12");
    expect(item.textContent).toContain("No photos");
  });
});

describe("descriptionPreview", () => {
  test("short ones stay whole, on one line", () => {
    expect(descriptionPreview("Squeal\nwhen cold")).toBe("Squeal when cold");
  });

  test("long ones are cut at a word, with an ellipsis", () => {
    const preview = descriptionPreview(`${"word ".repeat(40)}end`, 30);
    expect(preview).toBe("word word word word word word…");
  });
});
