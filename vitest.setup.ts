import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// We don't use Vitest's "globals" option, so Testing Library can't clean up
// rendered components by itself. Remove them after every test, so one test's
// output never leaks into the next.
afterEach(() => {
  cleanup();
});
