import { defineConfig } from "vitest/config";

// `npm run staging:race-test` only (task 20): the slot race on staging's real
// Postgres, src/server/dal/slots.postgres.test.ts. It needs
// STAGING_DATABASE_URL in .env.staging (document/operations/staging.md).
// `npm run check` never runs it: vitest.config.mts leaves *.postgres.test.ts out.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // As in vitest.config.mts: Next.js's empty stand-in for `server-only`.
    alias: { "server-only": "next/dist/compiled/server-only/empty.js" },
  },
  test: {
    allowOnly: false,
    env: { TZ: "UTC" },
    // As in vitest.config.mts: next-intl imports "next/navigation" without ".js".
    server: { deps: { inline: ["next-intl"] } },
    environment: "node",
    include: ["src/**/*.postgres.test.ts"],
    // One file, run once: never retried, never in parallel with anything.
    fileParallelism: false,
  },
});
