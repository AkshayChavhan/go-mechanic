import { defineConfig } from "@playwright/test";

import { OUTBOX_FILE } from "./e2e/helpers";

// End-to-end tests: a real browser loads the real, built site.
// - Uses the Google Chrome already installed on the machine (channel "chrome"),
//   so no browsers are downloaded. Never run `npx playwright install`.
// - Builds and starts a production server on its own port, so a running
//   `npm run dev` (port 3000) is never tested by mistake.
const PORT = 3210;

export default defineConfig({
  testDir: "./e2e",
  // Development-only pages are tested against `next dev` instead
  // (playwright.dev.config.ts, npm run test:design).
  testIgnore: "**/e2e/dev/**",
  // A forgotten test.only would silently skip every other test: fail instead.
  forbidOnly: true,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    // The browser runs in UTC, like a visitor abroad, not in this computer's
    // India time, which would hide a bug that reads the device's own time
    // zone. Tests that need another zone set timezoneId themselves.
    timezoneId: "UTC",
  },
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    // The fake SMS provider also writes each message here, so the login
    // tests can read their codes (e2e/helpers.ts, latestCodeFor). Added to
    // this process's own environment, not instead of it.
    env: { E2E_OUTBOX_FILE: OUTBOX_FILE },
  },
});
