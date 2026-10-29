import { beforeEach, describe, expect, test, vi } from "vitest";

import { initialNameFormState, initialVehicleFormState, type VehicleFormState } from "@/lib/account-forms";
import { getCurrentUser } from "@/server/auth/session";
import { addMyVehicle } from "@/server/dal/customer-vehicles";
import { readMyProfile, saveMyName } from "@/server/dal/profile";

import allMessages from "../../../messages/en.json";

import { addVehicle, saveName } from "./account";

// The actions only check, call the data-access layer and translate. The
// data-access functions (tested on their own) are replaced here, so each
// test sets the answer it needs. requireUser is the real one, reading a
// mocked session.

vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/dal/profile", () => ({ readMyProfile: vi.fn(), saveMyName: vi.fn() }));
vi.mock("@/server/dal/customer-vehicles", () => ({ addMyVehicle: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "Account" | "MyVehicles" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const asha = { id: "asha", phoneNumber: "+919876500001", role: "customer" as const };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(asha);
  vi.mocked(readMyProfile).mockResolvedValue({ name: "Asha Patil", phoneNumber: asha.phoneNumber });
});

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

/** What an action threw (a redirect is a thrown error with a digest). */
async function thrownBy(run: Promise<unknown>): Promise<unknown> {
  return run.then(
    () => "nothing thrown",
    (error: unknown) => error,
  );
}

const toAccount = { digest: expect.stringMatching(/^NEXT_REDIRECT;replace;\/account;/) };
const toLogin = { digest: expect.stringMatching(/^NEXT_REDIRECT;replace;\/login\?session=ended;/) };

/** A full add-vehicle post, as the form sends it. */
const vehiclePost = {
  vehicleKind: "car",
  vehicleMake: "car-honda",
  vehicleModel: "car-honda-city",
  vehicleFuel: "petrol",
  registration: "mh 12 ab 1234",
  pucExpiresOn: "2027-03-12",
  insuranceExpiresOn: "",
};

describe("both actions", () => {
  test("refuse an unknown locale before anything else runs", async () => {
    await expect(saveName("xx", initialNameFormState, form({ name: "Asha" }))).rejects.toThrow("Unknown locale");
    await expect(addVehicle("xx", initialVehicleFormState, form(vehiclePost))).rejects.toThrow("Unknown locale");
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  test("logged out, they go to /login?session=ended and never reach the data-access layer", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await thrownBy(saveName("en", initialNameFormState, form({ name: "Asha" })))).toMatchObject(toLogin);
    expect(await thrownBy(addVehicle("en", initialVehicleFormState, form(vehiclePost)))).toMatchObject(toLogin);
    expect(saveMyName).not.toHaveBeenCalled();
    expect(readMyProfile).not.toHaveBeenCalled();
    expect(addMyVehicle).not.toHaveBeenCalled();
  });
});

describe("saveName", () => {
  test("a valid name goes to /account, replacing the form in the history", async () => {
    vi.mocked(saveMyName).mockResolvedValue({ ok: true });
    expect(await thrownBy(saveName("en", initialNameFormState, form({ name: " Asha  Patil " })))).toMatchObject(toAccount);
    expect(saveMyName).toHaveBeenCalledWith(" Asha  Patil ");
  });

  test("a name with a problem comes back with its message, what was typed, and the next submission number", async () => {
    vi.mocked(saveMyName).mockResolvedValue({ ok: false, problem: "name-too-short" });
    expect(await saveName("en", { ...initialNameFormState, submission: 2 }, form({ name: "A" }))).toEqual({
      submission: 3,
      nameTyped: "A",
      error: allMessages.Account.nameErrors["name-too-short"],
    });
  });

  test("a posted userId does nothing: the data-access layer gets only the name", async () => {
    vi.mocked(saveMyName).mockResolvedValue({ ok: true });
    await thrownBy(saveName("en", initialNameFormState, form({ name: "Asha", userId: "ravi" })));
    expect(saveMyName).toHaveBeenCalledWith("Asha");
  });
});

describe("addVehicle", () => {
  test("a valid vehicle goes to /account, replacing the form in the history", async () => {
    vi.mocked(addMyVehicle).mockResolvedValue({ status: "saved", id: "6f1c1f0e-8a7c-4c1e-9d55-0b7a2a8c1e11" });
    expect(await thrownBy(addVehicle("en", initialVehicleFormState, form(vehiclePost)))).toMatchObject(toAccount);
  });

  test("sends only the model, fuel and typed fields: a posted type, brand or userId does nothing", async () => {
    vi.mocked(addMyVehicle).mockResolvedValue({ status: "saved", id: "6f1c1f0e-8a7c-4c1e-9d55-0b7a2a8c1e11" });
    await thrownBy(addVehicle("en", initialVehicleFormState, form({ ...vehiclePost, vehicleKind: "two-wheeler", userId: "ravi" })));
    expect(addMyVehicle).toHaveBeenCalledWith({
      modelId: "car-honda-city",
      fuel: "petrol",
      registration: "mh 12 ab 1234",
      pucExpiresOn: "2027-03-12",
      insuranceExpiresOn: "",
    });
  });

  test("a customer with no name yet goes to /account, and nothing is saved", async () => {
    vi.mocked(readMyProfile).mockResolvedValue({ name: " ", phoneNumber: asha.phoneNumber });
    expect(await thrownBy(addVehicle("en", initialVehicleFormState, form(vehiclePost)))).toMatchObject(toAccount);
    expect(addMyVehicle).not.toHaveBeenCalled();
  });

  test("problems come back translated per field, with what was posted and the next submission number", async () => {
    vi.mocked(addMyVehicle).mockResolvedValue({
      status: "problems",
      problems: [
        { field: "vehicle", problem: "vehicle-missing" },
        { field: "registration", problem: "registration-invalid" },
        { field: "insuranceExpiresOn", problem: "date-out-of-range" },
      ],
    });
    const post = { ...vehiclePost, vehicleFuel: "", registration: "MH12", insuranceExpiresOn: "2040-01-01" };
    const errors = allMessages.MyVehicles.errors;
    expect(await addVehicle("en", { ...initialVehicleFormState, submission: 4 }, form(post))).toEqual<VehicleFormState>({
      submission: 5,
      values: {
        modelId: "car-honda-city",
        fuel: "",
        registration: "MH12",
        pucExpiresOn: "2027-03-12",
        insuranceExpiresOn: "2040-01-01",
      },
      errors: {
        vehicle: errors["vehicle-missing"],
        registration: errors["registration-invalid"],
        insuranceExpiresOn: errors["date-out-of-range"],
      },
    });
  });

  test("a number the customer already saved gets its own message on the registration field", async () => {
    vi.mocked(addMyVehicle).mockResolvedValue({
      status: "problems",
      problems: [{ field: "registration", problem: "registration-duplicate" }],
    });
    const state = await addVehicle("en", initialVehicleFormState, form(vehiclePost));
    expect(state.errors).toEqual({ registration: allMessages.MyVehicles.errors["registration-duplicate"] });
  });
});
