import { describe, expect, test } from "vitest";

import messages from "../../messages/en.json";

// Every leaf in a messages object, as "Namespace.key" -> value.
function leaves(value: unknown, path = ""): [string, unknown][] {
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      leaves(child, path ? `${path}.${key}` : key),
    );
  }
  return [[path, value]];
}

describe("messages/en.json", () => {
  test("has the namespaces the app uses", () => {
    expect(Object.keys(messages)).toEqual(
      expect.arrayContaining(["Metadata", "HomePage", "NotFound", "Common", "Contact", "Brand"]),
    );
  });

  test("every message is a non-empty string", () => {
    for (const [key, value] of leaves(messages)) {
      expect(typeof value, key).toBe("string");
      expect((value as string).trim(), key).not.toBe("");
    }
  });
});
