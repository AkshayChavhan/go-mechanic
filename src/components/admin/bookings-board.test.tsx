import { screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import type { StaffBookingRow } from "@/server/dal/staff-bookings";
import messages from "../../../messages/en.json";

import { BookingsBoard, type BookingsBoardProps } from "./bookings-board";

// BookingsBoard is an async Server Component that only shows what it's
// given (the gate in src/app/[locale]/admin/bookings/ reads the data). Each
// test calls it and renders what it returns.
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../messages/en.json");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "Admin" | "Vehicles" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const t = messages.Admin.bookings;
const today = "2026-11-19";

function booking(overrides: Partial<StaffBookingRow> & Pick<StaffBookingRow, "id" | "code" | "startsAt">): StaffBookingRow {
  return {
    status: "booked",
    vehicle: {
      kind: "car",
      makeName: { en: "Honda" },
      modelName: { en: "City" },
      fuel: "petrol",
      registrationNumber: "MH12AB0042",
    },
    lines: [
      { serviceId: "brakes", kind: "service", name: { en: "Brakes" }, priceStatus: "no-price", pricePaise: null, position: 0 },
      { serviceId: "ac", kind: "service", name: { en: "AC service" }, priceStatus: "no-price", pricePaise: null, position: 1 },
    ],
    totalPaise: null,
    pickup: { included: false, address: null, postalCode: null, feePaise: null },
    customerName: "Asha Patil",
    phoneNumber: null,
    ...overrides,
  };
}

// 10:00 and 15:30 India time on 19 Nov 2026 (India is UTC+5:30).
const morning = booking({ id: "b1", code: "K7Q4MX", startsAt: new Date("2026-11-19T04:30:00Z") });
const afternoon = booking({
  id: "b2",
  code: "PZ3H8T",
  startsAt: new Date("2026-11-19T10:00:00Z"),
  vehicle: {
    kind: "car",
    makeName: { en: "Maruti Suzuki" },
    modelName: { en: "Swift" },
    fuel: "diesel",
    registrationNumber: "KA01MX0007",
  },
  lines: [{ serviceId: "car-basic", kind: "package", name: { en: "Basic care" }, priceStatus: "no-price", pricePaise: null, position: 0 }],
  pickup: { included: true, address: null, postalCode: null, feePaise: 0 },
  customerName: "Ravi Kumar",
});

function renderBoard(props: Partial<BookingsBoardProps> = {}) {
  return BookingsBoard({ locale: "en", date: today, today, note: false, bookings: [], ...props }).then(renderWithIntl);
}

/** Each booking's card: the list item around its heading. */
const cards = () => screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.closest("li")!);

describe("BookingsBoard", () => {
  test("the heading is the day with its weekday; today is marked", async () => {
    await renderBoard();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe(`Thursday, 19 November 2026 ${t.today}`);
  });

  test("two bookings, in the order given (time order), each with its time, code, vehicle and lines", async () => {
    await renderBoard({ bookings: [morning, afternoon] });
    expect(screen.getByText("2 bookings, in time order.")).toBeTruthy();

    const [first, second] = cards();
    expect(within(first).getByRole("heading", { level: 2 }).textContent).toBe("10:00 am K7Q-4MX");
    expect(first.textContent).toContain("Honda City");
    expect(first.textContent).toContain("Petrol");
    expect(first.textContent).toContain("MH 12 AB 0042");
    expect(within(first).getAllByRole("listitem").map((line) => line.textContent)).toEqual(["Brakes", "AC service"]);
    expect(first.textContent).toContain("Asha Patil");
    expect(first.textContent).not.toContain(t.pickupIncluded);

    expect(within(second).getByRole("heading", { level: 2 }).textContent).toBe("3:30 pm PZ3-H8T");
    expect(second.textContent).toContain("Maruti Suzuki Swift");
    expect(second.textContent).toContain("Diesel");
    expect(second.textContent).toContain("KA 01 MX 0007");
    expect(second.textContent).toContain("Basic care (package)");
    expect(second.textContent).toContain(t.pickupIncluded);
  });

  test("nothing about money, even when a line has a price", async () => {
    const priced = booking({
      id: "b3",
      code: "AAAAAA",
      startsAt: new Date("2026-11-19T05:30:00Z"),
      lines: [{ serviceId: "brakes", kind: "service", name: { en: "Brakes" }, priceStatus: "price", pricePaise: 150_000, position: 0 }],
      totalPaise: 150_000,
      pickup: { included: true, address: "12 MG Road", postalCode: "411001", feePaise: 20_000 },
    });
    const { container } = await renderBoard({ bookings: [priced] });
    expect(container.textContent).not.toContain("₹");
    expect(container.textContent).not.toContain("1,500");
  });

  test("without contact permission (the read gave nulls): no phone link and no address", async () => {
    await renderBoard({ bookings: [afternoon] });
    expect(screen.queryByRole("link", { name: /\+91/ })).toBeNull();
    expect(document.querySelector('a[href^="tel:"]')).toBeNull();
    expect(screen.queryByText(/Pickup from/)).toBeNull();
  });

  test("with contact permission: the phone as a tel: link and the pickup address", async () => {
    const withContact = { ...afternoon, phoneNumber: "+919876543210", pickup: { included: true, address: "12 MG Road, Kiwale", postalCode: "412101", feePaise: 0 } };
    await renderBoard({ bookings: [withContact] });
    const phone = screen.getByRole("link", { name: "+91 98765 43210" });
    expect(phone.getAttribute("href")).toBe("tel:+919876543210");
    expect(screen.getByText("Pickup from 12 MG Road, Kiwale 412101")).toBeTruthy();
  });

  test("an empty day says so; previous and next carry the neighbouring dates", async () => {
    await renderBoard({ date: "2026-11-30", bookings: [] });
    expect(screen.getByText(t.empty)).toBeTruthy();
    expect(screen.queryByText(/in time order/)).toBeNull();
    expect(screen.getByRole("link", { name: t.previousDay }).getAttribute("href")).toBe("/admin/bookings?date=2026-11-29");
    expect(screen.getByRole("link", { name: t.nextDay }).getAttribute("href")).toBe("/admin/bookings?date=2026-12-01");
  });

  test("the Today link shows on another day, and not on today", async () => {
    const other = await renderBoard({ date: "2026-11-30" });
    expect(screen.getByRole("link", { name: t.today }).getAttribute("href")).toBe("/admin/bookings");
    expect(screen.getByRole("heading", { level: 1 }).textContent).not.toContain(t.today);
    other.unmount();

    await renderBoard({ date: today });
    expect(screen.queryByRole("link", { name: t.today })).toBeNull();
  });

  test("on the last day of the range, next is a disabled button (not a link); on the first, previous is", async () => {
    const last = await renderBoard({ date: "2027-11-20" });
    expect(screen.queryByRole("link", { name: t.nextDay })).toBeNull();
    expect((screen.getByRole("button", { name: t.nextDay }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("link", { name: t.previousDay })).toBeTruthy();
    last.unmount();

    await renderBoard({ date: "2025-11-18" });
    expect(screen.queryByRole("link", { name: t.previousDay })).toBeNull();
    expect((screen.getByRole("button", { name: t.previousDay }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("link", { name: t.nextDay })).toBeTruthy();
  });

  test("the date form is a plain GET to /admin/bookings with a field named date", async () => {
    await renderBoard({ date: "2026-11-30" });
    const field = screen.getByLabelText(t.dateLabel) as HTMLInputElement;
    expect(field.name).toBe("date");
    expect(field.type).toBe("date");
    expect(field.value).toBe("2026-11-30");
    const form = field.closest("form")!;
    expect(form.getAttribute("action")).toBe("/admin/bookings");
    expect(form.getAttribute("method")).toBe("get");
    expect(within(form).getByRole("button", { name: t.showDate }).getAttribute("type")).toBe("submit");
  });

  test("the note shows only when the asked-for date couldn't be used", async () => {
    const without = await renderBoard({ note: false });
    expect(screen.queryByText(t.dateNote)).toBeNull();
    without.unmount();
    await renderBoard({ note: true });
    expect(screen.getByText(t.dateNote)).toBeTruthy();
  });
});
