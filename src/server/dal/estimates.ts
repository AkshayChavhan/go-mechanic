// The garage's estimate for a booked job (task 33): staff with
// "estimates.manage" (manager, owner) build a draft of part and labour lines,
// send it, and start a new version to change it. Only this file writes the
// estimates and estimate_lines tables.
//
// Every write keeps one order (the plan's KTD5; the idempotent-save lesson in
// document/solutions/conventions/):
// 1. authorize("estimates.manage") on the first line, then the input check
//    and isUuid on every id (pure: the same answer on every retry);
// 2. reads that open their own connection (the services and real prices, and
//    the booking's vehicle copy, which never changes), before the transaction;
// 3. one transaction that locks the booking row (`for update`), so every
//    estimate write of one booking runs one after the other;
// 4. the caller's own token on this booking: "duplicate" with the first
//    answer, before "not-found" and every refusal (the first send itself may
//    have changed what they look at: a send moves the job and seals the draft);
// 5. "not-found": an estimate only counts when it belongs to the locked
//    booking, a line only when it belongs to that estimate;
// 6. the refusals; 7. the writes.
//
// Nothing here calls getDatabase() or a cached read inside a transaction
// (PGlite has one connection: CLAUDE.md "Booking slots").

import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, isNull, max } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { type BookingStatus, isActiveStatus } from "@/domain/bookings";
import {
  canEditEstimate,
  checkEstimateLineInput,
  ESTIMATE_RULES,
  type EstimateLineInput,
  type EstimateLineInputProblem,
  type EstimateLineKind,
  type EstimateTotals,
  estimateTotals,
} from "@/domain/estimates";
import { isUuid } from "@/domain/ids";
import { canSendEstimateFrom, type JobStatus } from "@/domain/jobs";
import { can } from "@/domain/permissions";
import { priceFor } from "@/domain/services";
import type { Fuel, VehicleKind } from "@/domain/vehicles";
import { localize, type LocalizedText } from "@/i18n/localized-text";
import { type Clock, systemClock } from "@/lib/clock";
import { authorize } from "@/server/auth/access";
import { getDatabase } from "@/server/db";
import { bookingEvents, bookings, estimateLines, estimates, users, vehicleMakes, vehicleModels } from "@/server/db/schema";

import { readServicePrices, readServices } from "./services";
import type { SlotTransaction } from "./slots";
import { lockBooking } from "./staff-booking-changes";

/** A refusal every write shares: the booking or its job is in a state that takes no estimate changes. */
type StateRefusal =
  /** The booking isn't booked or confirmed. */
  | "booking-closed"
  /** The job isn't at inspection, in service or awaiting approval. */
  | "wrong-step";

export type EstimateTokenProblem = { field: "token"; problem: "bad-token" };

// --- Start (or change) a version ---------------------------------------------

export type StartEstimateVersionInput = {
  bookingId: string;
  /** A random uuid per render of the Start or Change estimate form. */
  requestToken: string;
};

export type StartEstimateVersionResult =
  /** A new draft: version 1 empty, or the next version holding a copy of the current sent one's lines. */
  | { status: "started"; estimateId: string; version: number }
  /** The same form sent again: the version the first send started. */
  | { status: "duplicate"; estimateId: string; version: number }
  /** A draft is already open: the page opens that one instead. */
  | { status: "draft-exists"; estimateId: string; version: number }
  | { status: StateRefusal }
  | { status: "not-found" }
  | { status: "problems"; problems: EstimateTokenProblem[] };

/**
 * Starts the booking's next estimate version as a draft. With no version yet
 * it's version 1, empty ("Start estimate"). With a sent version it's the
 * next number, holding a copy of the current sent version's lines ("Change
 * estimate"): each copy keeps the kind, description, amount, needed and
 * service, points back with copied_from_line_id, and has no request token
 * (the version's create_token covers them all). The sent version stays the
 * current one until the new draft is sent.
 */
export async function startEstimateVersion(input: StartEstimateVersionInput): Promise<StartEstimateVersionResult> {
  const user = await authorize("estimates.manage");
  if (!isUuid(input.requestToken)) return { status: "problems", problems: [{ field: "token", problem: "bad-token" }] };
  // Postgres would throw on a malformed uuid (22P02): no such booking, without a query.
  if (!isUuid(input.bookingId)) return { status: "not-found" };
  const requestToken = input.requestToken.toLowerCase();

  const db = await getDatabase();
  return db.transaction(async (tx): Promise<StartEstimateVersionResult> => {
    const booking = await lockBooking(tx, input.bookingId);
    const [earlier] = await tx
      .select({ id: estimates.id, version: estimates.version })
      .from(estimates)
      .where(
        and(
          eq(estimates.bookingId, input.bookingId),
          eq(estimates.createdBy, user.id),
          eq(estimates.createToken, requestToken),
        ),
      );
    if (earlier) return { status: "duplicate", estimateId: earlier.id, version: earlier.version };
    if (!booking) return { status: "not-found" };

    const refusal = stateRefusal(booking.status, booking.jobStatus);
    if (refusal) return { status: refusal };

    const versions = await tx
      .select({ id: estimates.id, version: estimates.version, sentAt: estimates.sentAt, supersededAt: estimates.supersededAt })
      .from(estimates)
      .where(eq(estimates.bookingId, booking.id))
      .orderBy(desc(estimates.version));
    const draft = versions.find((row) => row.sentAt === null);
    if (draft) return { status: "draft-exists", estimateId: draft.id, version: draft.version };
    const current = versions.find((row) => row.sentAt !== null && row.supersededAt === null);
    // Under the booking lock, so two starts can't pick the same number.
    const version = (versions[0]?.version ?? 0) + 1;

    const [created] = await tx
      .insert(estimates)
      .values({ bookingId: booking.id, version, createdBy: user.id, createToken: requestToken })
      .returning({ id: estimates.id });
    if (current) {
      const lines = await tx
        .select()
        .from(estimateLines)
        .where(eq(estimateLines.estimateId, current.id))
        .orderBy(asc(estimateLines.position));
      if (lines.length > 0) {
        await tx.insert(estimateLines).values(
          lines.map((line) => ({
            estimateId: created!.id,
            position: line.position,
            kind: line.kind,
            description: line.description,
            amountPaise: line.amountPaise,
            needed: line.needed,
            serviceId: line.serviceId,
            copiedFromLineId: line.id,
            addedBy: user.id,
            requestToken: null,
          })),
        );
      }
    }
    return { status: "started", estimateId: created!.id, version };
  });
}

// --- Add a line ---------------------------------------------------------------

export type AddEstimateLineInput = EstimateLineInput & {
  bookingId: string;
  /** The draft's id, bound by the page. */
  estimateId: string;
  /** A random uuid per render of the add-line form. */
  requestToken: string;
};

export type AddEstimateLineProblem = EstimateLineInputProblem | EstimateTokenProblem;

export type AddEstimateLineResult =
  | { status: "added"; lineId: string }
  /** The same form sent again: the line the first send added. */
  | { status: "duplicate"; lineId: string }
  /** The version was sent: its lines never change. */
  | { status: "not-a-draft" }
  /** A line from a service with a blank amount, and no real price for this vehicle. */
  | { status: "no-price" }
  | { status: StateRefusal }
  | { status: "not-found" }
  | { status: "problems"; problems: AddEstimateLineProblem[] };

/**
 * Adds a line to a draft. A line from a service takes the service's English
 * name when its description is blank (cut to the line's limit), and the
 * service's real price for the booking's own vehicle copy when its amount is
 * blank (priceFor; never a sample price).
 *
 * A known gap: lines are deleted on remove, so an add retried after its line
 * was removed finds no token and adds the line again.
 */
export async function addEstimateLine(input: AddEstimateLineInput): Promise<AddEstimateLineResult> {
  const user = await authorize("estimates.manage");
  const checked = checkEstimateLineInput(input);
  const problems: AddEstimateLineProblem[] = checked.ok ? [] : [...checked.problems];
  if (!isUuid(input.requestToken)) problems.push({ field: "token", problem: "bad-token" });
  if (!checked.ok || problems.length > 0) return { status: "problems", problems };
  if (!isUuid(input.bookingId) || !isUuid(input.estimateId)) return { status: "not-found" };
  const requestToken = input.requestToken.toLowerCase();
  const line = checked.line;

  const db = await getDatabase();
  // Before the transaction: the service fill. Its refusal is returned inside,
  // after the duplicate check (a service hidden since the first send must not
  // turn a retry into a refusal).
  let description = line.description;
  let amountPaise = line.amountPaise;
  let fillRefusal: "unknown-service" | "no-price" | null = null;
  if (line.serviceId !== null) {
    const [vehicle] = await db
      .select({ kind: bookings.vehicleKind, categoryId: bookings.categoryId, fuel: bookings.fuel })
      .from(bookings)
      .where(eq(bookings.id, input.bookingId));
    // Bookings are never deleted, so a missing one has no earlier line either.
    if (!vehicle) return { status: "not-found" };
    const service = (await readServices()).find((row) => row.id === line.serviceId);
    if (!service) fillRefusal = "unknown-service";
    else {
      description ??= serviceDescription(service.name);
      if (amountPaise === null) {
        const price = priceFor(service, await readServicePrices(), vehicle);
        if (price.status === "price") amountPaise = price.paise;
        else fillRefusal = "no-price";
      }
    }
  }

  return db.transaction(async (tx): Promise<AddEstimateLineResult> => {
    const booking = await lockBooking(tx, input.bookingId);
    const [earlier] = await tx
      .select({ id: estimateLines.id })
      .from(estimateLines)
      .innerJoin(estimates, eq(estimateLines.estimateId, estimates.id))
      .where(
        and(
          eq(estimates.bookingId, input.bookingId),
          eq(estimateLines.addedBy, user.id),
          eq(estimateLines.requestToken, requestToken),
        ),
      );
    if (earlier) return { status: "duplicate", lineId: earlier.id };
    if (!booking) return { status: "not-found" };
    const estimate = await estimateOfBooking(tx, input.estimateId, booking.id);
    if (!estimate) return { status: "not-found" };

    const refusal = stateRefusal(booking.status, booking.jobStatus);
    if (refusal) return { status: refusal };
    if (estimate.sentAt !== null) return { status: "not-a-draft" };
    // The page lists only listed services: an unknown one is a hand-made post.
    if (fillRefusal === "unknown-service") return { status: "problems", problems: [{ field: "form", problem: "bad-request" }] };
    if (fillRefusal === "no-price" || description === null || amountPaise === null) return { status: "no-price" };

    const [last] = await tx
      .select({ position: max(estimateLines.position) })
      .from(estimateLines)
      .where(eq(estimateLines.estimateId, estimate.id));
    const [added] = await tx
      .insert(estimateLines)
      .values({
        estimateId: estimate.id,
        position: (last?.position ?? -1) + 1,
        kind: line.kind,
        description,
        amountPaise,
        needed: line.needed,
        serviceId: line.serviceId,
        addedBy: user.id,
        requestToken,
      })
      .returning({ id: estimateLines.id });
    await bumpRevision(tx, estimate.id, estimate.revision);
    return { status: "added", lineId: added!.id };
  });
}

// --- Remove a line ----------------------------------------------------------

export type RemoveEstimateLineInput = {
  bookingId: string;
  estimateId: string;
  lineId: string;
};

export type RemoveEstimateLineResult =
  /** The line is gone from this version: removed now, or already gone (a retry). */
  | { status: "removed" }
  /** The line is still there, on a version that was sent. */
  | { status: "not-a-draft" }
  | { status: StateRefusal }
  | { status: "not-found" };

/**
 * Removes a line from a draft. No token is needed: a line already gone from
 * the named version answers "removed" whatever that version's state, so a
 * double tap, or a retry after the version was sent, gets the first answer.
 */
export async function removeEstimateLine(input: RemoveEstimateLineInput): Promise<RemoveEstimateLineResult> {
  await authorize("estimates.manage");
  if (!isUuid(input.bookingId) || !isUuid(input.estimateId)) return { status: "not-found" };
  // A malformed line id can't be on the version: already gone.
  if (!isUuid(input.lineId)) return { status: "removed" };

  const db = await getDatabase();
  return db.transaction(async (tx): Promise<RemoveEstimateLineResult> => {
    const booking = await lockBooking(tx, input.bookingId);
    if (!booking) return { status: "not-found" };
    const estimate = await estimateOfBooking(tx, input.estimateId, booking.id);
    if (!estimate) return { status: "not-found" };
    const [line] = await tx
      .select({ id: estimateLines.id })
      .from(estimateLines)
      .where(and(eq(estimateLines.id, input.lineId), eq(estimateLines.estimateId, estimate.id)));
    // Before the refusals: a line that's gone stays "removed" after a send.
    if (!line) return { status: "removed" };

    const refusal = stateRefusal(booking.status, booking.jobStatus);
    if (refusal) return { status: refusal };
    if (estimate.sentAt !== null) return { status: "not-a-draft" };

    await tx.delete(estimateLines).where(eq(estimateLines.id, line.id));
    await bumpRevision(tx, estimate.id, estimate.revision);
    return { status: "removed" };
  });
}

// --- Send -------------------------------------------------------------------

export type SendEstimateInput = {
  bookingId: string;
  estimateId: string;
  /** The draft's revision the page showed, as the form posts it. */
  revision: string;
  /** A random uuid per render of the send form. */
  requestToken: string;
};

export type SendEstimateProblem = EstimateTokenProblem | { field: "revision"; problem: "bad-revision" };

export type SendEstimateResult =
  /** `moved`: the job went to awaiting approval (false when it was already there). */
  | { status: "sent"; estimateId: string; version: number; moved: boolean }
  /** The same form sent again: the first send's answer. */
  | { status: "duplicate"; estimateId: string; version: number; moved: boolean }
  | { status: "not-a-draft" }
  /** Someone added or removed a line since the page was shown: nothing sent. */
  | { status: "estimate-changed" }
  | { status: "no-lines" }
  | { status: StateRefusal }
  | { status: "not-found" }
  | { status: "problems"; problems: SendEstimateProblem[] };

/**
 * Sends a draft. From then on its lines never change. The earlier current
 * version (if any) is marked superseded first, then the draft is marked
 * sent: the partial unique index allows one current version per booking, and
 * Postgres checks it after each statement. A job at inspection or in service
 * moves to awaiting approval, with one job-update event carrying the send's
 * token; a job already awaiting approval moves nothing and gets no event.
 */
export async function sendEstimate(input: SendEstimateInput, clock: Clock = systemClock): Promise<SendEstimateResult> {
  const user = await authorize("estimates.manage");
  const problems: SendEstimateProblem[] = [];
  if (!isUuid(input.requestToken)) problems.push({ field: "token", problem: "bad-token" });
  const revisionText = input.revision.trim();
  const revision = /^\d{1,9}$/.test(revisionText) ? Number(revisionText) : null;
  if (revision === null) problems.push({ field: "revision", problem: "bad-revision" });
  if (problems.length > 0 || revision === null) return { status: "problems", problems };
  if (!isUuid(input.bookingId) || !isUuid(input.estimateId)) return { status: "not-found" };
  const requestToken = input.requestToken.toLowerCase();

  const db = await getDatabase();
  return db.transaction(async (tx): Promise<SendEstimateResult> => {
    const booking = await lockBooking(tx, input.bookingId);
    const [earlier] = await tx
      .select({ id: estimates.id, version: estimates.version })
      .from(estimates)
      .where(
        and(eq(estimates.bookingId, input.bookingId), eq(estimates.sentBy, user.id), eq(estimates.sendToken, requestToken)),
      );
    if (earlier) {
      // The first send moved the job if it wrote its event.
      const [moveEvent] = await tx
        .select({ id: bookingEvents.id })
        .from(bookingEvents)
        .where(
          and(
            eq(bookingEvents.bookingId, input.bookingId),
            eq(bookingEvents.actorUserId, user.id),
            eq(bookingEvents.requestToken, requestToken),
          ),
        );
      return { status: "duplicate", estimateId: earlier.id, version: earlier.version, moved: moveEvent !== undefined };
    }
    if (!booking) return { status: "not-found" };
    const estimate = await estimateOfBooking(tx, input.estimateId, booking.id);
    if (!estimate) return { status: "not-found" };

    const refusal = stateRefusal(booking.status, booking.jobStatus);
    if (refusal) return { status: refusal };
    if (estimate.sentAt !== null) return { status: "not-a-draft" };
    if (estimate.revision !== revision) return { status: "estimate-changed" };
    const [anyLine] = await tx
      .select({ id: estimateLines.id })
      .from(estimateLines)
      .where(eq(estimateLines.estimateId, estimate.id))
      .limit(1);
    if (!anyLine) return { status: "no-lines" };

    const now = clock.now();
    // Superseded first, then sent: never two current versions, even for one statement.
    await tx
      .update(estimates)
      .set({ supersededAt: now })
      .where(and(eq(estimates.bookingId, booking.id), isNotNull(estimates.sentAt), isNull(estimates.supersededAt)));
    await tx
      .update(estimates)
      .set({ sentAt: now, sentBy: user.id, sendToken: requestToken })
      .where(eq(estimates.id, estimate.id));

    const moved = canSendEstimateFrom(booking.jobStatus);
    if (moved) {
      await tx.update(bookings).set({ jobStatus: "awaiting-approval" }).where(eq(bookings.id, booking.id));
      // "Jobs": every move of job_status writes one job-update event.
      await tx.insert(bookingEvents).values({
        bookingId: booking.id,
        kind: "job-update",
        actorUserId: user.id,
        jobStatus: "awaiting-approval",
        requestToken,
        createdAt: now,
      });
    }
    // Task 35: queue the customer's message here, in this transaction.
    return { status: "sent", estimateId: estimate.id, version: estimate.version, moved };
  });
}

// --- Read ---------------------------------------------------------------------

export type EstimateLineView = {
  id: string;
  kind: EstimateLineKind;
  description: string;
  amountPaise: number;
  needed: boolean;
  serviceId: string | null;
  /** The line of the earlier version it was copied from by Change estimate; null for a line added here. */
  copiedFromLineId: string | null;
};

export type EstimateVersionView = {
  id: string;
  version: number;
  state: "draft" | "sent" | "superseded";
  /** Post it back with Send, so a list changed since is never sent. */
  revision: number;
  createdAt: Date;
  sentAt: Date | null;
  /** Who sent it, by name only; null for a draft. */
  sentBy: { id: string; name: string } | null;
  supersededAt: Date | null;
  /** Needed lines first, each group in the order they were added. */
  lines: EstimateLineView[];
  totals: EstimateTotals;
};

export type StaffEstimateView = {
  bookingId: string;
  /** As stored, without the dash: show it with formatBookingCode. */
  code: string;
  startsAt: Date;
  status: BookingStatus;
  /** The job's step; null while not started. */
  jobStatus: JobStatus | null;
  vehicle: {
    kind: VehicleKind;
    makeName: LocalizedText;
    modelName: LocalizedText;
    fuel: Fuel;
    /** The compact form ("MH12AB0042"): show it with formatRegistration. */
    registrationNumber: string;
  };
  customerName: string;
  /** Only for staff with "customers.contact"; null for anyone else. */
  phoneNumber: string | null;
  /** Newest version first. */
  versions: EstimateVersionView[];
  /** Whether lines may be added, removed and sent (canEditEstimate). */
  canEdit: boolean;
};

const senders = alias(users, "senders");

/**
 * A booking with every version of its estimate, for staff with
 * "estimates.manage". Null for a missing booking (or a malformed id).
 * Live, never cached: two staff may be editing the same draft.
 */
export async function readEstimateForStaff(bookingId: string): Promise<StaffEstimateView | null> {
  const user = await authorize("estimates.manage");
  if (!isUuid(bookingId)) return null;
  const showContact = can(user.role, "customers.contact");

  const db = await getDatabase();
  // The model and brand joins ignore `listed`: a hidden model keeps its name here.
  const [booking] = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      startsAt: bookings.startsAt,
      status: bookings.status,
      jobStatus: bookings.jobStatus,
      kind: bookings.vehicleKind,
      makeName: vehicleMakes.name,
      modelName: vehicleModels.name,
      fuel: bookings.fuel,
      registrationNumber: bookings.registrationNumber,
      customerName: users.name,
      phoneNumber: users.phoneNumber,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .innerJoin(vehicleModels, eq(bookings.modelId, vehicleModels.id))
    .innerJoin(vehicleMakes, eq(vehicleModels.makeId, vehicleMakes.id))
    .where(eq(bookings.id, bookingId));
  if (!booking) return null;

  const versionRows = await db
    .select({
      id: estimates.id,
      version: estimates.version,
      revision: estimates.revision,
      createdAt: estimates.createdAt,
      sentAt: estimates.sentAt,
      senderId: senders.id,
      senderName: senders.name,
      supersededAt: estimates.supersededAt,
    })
    .from(estimates)
    .leftJoin(senders, eq(estimates.sentBy, senders.id))
    .where(eq(estimates.bookingId, booking.id))
    .orderBy(desc(estimates.version));
  const lineRows =
    versionRows.length === 0
      ? []
      : await db
          .select()
          .from(estimateLines)
          .where(
            inArray(
              estimateLines.estimateId,
              versionRows.map((row) => row.id),
            ),
          )
          .orderBy(desc(estimateLines.needed), asc(estimateLines.position));

  return {
    bookingId: booking.id,
    code: booking.code,
    startsAt: booking.startsAt,
    status: booking.status,
    jobStatus: booking.jobStatus,
    vehicle: {
      kind: booking.kind,
      makeName: booking.makeName,
      modelName: booking.modelName,
      fuel: booking.fuel,
      registrationNumber: booking.registrationNumber,
    },
    customerName: booking.customerName,
    phoneNumber: showContact ? booking.phoneNumber : null,
    versions: versionRows.map((row) => {
      const lines: EstimateLineView[] = lineRows
        .filter((line) => line.estimateId === row.id)
        .map((line) => ({
          id: line.id,
          kind: line.kind,
          description: line.description,
          amountPaise: line.amountPaise,
          needed: line.needed,
          serviceId: line.serviceId,
          copiedFromLineId: line.copiedFromLineId,
        }));
      return {
        id: row.id,
        version: row.version,
        state: row.sentAt === null ? "draft" : row.supersededAt === null ? "sent" : "superseded",
        revision: row.revision,
        createdAt: row.createdAt,
        sentAt: row.sentAt,
        sentBy: row.senderId !== null && row.senderName !== null ? { id: row.senderId, name: row.senderName } : null,
        supersededAt: row.supersededAt,
        lines,
        totals: estimateTotals(lines),
      };
    }),
    canEdit: canEditEstimate(booking.status, booking.jobStatus),
  };
}

// --- Helpers ------------------------------------------------------------------

/** Why this booking's estimate can't change now, or null when it can. */
function stateRefusal(status: BookingStatus, jobStatus: JobStatus | null): StateRefusal | null {
  if (!isActiveStatus(status)) return "booking-closed";
  if (!canEditEstimate(status, jobStatus)) return "wrong-step";
  return null;
}

/** The estimate with this id, only if it belongs to this booking. */
async function estimateOfBooking(tx: SlotTransaction, estimateId: string, bookingId: string) {
  const [row] = await tx
    .select({ id: estimates.id, version: estimates.version, revision: estimates.revision, sentAt: estimates.sentAt })
    .from(estimates)
    .where(and(eq(estimates.id, estimateId), eq(estimates.bookingId, bookingId)));
  return row;
}

/** One more line change on this draft (read under the booking lock). */
async function bumpRevision(tx: SlotTransaction, estimateId: string, revision: number) {
  await tx.update(estimates).set({ revision: revision + 1 }).where(eq(estimates.id, estimateId));
}

/** A service's English name as a line's description, cut to the line's limit (counted in code points). */
function serviceDescription(name: LocalizedText): string {
  const text = localize(name, "en").trim();
  const chars = Array.from(text);
  return chars.length <= ESTIMATE_RULES.descriptionMaxLength
    ? text
    : chars.slice(0, ESTIMATE_RULES.descriptionMaxLength).join("").trimEnd();
}
