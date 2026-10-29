import { describe, expect, test } from "vitest";

import { effectiveRole } from "./roles";

const owner = "+919764750567";
const someoneElse = "+919876543210";

describe("effectiveRole (the role a user really has)", () => {
  test("the owner's number is the owner, whatever is stored", () => {
    expect(effectiveRole("customer", owner, owner)).toBe("owner");
    expect(effectiveRole("mechanic", owner, owner)).toBe("owner");
    expect(effectiveRole("owner", owner, owner)).toBe("owner");
  });

  test("a stored owner on any other number is a customer (the owner's number has moved)", () => {
    expect(effectiveRole("owner", someoneElse, owner)).toBe("customer");
  });

  test("any other stored role stands", () => {
    expect(effectiveRole("customer", someoneElse, owner)).toBe("customer");
    expect(effectiveRole("mechanic", someoneElse, owner)).toBe("mechanic");
    expect(effectiveRole("manager", someoneElse, owner)).toBe("manager");
  });
});
