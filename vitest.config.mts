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
  resolve: {
    // Understand the "@/..." import alias from tsconfig.json.
    tsconfigPaths: true,
    // Server code starts with `import "server-only"`. We don't install that
    // package: Next.js points it at an empty file for server code (and at one
    // that throws for browser code; create-compiler-aliases.js). Tests run on
    // the server side, so they get the same empty file.
    alias: { "server-only": "next/dist/compiled/server-only/empty.js" },
  },
  test: {
    // A forgotten test.only would silently skip every other test: fail instead.
    allowOnly: false,
    // Run every test in UTC, like most servers. The owner's computer is set to
    // India time, which would hide a bug that reads the computer's own clock
    // instead of Asia/Kolkata. A test that needs another zone sets TZ itself.
    env: { TZ: "UTC" },
    // Let Vite load next-intl instead of Node. next-intl's Link imports
    // "next/navigation" with no ".js" at the end; Node refuses that (the next
    // package doesn't list its files in an "exports" map), so any test that
    // rendered a Link from @/i18n/navigation failed with "Cannot find module".
    server: { deps: { inline: ["next-intl"] } },
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
