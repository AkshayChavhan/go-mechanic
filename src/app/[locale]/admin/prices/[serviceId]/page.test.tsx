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
import messages from "../../../../../../messages/en.json";

import AdminServicePricesPage from "./page";
import { ServicePricesGate } from "./service-prices-gate";

// The gate runs the real requirePermission; the session read and the data
// reads are stand-ins. The editor is a stand-in too (its own test covers what
// it shows): here it reports which service the gate picked.
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/dal/services", () => ({ readServices: vi.fn(), listPricesForStaff: vi.fn() }));
vi.mock("@/server/dal/vehicles", () => ({ readVehicleCatalogue: vi.fn() }));
const gate = vi.hoisted(() => ({ suspend: false }));
vi.mock("@/components/admin/service-price-editor", () => ({
  ServicePriceEditor: (props: { service: { id: string } }) => {
    if (gate.suspend) use(new Promise(() => {}));
    return <p data-testid="editor">{props.service.id}</p>;
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
const gateFor = (serviceId: string) => ServicePricesGate({ locale: "en", params: Promise.resolve({ serviceId }) });

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(readServices).mockReset();
  // The hidden ones are left out by readServices itself: here, brakes.
  vi.mocked(readServices).mockResolvedValue(draftServices.filter((service) => service.id !== "brakes"));
  vi.mocked(listPricesForStaff).mockResolvedValue([]);
  vi.mocked(readVehicleCatalogue).mockResolvedValue(draftCatalogue);
});

describe("ServicePricesGate (/admin/prices/[serviceId]'s gate)", () => {
  test("logged out: sent to /login?session=ended, nothing read", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await thrownBy(gateFor("periodic-service"))).toMatchObject(TO_LOGIN);
    expect(readServices).not.toHaveBeenCalled();
  });

  test.each(["customer", "mechanic"] as const)("a %s: the 404 page for any id, nothing read", async (role) => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith(role));
    expect(await thrownBy(gateFor("periodic-service"))).toMatchObject(NOT_FOUND);
    expect(readServices).not.toHaveBeenCalled();
  });

  test.each(["periodic-service", "car-basic"])("a manager: the editor for %s (a service or a package)", async (id) => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("manager"));
    renderWithIntl(await gateFor(id));
    expect(screen.getByTestId("editor").textContent).toBe(id);
  });

  test.each(["towing", "brakes"])("an unknown or hidden id (%s): the 404 page, after the check", async (id) => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("owner"));
    expect(await thrownBy(gateFor(id))).toMatchObject(NOT_FOUND);
    expect(readServices).toHaveBeenCalled();
  });
});

describe("/admin/prices/[serviceId]", () => {
  test("built ahead of time: only the neutral loading line", () => {
    gate.suspend = true;
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("owner"));
    renderWithIntl(<AdminServicePricesPage params={new Promise(() => {})} searchParams={Promise.resolve({})} />);
    expect(screen.getByText(messages.Admin.loading)).toBeTruthy();
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
