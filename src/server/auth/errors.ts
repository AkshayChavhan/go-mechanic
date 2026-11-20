// Errors from the login and booking code, without their details.
//
// A database error's message holds the query's values: phone numbers, login
// codes, session tokens, a booking's pickup address (task 24). Next.js logs every error a Server Action or a page
// throws, so letting one through would write those values to the logs.
// withoutDetails runs a step and turns any unexpected error into a
// LoginServiceError that keeps only what helps debugging and names nobody:
// the step, the error's name and, for a database error, its Postgres code.
// bookingWithoutDetails does the same for the booking action (task 47),
// throwing a BookingServiceError, and staffWithoutDetails for the board's
// staff actions (task 27), throwing a StaffServiceError: a failed status
// change's event insert carries the cancel reason in its values.

import "server-only";

import { unstable_rethrow } from "next/navigation";

/** Thrown instead of an unexpected error: it names the step and the kind of error, nothing else. */
export class LoginServiceError extends Error {
  constructor(step: string, kind: string) {
    super(`${step} failed (${kind})`);
    this.name = "LoginServiceError";
  }
}

/** "DrizzleQueryError 23505": the error's name and, for a database error, its Postgres code. */
export function kindOf(error: unknown): string {
  if (!(error instanceof Error)) return typeof error;
  const pgCode = (error.cause as { code?: unknown } | undefined)?.code ?? (error as { code?: unknown }).code;
  return typeof pgCode === "string" && /^[0-9A-Z]{5}$/.test(pgCode) ? `${error.name} ${pgCode}` : error.name;
}

/**
 * Runs a step and turns any unexpected error into a LoginServiceError with
 * no message or cause from the original. Next.js's own signals (redirect(),
 * notFound(), a page pausing for request data) pass through first, unchanged.
 */
export async function withoutDetails<T>(step: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof LoginServiceError) throw error;
    throw new LoginServiceError(step, kindOf(error));
  }
}

/** The booking action's sibling of LoginServiceError: the step and the kind of error, nothing else. */
export class BookingServiceError extends Error {
  constructor(step: string, kind: string) {
    super(`${step} failed (${kind})`);
    this.name = "BookingServiceError";
  }
}

/**
 * withoutDetails for the booking action: any unexpected error becomes a
 * BookingServiceError. Next.js's signals pass through first; so does an error
 * that already carries no details (a LoginServiceError from the session read,
 * or a BookingServiceError from an inner step).
 */
export async function bookingWithoutDetails<T>(step: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof BookingServiceError || error instanceof LoginServiceError) throw error;
    throw new BookingServiceError(step, kindOf(error));
  }
}

/** The board actions' sibling of BookingServiceError (task 27): the step and the kind of error, nothing else. */
export class StaffServiceError extends Error {
  constructor(step: string, kind: string) {
    super(`${step} failed (${kind})`);
    this.name = "StaffServiceError";
  }
}

/**
 * withoutDetails for the staff board's actions: any unexpected error becomes
 * a StaffServiceError, so a cancel reason, a request token or a name in a
 * failed query's values never reaches the logs. Next.js's signals pass
 * through first; so does an error that already carries no details.
 */
export async function staffWithoutDetails<T>(step: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof StaffServiceError || error instanceof LoginServiceError) throw error;
    throw new StaffServiceError(step, kindOf(error));
  }
}
