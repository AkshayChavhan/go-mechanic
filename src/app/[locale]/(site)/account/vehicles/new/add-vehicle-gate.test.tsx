import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCurrentUser } from "@/server/auth/session";
import { readMyProfile } from "@/server/dal/profile";

import { AddVehicleGate } from "./add-vehicle-gate";

// AddVehicleGate is an async Server Component that draws nothing: each test
// calls it and checks whether it lets the visitor stay or redirects. The
// session and the profile read are stand-ins.
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/dal/profile", () => ({ readMyProfile: vi.fn() }));

const asha = { id: "asha", phoneNumber: "+919876500001", role: "customer" as const };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(asha);
});

/** What a call threw (a redirect is a thrown error with a digest). */
async function thrownBy(run: Promise<unknown>): Promise<unknown> {
  return run.then(
    () => "nothing thrown",
    (error: unknown) => error,
  );
}

describe("AddVehicleGate", () => {
  test("a customer with a name may stay: it draws nothing", async () => {
    vi.mocked(readMyProfile).mockResolvedValue({ name: "Asha Patil", phoneNumber: asha.phoneNumber });
    expect(await AddVehicleGate({ locale: "en" })).toBeNull();
  });

  test("no name yet: to /account, where the name form is", async () => {
    vi.mocked(readMyProfile).mockResolvedValue({ name: "", phoneNumber: asha.phoneNumber });
    expect(await thrownBy(AddVehicleGate({ locale: "en" }))).toMatchObject({
      digest: expect.stringMatching(/^NEXT_REDIRECT;replace;\/account;/),
    });
  });

  test("logged out: to /login?session=ended, before the profile is read", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await thrownBy(AddVehicleGate({ locale: "en" }))).toMatchObject({
      digest: expect.stringMatching(/^NEXT_REDIRECT;replace;\/login\?session=ended;/),
    });
    expect(readMyProfile).not.toHaveBeenCalled();
  });
});
