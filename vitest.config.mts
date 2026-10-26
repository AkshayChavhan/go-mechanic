import { defineConfig } from "vitest/config";

// Unit tests live next to the code they test, under src/:
// - *.test.ts  -> "node" project:  plain logic (pricing, slots, validators...)
// - *.test.tsx -> "jsdom" project: React components, in a simulated browser
// Browser (end-to-end) tests live in e2e/ and run with Playwright instead.
export default defineConfig({
  // Understand the "@/..." import alias from tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
