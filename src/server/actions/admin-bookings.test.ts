import { beforeEach, describe, expect, test, vi } from "vitest";

import type { BoardView } from "@/domain/board-dates";
import type { Role } from "@/domain/roles";
import { getCurrentUser } from "@/server/auth/session";
import { type UpdateJobResult, updateJob } from "@/server/dal/jobs";
import { assignMechanic, changeBookingStatus } from "@/server/dal/staff-booking-changes";

import { assignFromBoard, changeStatusFromBoard, moveJobFromBoard } from "./admin-bookings";

// The actions only check, call the data-access layer and redirect. The saves
// (tested on their own in staff-booking-changes.test.ts) are replaced here, so
// each test sets the answer it needs. requirePermission is the real one,
// reading a mocked session.
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/dal/staff-booking-changes", () => ({ changeBookingStatus: vi.fn(), assignMechanic: vi.fn() }));
vi.mock("@/server/dal/jobs", () => ({ updateJob: vi.fn() }));

const BOOKING = "11111111-2222-4333-8444-555555555555";
const TOKEN = "3f2b8c4e-1d2a-4b6c-9e8f-0a1b2c3d4e5f";
const MECHANIC = "99999999-2222-4333-8444-555555555555";
const day: BoardView = { date: "2026-11-20", showCancelled: false };
const dayWithCancelled: BoardView = { date: "2026-11-20", showCancelled: true };

const savedUpdate = { id: "event-1", movedTo: "inspection" as const, note: null, hadPhotos: false, createdAt: new Date("2026-11-20T05:00:00Z") };

const userWith = (role: Role) => ({ id: "staff-1", phoneNumber: "+919876500001", role });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(userWith("manager"));
  vi.mocked(changeBookingStatus).mockResolvedValue({ status: "changed", code: "K7Q4MX", bookingStatus: "confirmed" });
  vi.mocked(assignMechanic).mockResolvedValue({ status: "changed", code: "K7Q4MX", mechanicId: MECHANIC });
  vi.mocked(updateJob).mockResolvedValue({ status: "updated", update: savedUpdate });
});

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

/** What a call threw: redirect() and notFound() work by throwing. */
async function thrownBy(run: Promise<unknown>): Promise<unknown> {
  return run.then(
    () => "nothing thrown",
    (error: unknown) => error,
  );
}

/** The address a redirect went to (its digest is "NEXT_REDIRECT;replace;<url>;307;"). */
async function redirectedTo(run: Promise<unknown>): Promise<string> {
  const error = (await thrownBy(run)) as { digest?: string };
  const match = /^NEXT_REDIRECT;replace;(.+);307;$/.exec(error.digest ?? "");
  if (!match) throw new Error(`not a replace redirect: ${String(error.digest ?? error)}`);
  return match[1];
}

const TO_LOGIN = { digest: expect.stringMatching(/^NEXT_REDIRECT;replace;\/login\?session=ended;/) };
const NOT_FOUND = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };

const board = (query: string) => `/admin/bookings?${query}#booking-${BOOKING}`;

describe("changeStatusFromBoard", () => {
  test("logged out: to /login, and nothing is changed", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await thrownBy(changeStatusFromBoard("en", BOOKING, day, form({ to: "confirmed", requestToken: TOKEN })))).toMatchObject(
      TO_LOGIN,
    );
    expect(changeBookingStatus).not.toHaveBeenCalled();
  });

  test.each(["customer", "mechanic"] as const)("a %s: the 404 page, and nothing is changed", async (role) => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith(role));
    expect(await thrownBy(changeStatusFromBoard("en", BOOKING, day, form({ to: "confirmed", requestToken: TOKEN })))).toMatchObject(
      NOT_FOUND,
    );
    expect(changeBookingStatus).not.toHaveBeenCalled();
  });

  test("an unknown locale is refused before anything else", async () => {
    await expect(changeStatusFromBoard("xx", BOOKING, day, form({ to: "confirmed", requestToken: TOKEN }))).rejects.toThrow();
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  test("Confirm: passes only the bound booking and its own fields, then back to the same day with the notice", async () => {
    const url = await redirectedTo(
      changeStatusFromBoard(
        "en",
        BOOKING,
        day,
        form({ to: "confirmed", requestToken: TOKEN, userId: "someone-else", status: "cancelled", bookingId: "another" }),
      ),
    );
    expect(changeBookingStatus).toHaveBeenCalledWith({ bookingId: BOOKING, to: "confirmed", reason: "", requestToken: TOKEN });
    expect(url).toBe(board("date=2026-11-20&notice=confirmed&code=K7Q4MX"));
  });

  test("a second send of the same form (duplicate) shows the same notice as the first", async () => {
    vi.mocked(changeBookingStatus).mockResolvedValue({ status: "duplicate", code: "K7Q4MX", bookingStatus: "confirmed" });
    expect(await redirectedTo(changeStatusFromBoard("en", BOOKING, day, form({ to: "confirmed", requestToken: TOKEN })))).toBe(
      board("date=2026-11-20&notice=confirmed&code=K7Q4MX"),
    );
  });

  test("Arrived after all confirms the no-show, with its own notice", async () => {
    const url = await redirectedTo(changeStatusFromBoard("en", BOOKING, day, form({ to: "arrived", requestToken: TOKEN })));
    expect(changeBookingStatus).toHaveBeenCalledWith(expect.objectContaining({ to: "confirmed" }));
    expect(url).toBe(board("date=2026-11-20&notice=arrived&code=K7Q4MX"));
  });

  test("Cancel: the reason goes to the save, never into the address; the filter is kept", async () => {
    vi.mocked(changeBookingStatus).mockResolvedValue({ status: "changed", code: "K7Q4MX", bookingStatus: "cancelled" });
    const url = await redirectedTo(
      changeStatusFromBoard("en", BOOKING, dayWithCancelled, form({ to: "cancelled", reason: "Customer is unwell", requestToken: TOKEN })),
    );
    expect(changeBookingStatus).toHaveBeenCalledWith({
      bookingId: BOOKING,
      to: "cancelled",
      reason: "Customer is unwell",
      requestToken: TOKEN,
    });
    expect(url).toBe(board("date=2026-11-20&cancelled=show&notice=cancelled&code=K7Q4MX"));
    expect(url).not.toMatch(/unwell/i);
  });

  test("a refused reason: its own notice, with the code the form posted, and never the reason", async () => {
    vi.mocked(changeBookingStatus).mockResolvedValue({ status: "problems", problems: [{ field: "reason", problem: "reason-too-short" }] });
    const url = await redirectedTo(
      changeStatusFromBoard("en", BOOKING, day, form({ to: "cancelled", reason: "  zz  ", code: "K7Q4MX", requestToken: TOKEN })),
    );
    expect(url).toBe(board("date=2026-11-20&notice=reason-too-short&code=K7Q4MX"));
    expect(url).not.toContain("zz");
  });

  test("a posted code that isn't a booking code is left out", async () => {
    vi.mocked(changeBookingStatus).mockResolvedValue({ status: "problems", problems: [{ field: "reason", problem: "reason-too-long" }] });
    const url = await redirectedTo(
      changeStatusFromBoard("en", BOOKING, day, form({ to: "cancelled", reason: "x", code: "<script>", requestToken: TOKEN })),
    );
    expect(url).toBe(board("date=2026-11-20"));
  });

  test.each([
    ["not-allowed", { status: "not-allowed", code: "K7Q4MX" }, "changed"],
    ["stale", { status: "stale", code: "K7Q4MX" }, "changed"],
    ["job-started", { status: "job-started", code: "K7Q4MX" }, "job-started"],
    ["too-early", { status: "too-early", code: "K7Q4MX" }, "too-early"],
  ] as const)("%s: the refusal's notice", async (_, answer, notice) => {
    vi.mocked(changeBookingStatus).mockResolvedValue(answer);
    expect(await redirectedTo(changeStatusFromBoard("en", BOOKING, day, form({ to: "no-show", requestToken: TOKEN })))).toBe(
      board(`date=2026-11-20&notice=${notice}&code=K7Q4MX`),
    );
  });

  test("a broken form (a bad token or status): nothing saved", async () => {
    vi.mocked(changeBookingStatus).mockResolvedValue({ status: "problems", problems: [{ field: "token", problem: "bad-token" }] });
    expect(await redirectedTo(changeStatusFromBoard("en", BOOKING, day, form({ to: "confirmed", code: "K7Q4MX" })))).toBe(
      board("date=2026-11-20&notice=not-saved&code=K7Q4MX"),
    );
  });

  test("a booking that doesn't exist: back to the board, no notice", async () => {
    vi.mocked(changeBookingStatus).mockResolvedValue({ status: "not-found" });
    expect(await redirectedTo(changeStatusFromBoard("en", BOOKING, day, form({ to: "confirmed", requestToken: TOKEN })))).toBe(
      board("date=2026-11-20"),
    );
  });

  test("a bound view that was tampered with is checked again: today, filter off", async () => {
    const url = await redirectedTo(
      changeStatusFromBoard("en", BOOKING, { date: "../../x", showCancelled: "yes" } as never, form({ to: "confirmed", requestToken: TOKEN })),
    );
    expect(url).toBe(board("notice=confirmed&code=K7Q4MX"));
  });

  test("a bound booking id that isn't a uuid gets no #fragment", async () => {
    vi.mocked(changeBookingStatus).mockResolvedValue({ status: "not-found" });
    expect(await redirectedTo(changeStatusFromBoard("en", "x#y", day, form({ to: "confirmed", requestToken: TOKEN })))).toBe(
      "/admin/bookings?date=2026-11-20",
    );
  });

  test("an unexpected error comes out without its details", async () => {
    vi.mocked(changeBookingStatus).mockRejectedValue(new Error("Failed query: params: Customer is unwell"));
    const error = await thrownBy(changeStatusFromBoard("en", BOOKING, day, form({ to: "cancelled", requestToken: TOKEN })));
    expect((error as Error).name).toBe("StaffServiceError");
    expect((error as Error).message).not.toContain("unwell");
  });
});

describe("assignFromBoard", () => {
  test("logged out: to /login, and nothing is changed", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await thrownBy(assignFromBoard("en", BOOKING, day, form({ mechanicId: MECHANIC, requestToken: TOKEN })))).toMatchObject(TO_LOGIN);
    expect(assignMechanic).not.toHaveBeenCalled();
  });

  test("a customer: the 404 page, and nothing is changed", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("customer"));
    expect(await thrownBy(assignFromBoard("en", BOOKING, day, form({ mechanicId: MECHANIC, requestToken: TOKEN })))).toMatchObject(NOT_FOUND);
    expect(assignMechanic).not.toHaveBeenCalled();
  });

  test("passes only the bound booking, the mechanic and the token; back with the notice", async () => {
    const url = await redirectedTo(
      assignFromBoard("en", BOOKING, dayWithCancelled, form({ mechanicId: MECHANIC, requestToken: TOKEN, userId: "x", bookingId: "y" })),
    );
    expect(assignMechanic).toHaveBeenCalledWith({ bookingId: BOOKING, mechanicId: MECHANIC, requestToken: TOKEN });
    expect(url).toBe(board("date=2026-11-20&cancelled=show&notice=assigned&code=K7Q4MX"));
  });

  test('"Nobody" (an empty choice) removes the mechanic', async () => {
    vi.mocked(assignMechanic).mockResolvedValue({ status: "duplicate", code: "K7Q4MX", mechanicId: null });
    const url = await redirectedTo(assignFromBoard("en", BOOKING, day, form({ mechanicId: "", requestToken: TOKEN })));
    expect(assignMechanic).toHaveBeenCalledWith({ bookingId: BOOKING, mechanicId: null, requestToken: TOKEN });
    expect(url).toBe(board("date=2026-11-20&notice=assigned&code=K7Q4MX"));
  });

  test.each([
    ["unchanged", "unchanged"],
    ["not-allowed", "changed"],
    ["stale", "changed"],
    ["job-closed", "job-closed"],
    ["not-a-mechanic", "not-a-mechanic"],
  ] as const)("%s: the %s notice", async (status, notice) => {
    vi.mocked(assignMechanic).mockResolvedValue({ status, code: "K7Q4MX" });
    expect(await redirectedTo(assignFromBoard("en", BOOKING, day, form({ mechanicId: MECHANIC, requestToken: TOKEN })))).toBe(
      board(`date=2026-11-20&notice=${notice}&code=K7Q4MX`),
    );
  });
});

describe("moveJobFromBoard (the Job step control, task 33)", () => {
  const move = (step: string) => form({ step, code: "K7Q4MX", requestToken: TOKEN });

  test("logged out: to /login, and nothing is moved", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await thrownBy(moveJobFromBoard("en", BOOKING, day, move("inspection")))).toMatchObject(TO_LOGIN);
    expect(updateJob).not.toHaveBeenCalled();
  });

  test.each(["customer", "mechanic"] as const)("a %s: the 404 page, and nothing is moved", async (role) => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith(role));
    expect(await thrownBy(moveJobFromBoard("en", BOOKING, day, move("inspection")))).toMatchObject(NOT_FOUND);
    expect(updateJob).not.toHaveBeenCalled();
  });

  test("passes the bound booking, the posted step and token, no note or photos; back with the notice", async () => {
    const url = await redirectedTo(
      moveJobFromBoard("en", BOOKING, dayWithCancelled, form({ step: "inspection", code: "K7Q4MX", requestToken: TOKEN, note: "x", bookingId: "y" })),
    );
    expect(updateJob).toHaveBeenCalledWith({ bookingId: BOOKING, toStatus: "inspection", note: "", photoSetId: "", requestToken: TOKEN });
    expect(url).toBe(board("date=2026-11-20&cancelled=show&notice=job-moved&code=K7Q4MX"));
  });

  test("a second send of the same form (duplicate) shows the same notice as the first", async () => {
    vi.mocked(updateJob).mockResolvedValue({ status: "duplicate", update: savedUpdate });
    expect(await redirectedTo(moveJobFromBoard("en", BOOKING, day, move("inspection")))).toBe(
      board("date=2026-11-20&notice=job-moved&code=K7Q4MX"),
    );
  });

  test.each(["completed", "", "toString", "booked"])("a posted %j step is refused before updateJob", async (step) => {
    expect(await redirectedTo(moveJobFromBoard("en", BOOKING, day, move(step)))).toBe(board("date=2026-11-20&notice=not-saved&code=K7Q4MX"));
    expect(updateJob).not.toHaveBeenCalled();
  });

  test("awaiting approval goes to updateJob, which refuses the move: nothing written, the job-step notice", async () => {
    vi.mocked(updateJob).mockResolvedValue({ status: "problems", problems: [{ field: "status", problem: "move-not-allowed" }] });
    const url = await redirectedTo(moveJobFromBoard("en", BOOKING, day, move("awaiting-approval")));
    expect(updateJob).toHaveBeenCalledWith(expect.objectContaining({ toStatus: "awaiting-approval" }));
    expect(url).toBe(board("date=2026-11-20&notice=job-step-changed&code=K7Q4MX"));
  });

  test.each<[string, UpdateJobResult, string]>([
    ["job-closed", { status: "job-closed" }, "job-step-changed"],
    ["booking-closed", { status: "booking-closed" }, "changed"],
    ["vehicle received before the booking's day", { status: "problems", problems: [{ field: "status", problem: "before-booking-day" }] }, "before-booking-day"],
    ["a broken form", { status: "problems", problems: [{ field: "form", problem: "bad-request" }] }, "not-saved"],
  ])("%s: the refusal's notice", async (_, answer, notice) => {
    vi.mocked(updateJob).mockResolvedValue(answer);
    expect(await redirectedTo(moveJobFromBoard("en", BOOKING, day, move("ready")))).toBe(board(`date=2026-11-20&notice=${notice}&code=K7Q4MX`));
  });

  test("a booking the caller may not work on: back to the board, no notice", async () => {
    vi.mocked(updateJob).mockResolvedValue({ status: "not-found" });
    expect(await redirectedTo(moveJobFromBoard("en", BOOKING, day, move("inspection")))).toBe(board("date=2026-11-20"));
  });

  test("an unexpected error comes out without its details", async () => {
    vi.mocked(updateJob).mockRejectedValue(new Error("Failed query: params: MH12AB0042"));
    const error = await thrownBy(moveJobFromBoard("en", BOOKING, day, move("inspection")));
    expect((error as Error).name).toBe("StaffServiceError");
    expect((error as Error).message).not.toContain("MH12");
  });
});
