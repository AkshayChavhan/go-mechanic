import { inspect } from "node:util";

import { notFound } from "next/navigation";
import { describe, expect, test } from "vitest";

import { redirect } from "@/i18n/navigation";

import {
  BookingServiceError,
  bookingWithoutDetails,
  kindOf,
  LoginServiceError,
  StaffServiceError,
  staffWithoutDetails,
  withoutDetails,
} from "./errors";

// A database error as Drizzle throws it: the message holds the query and its
// values, the cause holds Postgres's own error with its code.
function databaseError(): Error {
  const cause = Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
  return Object.assign(
    new Error("Failed query: insert into sessions ... params: tok_9f8e7d6c5b4a, +919876543210, 482913", { cause }),
    { name: "DrizzleQueryError" },
  );
}

/** What withoutDetails threw for `run`. */
async function thrownBy(run: () => Promise<unknown>): Promise<unknown> {
  return withoutDetails("someStep", run).then(
    () => "nothing thrown",
    (error: unknown) => error,
  );
}

describe("withoutDetails (errors from the login code, without their details)", () => {
  test("a database error becomes a LoginServiceError naming the step, the error's name and its Postgres code", async () => {
    const error = await thrownBy(async () => {
      throw databaseError();
    });
    expect(error).toBeInstanceOf(LoginServiceError);
    expect((error as Error).message).toBe("someStep failed (DrizzleQueryError 23505)");
  });

  test("nothing of the original survives: not in the message, the cause, or anywhere util.inspect looks", async () => {
    const error = await thrownBy(async () => {
      throw databaseError();
    });
    expect((error as Error).cause).toBeUndefined();
    expect(inspect(error, { depth: 10 })).not.toMatch(/tok_9f8e7d6c5b4a|9876543210|482913|Failed query/);
  });

  test("Next.js's own signals pass through unchanged: notFound() and a redirect", async () => {
    const missing = await thrownBy(async () => notFound());
    expect(missing).toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    const moved = await thrownBy(async () => redirect({ href: "/account", locale: "en" }));
    expect(moved).toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;/) });
  });

  test("a LoginServiceError from an inner step is passed on as it is", async () => {
    const inner = new LoginServiceError("inner", "Error");
    expect(
      await thrownBy(async () => {
        throw inner;
      }),
    ).toBe(inner);
  });

  test("returns the step's answer when nothing goes wrong", async () => {
    await expect(withoutDetails("someStep", async () => 42)).resolves.toBe(42);
  });
});

describe("bookingWithoutDetails (errors from the booking action, without their details)", () => {
  // A failed booking insert: its params hold the pickup address (task 24).
  function bookingInsertError(): Error {
    const cause = Object.assign(new Error("new row violates check constraint"), { code: "23514" });
    return Object.assign(
      new Error("Failed query: insert into bookings ... params: 12, MG Road, Chakan, 412101, +919876543210", { cause }),
      { name: "DrizzleQueryError" },
    );
  }

  test("a database error becomes a BookingServiceError with no message or cause from the original", async () => {
    const error = await bookingWithoutDetails("createMyBooking", async () => {
      throw bookingInsertError();
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BookingServiceError);
    expect((error as Error).message).toBe("createMyBooking failed (DrizzleQueryError 23514)");
    expect((error as Error).cause).toBeUndefined();
    expect(inspect(error, { depth: 10 })).not.toMatch(/MG Road|412101|9876543210|Failed query/);
  });

  test("Next.js's signals and errors already without details pass through unchanged", async () => {
    const moved = await bookingWithoutDetails("step", async () => redirect({ href: "/book", locale: "en" })).catch(
      (caught: unknown) => caught,
    );
    expect(moved).toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;/) });
    const login = new LoginServiceError("getCurrentUser", "Error");
    await expect(
      bookingWithoutDetails("step", async () => {
        throw login;
      }),
    ).rejects.toBe(login);
  });
});

describe("staffWithoutDetails (errors from the board's staff actions, without their details)", () => {
  // A failed status-change event insert: its params hold the cancel reason.
  function eventInsertError(): Error {
    const cause = Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
    return Object.assign(
      new Error("Failed query: insert into booking_events ... params: Customer called, sick at home, 3f2b8c4e", { cause }),
      { name: "DrizzleQueryError" },
    );
  }

  test("a database error becomes a StaffServiceError with no message or cause from the original", async () => {
    const error = await staffWithoutDetails("changeBookingStatus", async () => {
      throw eventInsertError();
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StaffServiceError);
    expect((error as Error).message).toBe("changeBookingStatus failed (DrizzleQueryError 23505)");
    expect((error as Error).cause).toBeUndefined();
    expect(inspect(error, { depth: 10 })).not.toMatch(/sick at home|3f2b8c4e|Failed query/);
  });

  test("Next.js's signals and errors already without details pass through unchanged", async () => {
    const moved = await staffWithoutDetails("step", async () => redirect({ href: "/admin", locale: "en" })).catch(
      (caught: unknown) => caught,
    );
    expect(moved).toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;/) });
    const login = new LoginServiceError("getCurrentUser", "Error");
    await expect(
      staffWithoutDetails("step", async () => {
        throw login;
      }),
    ).rejects.toBe(login);
  });

  test("returns the step's answer when nothing goes wrong", async () => {
    expect(await staffWithoutDetails("step", async () => 42)).toBe(42);
  });
});

describe("kindOf", () => {
  test.each([
    ["a database error", databaseError(), "DrizzleQueryError 23505"],
    ["a plain error", new TypeError("x"), "TypeError"],
    ["a code that isn't a Postgres code", Object.assign(new Error("x"), { code: "ECONNRESET" }), "Error"],
    ["something that isn't an Error", "a string", "string"],
  ])("%s", (_case, error, kind) => {
    expect(kindOf(error)).toBe(kind);
  });
});
