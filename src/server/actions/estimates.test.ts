import { beforeEach, describe, expect, test, vi } from "vitest";

import { initialEstimateFormState } from "@/lib/estimate-form";
import { getCurrentUser } from "@/server/auth/session";
import { createMyEstimateRequest } from "@/server/dal/estimate-requests";
import { readMyProfile } from "@/server/dal/profile";

import allMessages from "../../../messages/en.json";

import { sendEstimateRequest } from "./estimates";

// The action only checks, calls the data-access layer and translates. The
// data-access functions (tested on their own) are replaced here, so each
// test sets the answer it needs. requireUser is the real one, reading a
// mocked session.

vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/dal/profile", () => ({ readMyProfile: vi.fn() }));
vi.mock("@/server/dal/estimate-requests", () => ({ createMyEstimateRequest: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "EstimatePage" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const asha = { id: "asha", phoneNumber: "+919876500001", role: "customer" as const };
const TOKEN = "3f2b8c4e-1d2a-4b6c-9e8f-0a1b2c3d4e5f";
const SAVED = "11111111-2222-4333-8444-555555555555";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(asha);
  vi.mocked(readMyProfile).mockResolvedValue({ name: "Asha Patil", phoneNumber: asha.phoneNumber });
  vi.mocked(createMyEstimateRequest).mockResolvedValue({ status: "sent", id: "r1" });
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

/** A full post with the picker, as the form sends it. */
const pickerPost = {
  vehicleChoice: "other",
  vehicleKind: "car",
  vehicleMake: "car-honda",
  vehicleModel: "car-honda-city",
  vehicleFuel: "petrol",
  description: "Brakes squeal when I stop",
  photoSetId: "",
  requestToken: TOKEN,
};

describe("sendEstimateRequest", () => {
  test("refuses an unknown locale before anything else runs", async () => {
    await expect(sendEstimateRequest("xx", initialEstimateFormState, form(pickerPost))).rejects.toThrow("Unknown locale");
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  test("logged out: to /login?session=ended, never reaching the data-access layer", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await thrownBy(sendEstimateRequest("en", initialEstimateFormState, form(pickerPost)))).toMatchObject(toLogin);
    expect(createMyEstimateRequest).not.toHaveBeenCalled();
  });

  test("no name yet: to /account, where the name form is, without saving", async () => {
    vi.mocked(readMyProfile).mockResolvedValue({ name: "", phoneNumber: asha.phoneNumber });
    expect(await thrownBy(sendEstimateRequest("en", initialEstimateFormState, form(pickerPost)))).toMatchObject(toAccount);
    expect(createMyEstimateRequest).not.toHaveBeenCalled();
  });

  test.each([
    ["sent", { status: "sent", id: "r1" }],
    ["duplicate", { status: "duplicate", id: "r1" }],
  ] as const)("%s: to /account", async (_, answer) => {
    vi.mocked(createMyEstimateRequest).mockResolvedValue(answer);
    expect(await thrownBy(sendEstimateRequest("en", initialEstimateFormState, form(pickerPost)))).toMatchObject(toAccount);
  });

  test("'other' reads the picker's model and fuel; a posted userId does nothing", async () => {
    await thrownBy(sendEstimateRequest("en", initialEstimateFormState, form({ ...pickerPost, userId: "ravi" })));
    expect(createMyEstimateRequest).toHaveBeenCalledWith({
      vehicle: { modelId: "car-honda-city", fuel: "petrol" },
      description: "Brakes squeal when I stop",
      photoSetId: "",
      requestToken: TOKEN,
    });
  });

  test("a saved vehicle's id wins over the picker's fields", async () => {
    await thrownBy(sendEstimateRequest("en", initialEstimateFormState, form({ ...pickerPost, vehicleChoice: SAVED })));
    expect(vi.mocked(createMyEstimateRequest).mock.calls[0]?.[0].vehicle).toEqual({ savedVehicleId: SAVED });
  });

  test("problems: one message per field, with what was posted kept", async () => {
    vi.mocked(createMyEstimateRequest).mockResolvedValue({
      status: "problems",
      problems: [
        { field: "description", problem: "description-too-short" },
        { field: "description", problem: "description-missing" },
        { field: "photos", problem: "photos-not-found" },
      ],
    });
    const state = await sendEstimateRequest("en", { ...initialEstimateFormState, submission: 2 }, form(pickerPost));
    expect(state).toEqual({
      submission: 3,
      values: { vehicleChoice: "other", modelId: "car-honda-city", fuel: "petrol", description: "Brakes squeal when I stop" },
      errors: {
        description: "Tell us a little more: at least 10 characters.",
        photos: "Your photos couldn't be added. Remove them and add them again, or send without photos.",
      },
    });
  });

  test("a saved vehicle that's gone, and the daily limit, get their own messages", async () => {
    vi.mocked(createMyEstimateRequest).mockResolvedValue({ status: "not-found" });
    expect((await sendEstimateRequest("en", initialEstimateFormState, form(pickerPost))).errors).toEqual({
      vehicle: "This vehicle is no longer on your account. Choose another.",
    });
    vi.mocked(createMyEstimateRequest).mockResolvedValue({ status: "too-many-requests", limit: 3 });
    expect((await sendEstimateRequest("en", initialEstimateFormState, form(pickerPost))).errors).toEqual({
      form: "You've sent 3 requests in the last 24 hours. Please call or WhatsApp the garage instead.",
    });
  });
});
