import { describe, expect, test } from "vitest";

import { averageRating, checkReviewInput, firstName, REVIEW_RULES, type ReviewInput, toRating } from "./reviews";

const BOOKING = "11111111-2222-4333-8444-555555555555";
const TOKEN = "3f2b8c4e-1d2a-4b6c-9e8f-0a1b2c3d4e5f";

function input(overrides: Partial<ReviewInput> = {}): ReviewInput {
  return { bookingId: BOOKING, rating: "5", comment: "", requestToken: TOKEN, ...overrides };
}

describe("checkReviewInput", () => {
  test.each(["1", "2", "3", "4", "5", " 4 "])("rating %j passes", (rating) => {
    const result = checkReviewInput(input({ rating }));
    expect(result.ok && result.review.rating).toBe(Number(rating));
  });

  test.each([
    ["", "rating-missing"],
    ["0", "rating-invalid"],
    ["6", "rating-invalid"],
    ["4.5", "rating-invalid"],
    ["five", "rating-invalid"],
  ])("rating %j gives %s", (rating, problem) => {
    expect(checkReviewInput(input({ rating }))).toEqual({ ok: false, problems: [{ field: "rating", problem }] });
  });

  test("a blank comment is stars only (null); a comment is cleaned", () => {
    const blank = checkReviewInput(input({ comment: "  \n " }));
    expect(blank.ok && blank.review.comment).toBeNull();
    const typed = checkReviewInput(input({ comment: "  Great work \r\nThanks\u0000 " }));
    expect(typed.ok && typed.review.comment).toBe("Great work\nThanks");
  });

  test("the comment counts characters: 1,000 emoji pass, 1,001 characters are too long", () => {
    expect(checkReviewInput(input({ comment: "🚗".repeat(REVIEW_RULES.commentMaxLength) })).ok).toBe(true);
    expect(checkReviewInput(input({ comment: "x".repeat(REVIEW_RULES.commentMaxLength + 1) }))).toEqual({
      ok: false,
      problems: [{ field: "comment", problem: "comment-too-long" }],
    });
  });

  test.each([[{ bookingId: "1; drop" }], [{ requestToken: "" }]])("an id that isn't a uuid (%o) is a bad request", (overrides) => {
    expect(checkReviewInput(input(overrides))).toEqual({ ok: false, problems: [{ field: "form", problem: "bad-request" }] });
  });

  test("ids are lowercased; several problems come back together", () => {
    const ok = checkReviewInput(input({ bookingId: BOOKING.toUpperCase(), requestToken: TOKEN.toUpperCase() }));
    expect(ok.ok && ok.review).toMatchObject({ bookingId: BOOKING, requestToken: TOKEN });
    expect(checkReviewInput(input({ rating: "", comment: "x".repeat(1001), requestToken: "x" }))).toEqual({
      ok: false,
      problems: [
        { field: "rating", problem: "rating-missing" },
        { field: "comment", problem: "comment-too-long" },
        { field: "form", problem: "bad-request" },
      ],
    });
  });
});

describe("firstName", () => {
  test.each([
    ["Asha Patil", "Asha"],
    ["  Asha   Patil ", "Asha"],
    ["A. Patil", "A."],
    ["Ravi", "Ravi"],
    ["Mary-Jane O'Neil", "Mary-Jane"],
    ["आशा पाटील", "आशा"],
    ["", ""],
  ])("%j → %j", (name, expected) => {
    expect(firstName(name)).toBe(expected);
  });
});

describe("averageRating", () => {
  test("rounds to one decimal; none is null", () => {
    expect(averageRating(13, 3)).toBe(4.3);
    expect(averageRating(18, 4)).toBe(4.5);
    expect(averageRating(3, 1)).toBe(3);
    expect(averageRating(0, 0)).toBeNull();
  });

  test("toRating: 1 to 5 from a string or a number, else null", () => {
    expect(toRating("4")).toBe(4);
    expect(toRating(5)).toBe(5);
    expect(toRating(" 2 ")).toBe(2);
    for (const value of ["0", "6", "4.5", "", null, undefined]) expect(toRating(value)).toBeNull();
  });
});
