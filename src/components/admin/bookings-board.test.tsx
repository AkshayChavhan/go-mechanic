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
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "Admin" | "Admin.bookings" | "Vehicles" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});
// The panels' forms post to these Server Actions; here they're stand-ins
// (admin-bookings.test.ts tests the real ones).
vi.mock("@/server/actions/admin-bookings", () => ({
  changeStatusFromBoard: vi.fn(async () => {}),
  assignFromBoard: vi.fn(async () => {}),
}));

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
    jobStatus: null,
    mechanic: null,
    cancelReason: null,
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

/** Counts up, so every token on a page is different and tests can tell them apart. */
function tokens() {
  let next = 0;
  return () => `token-${++next}`;
}

// 11:30 in India on the 19th: the 10:00 slot has started, the 15:30 one hasn't.
const now = new Date("2026-11-19T06:00:00Z");

function renderBoard(props: Partial<BookingsBoardProps> = {}) {
  return BookingsBoard({
    locale: "en",
    date: today,
    today,
    note: false,
    bookings: [],
    showCancelled: false,
    notice: null,
    mechanics: [],
    canContact: false,
    now,
    newToken: tokens(),
    ...props,
  }).then(renderWithIntl);
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
    expect(first.textContent).toContain(t.statuses.booked);
    expect(first.textContent).toContain(t.unassigned);
    expect(first.textContent).toContain("Job: Not started");
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

// --- Task 27: statuses, the Manage panel, the cancelled filter and notices ----

const manage = t.manage;
const mechanics = [
  { id: "m1", name: "Ravi" },
  { id: "m2", name: "" },
];
const cancelled = booking({
  id: "b9",
  code: "CNC4XL",
  startsAt: new Date("2026-11-19T07:30:00Z"),
  status: "cancelled",
  cancelReason: "Customer is out of town",
  customerName: "Meera Joshi",
  phoneNumber: "+919876543210",
});

/** The card for a booking code (formatted), found by its heading. */
const cardOf = (code: string) => screen.getByRole("heading", { level: 2, name: new RegExp(code) }).closest("li")!;
const buttonsIn = (element: HTMLElement) => within(element).queryAllByRole("button").map((button) => button.textContent);

describe("BookingsBoard: statuses and the Manage panel (task 27)", () => {
  test("each card shows its status, mechanic and job step; a cancelled card its reason", async () => {
    const confirmed = booking({
      id: "b4",
      code: "CNF3RM",
      startsAt: new Date("2026-11-19T08:30:00Z"),
      status: "confirmed",
      jobStatus: "inspection",
      mechanic: { id: "m1", name: "Ravi" },
    });
    await renderBoard({ bookings: [confirmed, cancelled], showCancelled: true });
    const confirmedCard = cardOf("CNF-3RM");
    expect(within(confirmedCard).getByText(t.statuses.confirmed).dataset.variant).toBe("success");
    expect(confirmedCard.textContent).toContain("Mechanic: Ravi");
    expect(confirmedCard.textContent).toContain("Job: Inspection");

    const cancelledCard = cardOf("CNC-4XL");
    expect(within(cancelledCard).getByText(t.statuses.cancelled).dataset.variant).toBe("destructive");
    expect(cancelledCard.textContent).toContain("Reason: Customer is out of town");
    // Cancelled is final: no panel, no form.
    expect(cancelledCard.querySelector("details")).toBeNull();
    expect(cancelledCard.querySelector("form")).toBeNull();
  });

  test("a booked card whose slot has started: Confirm (the one blue button), No-show and Cancel", async () => {
    await renderBoard({ bookings: [morning] });
    const card = cardOf("K7Q-4MX");
    expect(card.querySelector("summary")!.textContent).toBe("Manage booking K7Q-4MX");
    expect(buttonsIn(card)).toEqual([manage.confirm, manage.noShow, manage.cancel]);
    expect(within(card).getByRole("button", { name: manage.confirm }).dataset.variant).toBe("default");
    expect(within(card).getByRole("button", { name: manage.noShow }).dataset.variant).toBe("outline");
    expect(within(card).getByRole("button", { name: manage.cancel }).dataset.variant).toBe("destructive");
    expect(card.querySelectorAll('[data-variant="default"]')).toHaveLength(1);
  });

  test("a booked card before its slot offers no No-show", async () => {
    await renderBoard({ bookings: [afternoon] });
    expect(buttonsIn(cardOf("PZ3-H8T"))).toEqual([manage.confirm, manage.cancel]);
  });

  test("a no-show card offers only Arrived after all (no mechanic form: it isn't active)", async () => {
    await renderBoard({ bookings: [{ ...morning, status: "no-show" }], mechanics });
    const card = cardOf("K7Q-4MX");
    expect(within(card).getByText(t.statuses["no-show"]).dataset.variant).toBe("secondary");
    expect(buttonsIn(card)).toEqual([manage.arrived]);
    const form = within(card).getByRole("button", { name: manage.arrived }).closest("form")!;
    expect((form.querySelector('input[name="to"]') as HTMLInputElement).value).toBe("arrived");
    expect(within(card).queryByLabelText(manage.mechanicLabel)).toBeNull();
  });

  test("a started job offers no Cancel and no No-show, but the mechanic can still change", async () => {
    await renderBoard({ bookings: [{ ...morning, status: "confirmed", jobStatus: "in-service" }], mechanics });
    const card = cardOf("K7Q-4MX");
    expect(buttonsIn(card)).toEqual([manage.saveMechanic]);
    expect(within(card).queryByLabelText(manage.reasonLabel)).toBeNull();
  });

  test("a completed job allows nothing: no panel at all", async () => {
    await renderBoard({ bookings: [{ ...morning, status: "confirmed", jobStatus: "completed" }], mechanics });
    expect(cardOf("K7Q-4MX").querySelector("details")).toBeNull();
  });

  test("Cancel needs a labelled reason, as long as the save allows", async () => {
    await renderBoard({ bookings: [morning] });
    const reason = screen.getByLabelText(manage.reasonLabel) as HTMLTextAreaElement;
    expect(reason.name).toBe("reason");
    expect(reason.required).toBe(true);
    expect(reason.minLength).toBe(3);
    expect(reason.maxLength).toBe(200);
    expect(reason.getAttribute("aria-invalid")).toBeNull();
    expect(reason.closest("form")!.querySelector<HTMLInputElement>('input[name="to"]')!.value).toBe("cancelled");
  });

  test("the mechanic select: Nobody, every mechanic (an unnamed one says so), the current one chosen", async () => {
    await renderBoard({ bookings: [{ ...morning, mechanic: { id: "m1", name: "Ravi" } }], mechanics });
    const select = screen.getByLabelText(manage.mechanicLabel) as HTMLSelectElement;
    expect(select.name).toBe("mechanicId");
    expect([...select.options].map((option) => [option.value, option.textContent])).toEqual([
      ["", manage.nobody],
      ["m1", "Ravi"],
      ["m2", t.unnamedMechanic],
    ]);
    expect(select.value).toBe("m1");
    expect(within(select.closest("form")!).getByRole("button", { name: manage.saveMechanic }).dataset.variant).toBe("outline");
  });

  test("a current mechanic who is no longer in the list is still listed and chosen", async () => {
    await renderBoard({ bookings: [{ ...morning, mechanic: { id: "old", name: "Sunil" } }], mechanics: [] });
    const select = screen.getByLabelText(manage.mechanicLabel) as HTMLSelectElement;
    expect([...select.options].map((option) => option.value)).toEqual(["", "old"]);
    expect(select.value).toBe("old");
  });

  test("no mechanics and nobody assigned: says so, with no form", async () => {
    await renderBoard({ bookings: [morning], mechanics: [] });
    const card = cardOf("K7Q-4MX");
    expect(within(card).getByText(manage.noMechanics)).toBeTruthy();
    expect(within(card).queryByLabelText(manage.mechanicLabel)).toBeNull();
    expect(buttonsIn(card)).not.toContain(manage.saveMechanic);
  });

  test("two cards share no id, and each summary names its own booking", async () => {
    const { container } = await renderBoard({ bookings: [morning, afternoon], mechanics });
    const ids = [...container.querySelectorAll("[id]")].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...container.querySelectorAll("summary")].map((summary) => summary.textContent)).toEqual([
      "Manage booking K7Q-4MX",
      "Manage booking PZ3-H8T",
    ]);
    // Each card is the target of its action's #booking-<id> redirect.
    expect(cardOf("K7Q-4MX").id).toBe("booking-b1");
  });

  test("every form carries its own request token", async () => {
    const { container } = await renderBoard({ bookings: [morning, afternoon], mechanics });
    const forms = [...container.querySelectorAll("li details form")];
    expect(forms.length).toBe(7);
    const values = forms.map((form) => form.querySelector<HTMLInputElement>('input[name="requestToken"]')?.value);
    expect(values.every(Boolean)).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  });

  test("panels start closed", async () => {
    const { container } = await renderBoard({ bookings: [morning] });
    expect(container.querySelector("details")!.open).toBe(false);
  });
});

describe("BookingsBoard: the cancelled filter (task 27)", () => {
  test("by default a cancelled booking isn't listed or counted, and the link offers it", async () => {
    await renderBoard({ bookings: [morning, cancelled] });
    expect(screen.queryByRole("heading", { level: 2, name: /CNC-4XL/ })).toBeNull();
    expect(screen.getByText("1 booking, in time order.")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Show cancelled (1)" });
    expect(link.getAttribute("href")).toBe("/admin/bookings?date=2026-11-19&cancelled=show");
  });

  test("with the filter on it's listed, the count still leaves it out, and the link hides it again", async () => {
    await renderBoard({ bookings: [morning, cancelled], showCancelled: true });
    expect(screen.getByRole("heading", { level: 2, name: /CNC-4XL/ })).toBeTruthy();
    expect(screen.getByText("1 booking, in time order.")).toBeTruthy();
    expect(screen.getByRole("link", { name: t.hideCancelled }).getAttribute("href")).toBe("/admin/bookings?date=2026-11-19");
  });

  test("a day whose only booking is cancelled: none to show, no count, and Show cancelled (1)", async () => {
    await renderBoard({ bookings: [cancelled] });
    expect(screen.getByText(t.emptyAllCancelled)).toBeTruthy();
    expect(screen.queryByText(/in time order/)).toBeNull();
    expect(screen.getByRole("link", { name: "Show cancelled (1)" })).toBeTruthy();
  });

  test("no cancelled bookings: no filter link", async () => {
    await renderBoard({ bookings: [morning] });
    expect(screen.queryByRole("link", { name: /cancelled/i })).toBeNull();
  });

  test("the day links, Today and the date form keep the filter", async () => {
    await renderBoard({ date: "2026-11-30", showCancelled: true });
    expect(screen.getByRole("link", { name: t.previousDay }).getAttribute("href")).toBe("/admin/bookings?date=2026-11-29&cancelled=show");
    expect(screen.getByRole("link", { name: t.nextDay }).getAttribute("href")).toBe("/admin/bookings?date=2026-12-01&cancelled=show");
    expect(screen.getByRole("link", { name: t.today }).getAttribute("href")).toBe("/admin/bookings?cancelled=show");
    const form = (screen.getByLabelText(t.dateLabel) as HTMLInputElement).closest("form")!;
    expect(form.querySelector<HTMLInputElement>('input[name="cancelled"]')!.value).toBe("show");
  });

  test("with the filter off the date form sends no filter", async () => {
    await renderBoard({ date: "2026-11-30" });
    const form = (screen.getByLabelText(t.dateLabel) as HTMLInputElement).closest("form")!;
    expect(form.querySelector('input[name="cancelled"]')).toBeNull();
  });
});

describe("BookingsBoard: the notice after an action (task 27)", () => {
  test("a success is a status message naming the booking by its own code", async () => {
    await renderBoard({ bookings: [morning], notice: { notice: "confirmed", code: "K7Q4MX" } });
    expect(screen.getByRole("status").textContent).toBe("Booking K7Q-4MX is confirmed.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("a code that isn't one of the day's bookings shows nothing", async () => {
    await renderBoard({ bookings: [morning], notice: { notice: "confirmed", code: "ZZZZZZ" } });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("after a cancel (filter off): names the customer, reminds staff to tell them, with call links", async () => {
    await renderBoard({ bookings: [morning, cancelled], notice: { notice: "cancelled", code: "CNC4XL" }, canContact: true });
    const notice = screen.getByRole("status");
    expect(notice.textContent).toContain("Booking CNC-4XL is cancelled.");
    expect(notice.textContent).toContain("Call or WhatsApp Meera Joshi to let them know");
    const call = within(notice).getByRole("link", { name: "Call Meera Joshi" });
    expect(call.getAttribute("href")).toBe("tel:+919876543210");
    const whatsapp = within(notice).getByRole("link", { name: "WhatsApp Meera Joshi" });
    expect(whatsapp.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/919876543210\?text=Hello%20Meera%20Joshi/);
    expect(decodeURIComponent(whatsapp.getAttribute("href")!)).toContain("booking CNC-4XL on");
    expect(whatsapp.getAttribute("target")).toBe("_blank");
    // The reason stays on the (hidden) card, never in the notice.
    expect(notice.textContent).not.toContain("out of town");
  });

  test("after a cancel without contact permission: the reminder, but no call links", async () => {
    await renderBoard({ bookings: [cancelled], notice: { notice: "cancelled", code: "CNC4XL" }, canContact: false });
    const notice = screen.getByRole("status");
    expect(notice.textContent).toContain("Call or WhatsApp Meera Joshi");
    expect(within(notice).queryAllByRole("link")).toHaveLength(0);
  });

  test("a refused reason: an alert saying what to do, and the card's panel open with the message under the field", async () => {
    await renderBoard({ bookings: [morning, afternoon], notice: { notice: "reason-too-short", code: "K7Q4MX" } });
    const alert = screen.getAllByRole("alert")[0];
    expect(alert.textContent).toBe(`${t.notices.refused}To cancel booking K7Q-4MX, give a reason of at least 3 characters.`);
    const card = cardOf("K7Q-4MX");
    expect(card.querySelector("details")!.open).toBe(true);
    const reason = within(card).getByLabelText(manage.reasonLabel);
    expect(reason.getAttribute("aria-invalid")).toBe("true");
    const error = document.getElementById("cancel-reason-error-b1")!;
    expect(error.textContent).toBe("Give a reason of at least 3 characters.");
    expect(reason.getAttribute("aria-describedby")).toContain("cancel-reason-error-b1");
    // The other card stays closed, without the message.
    expect(cardOf("PZ3-H8T").querySelector("details")!.open).toBe(false);
  });

  test('"changed" says what the booking is now', async () => {
    await renderBoard({ bookings: [{ ...morning, status: "no-show" }], notice: { notice: "changed", code: "K7Q4MX" } });
    expect(screen.getByRole("alert").textContent).toContain("Booking K7Q-4MX changed in the meantime and is now no-show.");
  });

  test('"assigned" names the mechanic, or says there is none', async () => {
    const first = await renderBoard({
      bookings: [{ ...morning, mechanic: { id: "m1", name: "Ravi" } }],
      notice: { notice: "assigned", code: "K7Q4MX" },
    });
    expect(screen.getByRole("status").textContent).toBe("Booking K7Q-4MX is now with Ravi.");
    first.unmount();
    await renderBoard({ bookings: [morning], notice: { notice: "assigned", code: "K7Q4MX" } });
    expect(screen.getByRole("status").textContent).toBe("Booking K7Q-4MX now has no mechanic.");
  });

  test("no ₹ anywhere, panels and a cancel notice included", async () => {
    const { container } = await renderBoard({
      bookings: [{ ...morning, totalPaise: 150_000 }, cancelled],
      showCancelled: true,
      notice: { notice: "cancelled", code: "CNC4XL" },
      canContact: true,
      mechanics,
    });
    expect(container.textContent).not.toContain("₹");
  });
});
