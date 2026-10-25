import { describe, expect, test } from "vitest";

import { cn } from "./utils";

describe("cn()", () => {
  test("a later Tailwind class wins over a conflicting earlier one", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  test("drops false, null and undefined", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });

  test("runs in the node environment (there is no browser document)", () => {
    expect(typeof document).toBe("undefined");
  });
});
