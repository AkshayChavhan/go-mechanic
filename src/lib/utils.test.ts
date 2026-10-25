import { describe, expect, test } from "vitest";

// Imported through the "@/" alias on purpose: this also tests that Vitest
// understands the alias (resolve.tsconfigPaths in vitest.config.mts).
import { cn } from "@/lib/utils";

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
