import { defineConfig } from "vitest/config";

// Unit tests live next to the code they test, under src/:
// - *.test.ts  -> "node" project:  plain logic (pricing, slots, validators...)
// - *.test.tsx -> "jsdom" project: React components, in a simulated browser
// Browser (end-to-end) tests live in e2e/ and run with Playwright instead.
//
// No @vitejs/plugin-react (which the Next.js Vitest guide uses): installing it
// failed with npm ERESOLVE (its optional peer chain wants Babel 8, shadcn uses
// Babel 7), and Vite 8 already compiles JSX using tsconfig's "jsx" setting.
export default defineConfig({
  // Understand the "@/..." import alias from tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    // A forgotten test.only would silently skip every other test: fail instead.
    allowOnly: false,
    // Run every test in UTC, like most servers. The owner's computer is set to
    // India time, which would hide a bug that reads the computer's own clock
    // instead of Asia/Kolkata. A test that needs another zone sets TZ itself.
    env: { TZ: "UTC" },
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
