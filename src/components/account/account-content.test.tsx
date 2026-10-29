import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import { getCurrentUser } from "@/server/auth/session";
import { listMyVehicles, type MyVehicle } from "@/server/dal/customer-vehicles";
import { readMyProfile } from "@/server/dal/profile";
import messages from "../../../messages/en.json";

import { AccountContent } from "./account-content";

// AccountContent is an async Server Component: each test calls it and renders
// what it returns. The session, the data-access functions and the Server
// Action are stand-ins. VehicleList (an async Server Component, tested on
// its own) is a marker that shows the props it got.
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/dal/profile", () => ({ readMyProfile: vi.fn() }));
vi.mock("@/server/dal/customer-vehicles", () => ({ listMyVehicles: vi.fn() }));
vi.mock("@/server/actions/account", () => ({ saveName: vi.fn() }));
vi.mock("@/components/account/vehicle-list", () => ({
  VehicleList: ({ vehicles, today }: { vehicles: MyVehicle[]; today: string }) => (
    <p data-testid="vehicle-list">{`${vehicles.length} vehicles, today ${today}`}</p>
  ),
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../messages/en.json");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "Account" | "Login" | "MyVehicles" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const asha = { id: "asha", phoneNumber: "+919876500001", role: "customer" as const };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(asha);
  vi.mocked(listMyVehicles).mockResolvedValue([]);
  // 29 Oct 2026, 00:10 in India (18:40 UTC the day before). Only Date is faked.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T18:40:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

/** What a call threw (a redirect is a thrown error with a digest). */
async function thrownBy(run: Promise<unknown>): Promise<unknown> {
  return run.then(
    () => "nothing thrown",
    (error: unknown) => error,
  );
}

describe("AccountContent", () => {
  test("no name yet: the name form, and no vehicles", async () => {
    vi.mocked(readMyProfile).mockResolvedValue({ name: "", phoneNumber: asha.phoneNumber });
    renderWithIntl(await AccountContent({ locale: "en" }));
    expect(screen.getByRole("heading", { level: 2, name: messages.Account.nameHeading })).toBeTruthy();
    expect(screen.getByLabelText(messages.Account.nameLabel)).toBeTruthy();
    expect(screen.queryByTestId("vehicle-list")).toBeNull();
    expect(listMyVehicles).not.toHaveBeenCalled();
  });

  test("with a name: the vehicles, India's today for the Expired flags, and the add link", async () => {
    vi.mocked(readMyProfile).mockResolvedValue({ name: "Asha Patil", phoneNumber: asha.phoneNumber });
    renderWithIntl(await AccountContent({ locale: "en" }));
    expect(screen.getByRole("heading", { level: 2, name: messages.MyVehicles.listHeading })).toBeTruthy();
    // Already 29 Oct in India, though still 28 Oct in UTC.
    expect(screen.getByTestId("vehicle-list").textContent).toBe("0 vehicles, today 2026-10-29");
    const add = screen.getByRole("link", { name: messages.MyVehicles.addLink });
    expect(add.getAttribute("href")).toBe("/account/vehicles/new");
    expect(screen.queryByLabelText(messages.Account.nameLabel)).toBeNull();
  });

  test("logged out (a leftover cookie): sent to /login?session=ended, before any data is read", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const error = await thrownBy(AccountContent({ locale: "en" }));
    expect(error).toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;\w+;\/login\?session=ended;/) });
    expect(readMyProfile).not.toHaveBeenCalled();
    expect(listMyVehicles).not.toHaveBeenCalled();
  });
});
