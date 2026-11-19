import { beforeEach, describe, expect, test, vi } from "vitest";

import type { BookingWizardProps } from "@/components/booking/booking-wizard";
import type { SlotDay } from "@/domain/slots";
import { getCurrentUser } from "@/server/auth/session";
import { listMyVehicles, type MyVehicle } from "@/server/dal/customer-vehicles";
import { readMyProfile } from "@/server/dal/profile";
import { readAvailableSlots } from "@/server/dal/slots";

import { BookingLoader, type BookingLoaderProps } from "./booking-loader";

// The loader is an async Server Component: `await BookingLoader(props)`
// returns the <BookingWizard> element, so the tests read its props directly
// instead of drawing the wizard (booking-wizard.test.tsx does that).
// Stand-ins replace the session read, the data-access reads and io() (it
// only means something inside a Next.js prerender).
vi.mock("next/cache", () => ({ io: vi.fn(async () => {}) }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/dal/profile", () => ({ readMyProfile: vi.fn() }));
vi.mock("@/server/dal/customer-vehicles", () => ({ listMyVehicles: vi.fn() }));
vi.mock("@/server/dal/slots", () => ({ readAvailableSlots: vi.fn() }));
vi.mock("@/components/booking/booking-wizard", () => ({ BookingWizard: () => null }));

const days: SlotDay[] = [
  {
    date: "2027-03-12",
    weekday: "friday",
    status: "open",
    slots: [
      {
        startsAt: new Date("2027-03-12T04:30:00.000Z"),
        endsAt: new Date("2027-03-12T05:30:00.000Z"),
        remaining: 2,
      },
    ],
  },
  { date: "2027-03-15", weekday: "monday", status: "closed-weekday" },
];

const vehicle: MyVehicle = {
  id: "0b6f6c1e-8d2a-4e8b-9a51-3f8f4c0d2a10",
  kind: "car",
  modelId: "car-honda-city",
  makeName: { en: "Honda" },
  modelName: { en: "City" },
  fuel: "petrol",
  registrationNumber: "MH12AB0042",
  pucExpiresOn: null,
  insuranceExpiresOn: null,
};

// The rest of the wizard's props pass straight through; their values don't matter here.
const passedThrough = { catalogue: { categories: [], makes: [] } } as unknown as BookingLoaderProps;

async function wizardProps(): Promise<BookingWizardProps> {
  const element = await BookingLoader(passedThrough);
  return element.props as BookingWizardProps;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readAvailableSlots).mockResolvedValue(days);
});

describe("BookingLoader (the part of /book read per request)", () => {
  test("passes the live slots with their times as ISO strings, and the other props as given", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const props = await wizardProps();
    expect(props.slots).toEqual([
      {
        date: "2027-03-12",
        weekday: "friday",
        status: "open",
        slots: [{ startsAt: "2027-03-12T04:30:00.000Z", endsAt: "2027-03-12T05:30:00.000Z", remaining: 2 }],
      },
      { date: "2027-03-15", weekday: "monday", status: "closed-weekday" },
    ]);
    expect(props.catalogue).toBe(passedThrough.catalogue);
  });

  test("logged out: no account, and no customer data is read", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect((await wizardProps()).account).toBeNull();
    expect(readMyProfile).not.toHaveBeenCalled();
    expect(listMyVehicles).not.toHaveBeenCalled();
  });

  test("logged in: the number as /account shows it, the saved vehicles and whether a name is missing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1", phoneNumber: "+919876543210", role: "customer" });
    vi.mocked(readMyProfile).mockResolvedValue({ name: "", phoneNumber: "+919876543210" });
    vi.mocked(listMyVehicles).mockResolvedValue([vehicle]);
    expect((await wizardProps()).account).toEqual({
      phoneDisplay: "+91 98765 43210",
      vehicles: [vehicle],
      needsName: true,
    });
  });

  test("logged in with a name: needsName is false", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1", phoneNumber: "+919876543210", role: "customer" });
    vi.mocked(readMyProfile).mockResolvedValue({ name: "Asha", phoneNumber: "+919876543210" });
    vi.mocked(listMyVehicles).mockResolvedValue([]);
    expect((await wizardProps()).account).toMatchObject({ vehicles: [], needsName: false });
  });
});
