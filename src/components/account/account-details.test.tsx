import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCurrentUser } from "@/server/auth/session";
import messages from "../../../messages/en.json";

import { AccountDetails } from "./account-details";

// AccountDetails is an async Server Component: each test calls it and renders
// what it returns. getCurrentUser() reads the session cookie; here a
// stand-in answers. getTranslations is next-intl's own translator over the
// real messages, for the locale it's given.
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../messages/en.json");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "Account" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

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

describe("AccountDetails", () => {
  test("logged in: the number the way people read it", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "u1", phoneNumber: "+919876543210", role: "customer" });
    render(await AccountDetails({ locale: "en" }));
    expect(screen.getByText(messages.Account.signedInAs.replace("{number}", "+91 98765 43210"))).toBeTruthy();
  });

  test("logged out (a leftover cookie): sent to /login?session=ended", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const error = await thrownBy(AccountDetails({ locale: "en" }));
    expect(error).toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;\w+;\/login\?session=ended;/) });
  });
});
