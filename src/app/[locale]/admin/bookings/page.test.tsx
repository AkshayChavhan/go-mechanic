import { screen } from "@testing-library/react";
import { use } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Role } from "@/domain/roles";
import { renderWithIntl } from "@/i18n/test-utils";
import { getCurrentUser } from "@/server/auth/session";
import { listBookingsOn } from "@/server/dal/staff-bookings";
import { listMechanics } from "@/server/dal/staff-users";
import messages from "../../../../../messages/en.json";

import { BookingsGate } from "./bookings-gate";
import AdminBookingsPage from "./page";

// The gate runs the real requirePermission; the session read and the
// bookings read are stand-ins. The board itself is a stand-in too (its own
// test covers what it shows): here it reports what the gate passed it.
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/dal/staff-bookings", () => ({ listBookingsOn: vi.fn() }));
vi.mock("@/server/dal/staff-users", () => ({ listMechanics: vi.fn() }));
// Outside a Next.js request io() has nothing to wait for.
vi.mock("next/cache", () => ({ io: async () => {} }));
const gate = vi.hoisted(() => ({ suspend: false }));
vi.mock("@/components/admin/bookings-board", () => ({
  BookingsBoard: (props: { date: string; today: string; note: boolean; bookings: unknown[]; newToken: () => string }) => {
    if (gate.suspend) use(new Promise(() => {}));
    // Two tokens, to show each form gets a fresh one.
    const tokens = [props.newToken(), props.newToken()];
    return <p data-testid="board">{JSON.stringify({ ...props, bookings: props.bookings.length, tokens })}</p>;
  },
}));

/** Every message under a namespace, nested ones included (the statuses, the notices...). */
function wordsIn(namespace: object): string[] {
  return Object.values(namespace).flatMap((value) => (typeof value === "string" ? [value] : wordsIn(value as object)));
}

const userWith = (role: Role) => ({ id: "u1", phoneNumber: "+919876543210", role });

async function thrownBy(run: Promise<unknown>): Promise<unknown> {
  return run.then(
    () => "nothing thrown",
    (error: unknown) => error,
  );
}

// The same digests as src/server/auth/access.test.ts.
const TO_LOGIN = { digest: expect.stringMatching(/^NEXT_REDIRECT;replace;\/login\?session=ended;/) };
const NOT_FOUND = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };

const gateFor = (searchParams: Record<string, string | string[] | undefined>) =>
  BookingsGate({ locale: "en", searchParams: Promise.resolve(searchParams) });

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(listBookingsOn).mockReset();
  vi.mocked(listBookingsOn).mockResolvedValue({ ok: true, bookings: [] });
  vi.mocked(listMechanics).mockReset();
  vi.mocked(listMechanics).mockResolvedValue([{ id: "m1", name: "Ravi" }]);
  // 19 Nov 2026, 23:00 in India (17:30 UTC): still the 19th there.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-19T17:30:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("BookingsGate (/admin/bookings's gate)", () => {
  test("logged out (a leftover cookie): sent to /login?session=ended, nothing read", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await thrownBy(gateFor({}))).toMatchObject(TO_LOGIN);
    expect(listBookingsOn).not.toHaveBeenCalled();
    expect(listMechanics).not.toHaveBeenCalled();
  });

  test.each(["customer", "mechanic"] as const)("a %s: the 404 page, nothing read", async (role) => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith(role));
    expect(await thrownBy(gateFor({}))).toMatchObject(NOT_FOUND);
    expect(listBookingsOn).not.toHaveBeenCalled();
    expect(listMechanics).not.toHaveBeenCalled();
  });

  test("a manager with no date: today in India, no note", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("manager"));
    renderWithIntl(await gateFor({}));
    expect(listBookingsOn).toHaveBeenCalledWith("2026-11-19");
    expect(JSON.parse(screen.getByTestId("board").textContent!)).toMatchObject({
      date: "2026-11-19",
      today: "2026-11-19",
      note: false,
      bookings: 0,
    });
  });

  test("an owner asking for a day: that day's bookings", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("owner"));
    vi.mocked(listBookingsOn).mockResolvedValue({ ok: true, bookings: [{} as never, {} as never] });
    renderWithIntl(await gateFor({ date: "2026-11-20" }));
    expect(listBookingsOn).toHaveBeenCalledWith("2026-11-20");
    expect(JSON.parse(screen.getByTestId("board").textContent!)).toMatchObject({ date: "2026-11-20", note: false, bookings: 2 });
  });

  test("an unreadable date: today, with the note", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("owner"));
    renderWithIntl(await gateFor({ date: "2026-02-30" }));
    expect(listBookingsOn).toHaveBeenCalledWith("2026-11-19");
    expect(JSON.parse(screen.getByTestId("board").textContent!)).toMatchObject({ date: "2026-11-19", note: true });
  });
});

describe("BookingsGate: the filter, the notice and the forms (task 27)", () => {
  const boardProps = () => JSON.parse(screen.getByTestId("board").textContent!);

  test("by default: cancelled hidden, no notice, the mechanics, contact for an owner, and the request time", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("owner"));
    renderWithIntl(await gateFor({}));
    expect(listMechanics).toHaveBeenCalled();
    expect(boardProps()).toMatchObject({
      showCancelled: false,
      notice: null,
      mechanics: [{ id: "m1", name: "Ravi" }],
      canContact: true,
      now: "2026-11-19T17:30:00.000Z",
    });
  });

  test("?cancelled=show, and a known notice with a booking code, are passed on", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("manager"));
    renderWithIntl(await gateFor({ date: "2026-11-20", cancelled: "show", notice: "cancelled", code: "K7Q4MX" }));
    expect(boardProps()).toMatchObject({ date: "2026-11-20", showCancelled: true, notice: { notice: "cancelled", code: "K7Q4MX" } });
  });

  test.each([
    ["an unknown notice", { notice: "deleted", code: "K7Q4MX" }],
    ["a malformed code", { notice: "confirmed", code: "<b>hi</b>" }],
    ["a notice without a code", { notice: "confirmed" }],
  ])("%s: no notice", async (_, query) => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("owner"));
    renderWithIntl(await gateFor(query));
    expect(boardProps().notice).toBeNull();
  });

  test("every form gets a fresh uuid token, different on each render", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("owner"));
    const first = renderWithIntl(await gateFor({}));
    const firstTokens: string[] = boardProps().tokens;
    first.unmount();
    renderWithIntl(await gateFor({}));
    const secondTokens: string[] = boardProps().tokens;
    const all = [...firstTokens, ...secondTokens];
    for (const token of all) expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new Set(all).size).toBe(4);
  });
});

describe("/admin/bookings", () => {
  test("built ahead of time: only the neutral loading line, no heading and no staff word", () => {
    gate.suspend = true;
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("owner"));
    const { container } = renderWithIntl(<AdminBookingsPage params={Promise.resolve({ locale: "en" })} searchParams={new Promise(() => {})} />);
    expect(screen.getByText(messages.Admin.loading)).toBeTruthy();
    expect(screen.queryByRole("heading")).toBeNull();
    for (const word of wordsIn(messages.Admin.bookings)) expect(container.textContent).not.toContain(word);
  });
});
