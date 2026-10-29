import { fireEvent, render, screen } from "@testing-library/react";
import { Activity } from "react";
import { describe, expect, test, vi } from "vitest";

import { type FormAction, FreshOnEachVisit, submitterWithFallback } from "./form-parts";

describe("FreshOnEachVisit", () => {
  const page = (mode: "visible" | "hidden") => (
    <Activity mode={mode}>
      <FreshOnEachVisit>
        <input aria-label="Draft" />
      </FreshOnEachVisit>
    </Activity>
  );

  test("keeps what was typed while the page is shown, and starts empty after it was hidden", () => {
    const { rerender } = render(page("visible"));
    fireEvent.change(screen.getByLabelText("Draft"), { target: { value: "half-typed" } });
    rerender(page("visible"));
    expect((screen.getByLabelText("Draft") as HTMLInputElement).value).toBe("half-typed");

    rerender(page("hidden"));
    rerender(page("visible"));
    expect((screen.getByLabelText("Draft") as HTMLInputElement).value).toBe("");
  });
});

describe("submitterWithFallback", () => {
  type State = { tries: number; error?: string };
  const whenFailed = (previous: State) => ({ tries: previous.tries + 1, error: "No connection" });

  test("returns the action's answer", async () => {
    const action = vi.fn<FormAction<State>>().mockResolvedValue({ tries: 1 });
    expect(await submitterWithFallback(action, whenFailed)({ tries: 0 }, new FormData())).toEqual({ tries: 1 });
  });

  test("passes a redirect on to Next.js instead of turning it into an error", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/account;303;" });
    const action = vi.fn<FormAction<State>>().mockRejectedValue(redirect);
    await expect(submitterWithFallback(action, whenFailed)({ tries: 0 }, new FormData())).rejects.toBe(redirect);
  });

  test("turns any other failure into the fallback state", async () => {
    const action = vi.fn<FormAction<State>>().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await submitterWithFallback(action, whenFailed)({ tries: 0 }, new FormData())).toEqual({
      tries: 1,
      error: "No connection",
    });
  });
});
