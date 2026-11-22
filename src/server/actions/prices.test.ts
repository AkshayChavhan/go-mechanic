import { beforeEach, describe, expect, test, vi } from "vitest";

import { initialPriceFormState } from "@/lib/price-form";
import { getCurrentUser } from "@/server/auth/session";
import { saveGroupPrices } from "@/server/dal/services";

import allMessages from "../../../messages/en.json";

import { savePrices } from "./prices";

// The action only checks, reads the boxes, calls the data-access layer and
// translates. The save (tested on its own) is replaced here, so each test
// sets the answer it needs. requirePermission is the real one, reading a
// mocked session.

vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/dal/services", () => ({ saveGroupPrices: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "AdminPrices" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const manu = { id: "manu", phoneNumber: "+919876500004", role: "manager" as const };
const t = allMessages.AdminPrices;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(manu);
  vi.mocked(saveGroupPrices).mockResolvedValue({
    status: "saved",
    prices: [
      { serviceId: "periodic-service", categoryId: "hatchback", fuel: "diesel", pricePaise: 180_000 },
      { serviceId: "periodic-service", categoryId: "hatchback", fuel: null, pricePaise: 150_000 },
    ],
    fuels: ["petrol", "diesel", "cng"],
  });
});

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

async function thrownBy(run: Promise<unknown>): Promise<unknown> {
  return run.then(
    () => "nothing thrown",
    (error: unknown) => error,
  );
}

const post = { "price-group": "1,500", "price-petrol": "", "price-diesel": "₹1,800", "price-cng": "" };

describe("savePrices", () => {
  test("an unknown locale is refused before anything else", async () => {
    await expect(savePrices("xx", "periodic-service", "hatchback", initialPriceFormState, form(post))).rejects.toThrow();
    expect(saveGroupPrices).not.toHaveBeenCalled();
  });

  test("logged out: to /login, and nothing is saved", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await thrownBy(savePrices("en", "periodic-service", "hatchback", initialPriceFormState, form(post)))).toMatchObject({
      digest: expect.stringMatching(/^NEXT_REDIRECT;replace;\/login\?session=ended;/),
    });
    expect(saveGroupPrices).not.toHaveBeenCalled();
  });

  test.each(["customer", "mechanic"] as const)("a %s gets the 404, and nothing is saved", async (role) => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...manu, role });
    expect(await thrownBy(savePrices("en", "periodic-service", "hatchback", initialPriceFormState, form(post)))).toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
    expect(saveGroupPrices).not.toHaveBeenCalled();
  });

  test("saves the bound service and group with the typed amounts; posted ids and roles do nothing", async () => {
    const state = await savePrices(
      "en",
      "periodic-service",
      "hatchback",
      initialPriceFormState,
      form({ ...post, serviceId: "brakes", categoryId: "suv", role: "owner" }),
    );
    expect(saveGroupPrices).toHaveBeenCalledWith("periodic-service", "hatchback", [
      { fuel: null, pricePaise: 150_000 },
      { fuel: "diesel", pricePaise: 180_000 },
    ]);
    expect(state).toEqual({
      submission: 1,
      // The saved amounts, as a box shows them; blank boxes stay blank.
      values: { group: "1,500", petrol: "", diesel: "1,800", cng: "" },
      errors: {},
      saved: ["Petrol: ₹1,500", "Diesel: ₹1,800", "CNG: ₹1,500"],
    });
  });

  test("a fuel with neither its own price nor the group's says so", async () => {
    vi.mocked(saveGroupPrices).mockResolvedValue({
      status: "saved",
      prices: [{ serviceId: "periodic-service", categoryId: "hatchback", fuel: "diesel", pricePaise: 180_000 }],
      fuels: ["petrol", "diesel"],
    });
    const state = await savePrices("en", "periodic-service", "hatchback", initialPriceFormState, form({ "price-diesel": "1800" }));
    expect(state.saved).toEqual([`Petrol: ${t.noPrice}`, "Diesel: ₹1,800"]);
  });

  test("all blank: no prices for the group, and the site asks visitors to call", async () => {
    vi.mocked(saveGroupPrices).mockResolvedValue({ status: "saved", prices: [], fuels: ["petrol"] });
    const state = await savePrices("en", "periodic-service", "hatchback", initialPriceFormState, form({ "price-group": "" }));
    expect(saveGroupPrices).toHaveBeenCalledWith("periodic-service", "hatchback", []);
    expect(state.saved).toEqual([t.savedNone]);
  });

  test("a box that can't be read: its message, the typed text kept, nothing saved", async () => {
    const state = await savePrices(
      "en",
      "periodic-service",
      "hatchback",
      { ...initialPriceFormState, submission: 4 },
      form({ "price-group": "1500", "price-diesel": "1.500" }),
    );
    expect(saveGroupPrices).not.toHaveBeenCalled();
    expect(state).toEqual({
      submission: 5,
      values: { group: "1500", diesel: "1.500" },
      errors: { diesel: t.errors["not-whole"] },
      saved: null,
    });
  });

  test("the save's own problems go under their boxes", async () => {
    vi.mocked(saveGroupPrices).mockResolvedValue({
      status: "problems",
      problems: [{ field: "cng", problem: "fuel-not-offered" }],
    });
    const state = await savePrices("en", "two-wheeler-basic", "scooter", initialPriceFormState, form({ "price-cng": "500" }));
    expect(state.errors).toEqual({ cng: t.errors["fuel-not-offered"] });
    expect(state.values).toEqual({ cng: "500" });
  });

  test.each(["not-found", "on-inspection"] as const)("%s is a message for the whole card", async (status) => {
    vi.mocked(saveGroupPrices).mockResolvedValue({ status });
    const state = await savePrices("en", "x", "y", initialPriceFormState, form(post));
    expect(state.errors).toEqual({ form: t.errors[status] });
    expect(state.saved).toBeNull();
  });
});
