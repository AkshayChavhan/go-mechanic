"use server";

// The bookings board's Server Actions (task 27): a status change (Confirm,
// Cancel, No-show, Arrived after all) and Assign mechanic; from task 33 the
// Job step control's move (moveJobFromBoard).
//
// The board posts them as plain <form>s, so they work without JavaScript
// (node_modules/next/dist/docs/01-app/02-guides/forms.md, "Passing additional
// arguments": bound arguments work from a Server Component and are encrypted).
// Each action:
// 1. checks the bound locale, then the permission (requirePermission:
//    logged out, a redirect to /login; without "bookings.manage", the 404);
// 2. reads only its own fields: a posted userId, status or bookingId does
//    nothing, and the booking id comes from the bound argument;
// 3. calls the data-access save inside staffWithoutDetails, so an unexpected
//    error (a failed insert carries the cancel reason in its values) never
//    reaches the logs with its details;
// 4. redirects back to the board it came from, outside any try (redirect()
//    works by throwing): the same day and cancelled filter, a fixed notice
//    code and the booking code, and #booking-<id> so the page lands on the
//    card. Nothing typed (the reason), no name and no phone number goes in
//    the address. A second send of the same form ("duplicate") gets the same
//    notice as the first.
//
// "use server" must come first; `import "server-only"` follows it.

import "server-only";

import { RedirectType } from "next/navigation";

import { type BoardNotice, boardQuery, checkBoardView, parseBoardNotice } from "@/domain/board-dates";
import { isUuid } from "@/domain/ids";
import { isBoardJobTarget, isJobStatus } from "@/domain/jobs";
import type { Locale } from "@/i18n/config";
import { redirect } from "@/i18n/navigation";
import { requirePermission } from "@/server/auth/access";
import { staffWithoutDetails } from "@/server/auth/errors";
import { type UpdateJobResult, updateJob } from "@/server/dal/jobs";
import {
  type AssignMechanicResult,
  assignMechanic,
  type ChangeBookingStatusResult,
  changeBookingStatus,
  type StaffStatusTarget,
} from "@/server/dal/staff-booking-changes";

import { checkedLocale, formText } from "./form-input";

/**
 * What each status button posts as `to`, the status it saves and its notice.
 * "Arrived after all" saves "confirmed" like Confirm, but says something else.
 */
const STATUS_BUTTONS: Record<string, { to: StaffStatusTarget; notice: BoardNotice }> = {
  confirmed: { to: "confirmed", notice: "confirmed" },
  cancelled: { to: "cancelled", notice: "cancelled" },
  "no-show": { to: "no-show", notice: "no-show" },
  arrived: { to: "confirmed", notice: "arrived" },
};

/** Changes a booking's status from its card's Manage panel. */
export async function changeStatusFromBoard(
  locale: string,
  bookingId: string,
  boardView: unknown,
  formData: FormData,
): Promise<void> {
  const checked = checkedLocale(locale);
  await requirePermission(checked, "bookings.manage");

  const id = typeof bookingId === "string" ? bookingId : "";
  const posted = formText(formData, "to");
  // Object.hasOwn: a posted "toString" must not find Object.prototype's.
  const button = Object.hasOwn(STATUS_BUTTONS, posted) ? STATUS_BUTTONS[posted] : null;

  const result = await staffWithoutDetails("changeBookingStatus", () =>
    changeBookingStatus({
      bookingId: id,
      // An unknown value goes on as it is: the save refuses it ("bad-status").
      to: button?.to ?? posted,
      reason: formText(formData, "reason"),
      requestToken: formText(formData, "requestToken"),
    }),
  );
  return backToBoard(checked, id, boardView, statusNotice(result, button?.notice ?? null), codeOf(result, formData));
}

/** Gives a booking's job to a mechanic, or to nobody (the "Nobody" choice posts ""). */
export async function assignFromBoard(
  locale: string,
  bookingId: string,
  boardView: unknown,
  formData: FormData,
): Promise<void> {
  const checked = checkedLocale(locale);
  await requirePermission(checked, "bookings.manage");

  const id = typeof bookingId === "string" ? bookingId : "";
  const mechanicId = formText(formData, "mechanicId");
  const result = await staffWithoutDetails("assignMechanic", () =>
    assignMechanic({ bookingId: id, mechanicId: mechanicId === "" ? null : mechanicId, requestToken: formText(formData, "requestToken") }),
  );
  return backToBoard(checked, id, boardView, assignNotice(result), codeOf(result, formData));
}

/**
 * Moves a booking's job to the posted step, from the Job step control (task 33).
 * It reuses task 31's engine (updateJob), which checks "jobs.update", an
 * active booking, the move from the job's step as it is now, and the token,
 * and writes the job-update event. The move carries no note and no photos.
 */
export async function moveJobFromBoard(
  locale: string,
  bookingId: string,
  boardView: unknown,
  formData: FormData,
): Promise<void> {
  const checked = checkedLocale(locale);
  await requirePermission(checked, "bookings.manage");

  const id = typeof bookingId === "string" ? bookingId : "";
  const step = formText(formData, "step");
  const posted = formText(formData, "code") || null;
  // Refused here, before any save: a blank or unknown step (a broken form),
  // and "completed", which the board never offers (isBoardJobTarget). The
  // booking's day isn't known here: updateJob checks it, and the move from
  // the job's step as it is now, with the booking locked (the page may be
  // out of date), so "awaiting-approval" and an early "vehicle-received" are refused there.
  if (!isJobStatus(step) || !isBoardJobTarget(step, { slotDayReached: true })) {
    return backToBoard(checked, id, boardView, "not-saved", posted);
  }

  const result = await staffWithoutDetails("updateJob", () =>
    updateJob({ bookingId: id, toStatus: step, note: "", photoSetId: "", requestToken: formText(formData, "requestToken") }),
  );
  // updateJob's answers carry no booking code, so the one the panel posted
  // picks the card (the board checks it is one of the day's bookings).
  return backToBoard(checked, id, boardView, jobNotice(result), posted);
}

function jobNotice(result: UpdateJobResult): BoardNotice | null {
  switch (result.status) {
    case "updated":
    case "duplicate":
      return "job-moved";
    case "job-closed":
      // Completed in the meantime: the notice says where the job is now.
      return "job-step-changed";
    case "booking-closed":
      // Cancelled or a no-show in the meantime: the notice says which.
      return "changed";
    case "problems":
      // A move that no longer fits the job's step, or a vehicle received before
      // the booking's day; anything else is a broken form.
      if (result.problems.some((problem) => problem.problem === "move-not-allowed")) return "job-step-changed";
      if (result.problems.some((problem) => problem.problem === "before-booking-day")) return "before-booking-day";
      return "not-saved";
    case "not-found":
      return null;
  }
}

function statusNotice(result: ChangeBookingStatusResult, success: BoardNotice | null): BoardNotice | null {
  switch (result.status) {
    case "changed":
    case "duplicate":
      return success;
    case "not-allowed":
    case "stale":
      return "changed";
    case "job-started":
    case "too-early":
      return result.status;
    case "problems": {
      // A refused reason gets its own notice (its panel reopens with the
      // message under the field); anything else means a broken form.
      const reason = result.problems.find((problem) => problem.field === "reason");
      return reason ? reason.problem : "not-saved";
    }
    case "not-found":
      return null;
  }
}

function assignNotice(result: AssignMechanicResult): BoardNotice | null {
  switch (result.status) {
    case "changed":
    case "duplicate":
      return "assigned";
    case "not-allowed":
    case "stale":
      return "changed";
    case "unchanged":
    case "job-closed":
    case "not-a-mechanic":
      return result.status;
    case "problems":
      return "not-saved";
    case "not-found":
      return null;
  }
}

/**
 * The booking code for the notice: the save's own answer when it has one.
 * Only an input refusal ("problems") comes back without a code, since the
 * save refuses before it reads the booking; then the code the panel posted
 * is used. It only picks which card's notice to show: the board shows a
 * notice only for a code on that day, and prints that booking's own code.
 */
function codeOf(result: ChangeBookingStatusResult | AssignMechanicResult, formData: FormData): string | null {
  if ("code" in result) return result.code;
  return formText(formData, "code") || null;
}

/** The redirect back to the board: the bound view, checked again, plus the notice. */
function backToBoard(locale: Locale, bookingId: string, boardView: unknown, notice: BoardNotice | null, code: string | null): never {
  const params = new URLSearchParams(boardQuery(checkBoardView(boardView)));
  // parseBoardNotice is the board's own reader: only a known notice and a
  // well-formed code go in the address.
  const shown = notice && code ? parseBoardNotice(notice, code) : null;
  if (shown) {
    params.set("notice", shown.notice);
    params.set("code", shown.code);
  }
  const query = params.size > 0 ? `?${params}` : "";
  const fragment = isUuid(bookingId) ? `#booking-${bookingId}` : "";
  // "replace": Back then skips the post and returns to the page before it.
  return redirect({ href: `/admin/bookings${query}${fragment}`, locale }, RedirectType.replace);
}
