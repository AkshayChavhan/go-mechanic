import { screen } from "@testing-library/react";
import { use } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Role } from "@/domain/roles";
import { renderWithIntl } from "@/i18n/test-utils";
import { getCurrentUser } from "@/server/auth/session";
import { listPricesForStaff, readServices } from "@/server/dal/services";
import { readVehicleCatalogue } from "@/server/dal/vehicles";
import { draftServices } from "@/server/db/service-seed-data";
import { draftCatalogue } from "@/server/db/vehicle-seed-data";
import messages from "../../../../../messages/en.json";

import AdminPricesPage from "./page";
import { PricesGate } from "./prices-gate";

// The gate runs the real requirePermission; the session read and the data
// reads are stand-ins. The list is a stand-in too (price-list.test.tsx covers
// what it shows): here it reports what the gate passed it.
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/dal/services", () => ({ readServices: vi.fn(), listPricesForStaff: vi.fn() }));
vi.mock("@/server/dal/vehicles", () => ({ readVehicleCatalogue: vi.fn() }));
const gate = vi.hoisted(() => ({ suspend: false }));
vi.mock("@/components/admin/price-list", () => ({
  PriceList: (props: { services: unknown[]; prices: unknown[] }) => {
    if (gate.suspend) use(new Promise(() => {}));
    return <p data-testid="list">{JSON.stringify({ services: props.services.length, prices: props.prices.length })}</p>;
  },
}));

const userWith = (role: Role) => ({ id: "u1", phoneNumber: "+919876543210", role });

async function thrownBy(run: Promise<unknown>): Promise<unknown> {
  return run.then(
    () => "nothing thrown",
    (error: unknown) => error,
  );
}

const TO_LOGIN = { digest: expect.stringMatching(/^NEXT_REDIRECT;replace;\/login\?session=ended;/) };
const NOT_FOUND = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };
const price = { serviceId: "brakes", categoryId: "hatchback", fuel: null, pricePaise: 90_000 };

beforeEach(() => {
  gate.suspend = false;
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(readServices).mockResolvedValue([...draftServices]);
  vi.mocked(listPricesForStaff).mockReset();
  vi.mocked(listPricesForStaff).mockResolvedValue([price]);
  vi.mocked(readVehicleCatalogue).mockResolvedValue(draftCatalogue);
});

describe("PricesGate (/admin/prices's gate)", () => {
  test("logged out (a leftover cookie): sent to /login?session=ended, nothing read", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await thrownBy(PricesGate({ locale: "en" }))).toMatchObject(TO_LOGIN);
    expect(listPricesForStaff).not.toHaveBeenCalled();
  });

  test.each(["customer", "mechanic"] as const)("a %s: the 404 page, nothing read", async (role) => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith(role));
    expect(await thrownBy(PricesGate({ locale: "en" }))).toMatchObject(NOT_FOUND);
    expect(listPricesForStaff).not.toHaveBeenCalled();
  });

  test.each(["manager", "owner"] as const)("a %s: the list, with every listed service and the live prices", async (role) => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith(role));
    renderWithIntl(await PricesGate({ locale: "en" }));
    expect(JSON.parse(screen.getByTestId("list").textContent!)).toEqual({ services: draftServices.length, prices: 1 });
  });
});

describe("/admin/prices", () => {
  test("built ahead of time: only the neutral loading line, no heading and no staff word", () => {
    gate.suspend = true;
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("owner"));
    const { container } = renderWithIntl(<AdminPricesPage />);
    expect(screen.getByText(messages.Admin.loading)).toBeTruthy();
    expect(screen.queryByRole("heading")).toBeNull();
    for (const word of [messages.AdminPrices.heading, messages.AdminPrices.intro]) expect(container.textContent).not.toContain(word);
  });
});
