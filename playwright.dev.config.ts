import { defineConfig } from "@playwright/test";

// Browser checks for development-only pages such as /dev/design, which exist
// only under `next dev` (production builds answer them with a 404).
// Run with `npm run test:design`. `npm run test:e2e` (the production build,
// playwright.config.ts) skips e2e/dev/.
// - Uses the Google Chrome already installed on the machine. Never run
//   `npx playwright install`.
// - Reuses a dev server already running on port 3000. Next.js 16 locks the
//   dev folder, so a second `next dev` in the same checkout would just exit.
//   With no server running, it starts one and stops it afterwards.
// - The first visit compiles the page, which can take a while: long timeouts.
const PORT = 3000;

export default defineConfig({
  testDir: "./e2e/dev",
  // Screenshots and failure traces go here (git-ignored, like test-results/).
  outputDir: "./test-results/design",
  // A forgotten test.only would silently skip every other test: fail instead.
  forbidOnly: true,
  fullyParallel: true,
  // The dev server compiles on request; two workers keep it responsive.
  workers: 2,
  reporter: "list",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    navigationTimeout: 120_000,
  },
  webServer: {
    command: "npm run dev",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
