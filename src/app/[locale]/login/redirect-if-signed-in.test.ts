import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCurrentUser } from "@/server/auth/session";

import { RedirectIfSignedIn } from "./redirect-if-signed-in";

// getCurrentUser() reads the session cookie; here a stand-in answers.
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
});

/** What a call threw (a redirect is a thrown error with a digest). */
async function thrownBy(run: Promise<unknown>): Promise<unknown> {
  return run.then(
    () => "nothing thrown",
    (error: unknown) => error,
  );
}

describe("RedirectIfSignedIn (on /login)", () => {
  test("a logged-in visitor is sent to /account", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "u1", phoneNumber: "+919876543210", role: "customer" });
    const error = await thrownBy(RedirectIfSignedIn({ locale: "en" }));
    expect(error).toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;\w+;\/account;/) });
  });

  test("a visitor who isn't logged in stays, and nothing is drawn", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await RedirectIfSignedIn({ locale: "en" })).toBeNull();
  });
});
