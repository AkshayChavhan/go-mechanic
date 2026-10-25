import { defineConfig } from "@playwright/test";

// End-to-end tests: a real browser loads the real, built site.
// - Uses the Google Chrome already installed on the machine (channel "chrome"),
//   so no browsers are downloaded. Never run `npx playwright install`.
// - Builds and starts a production server on its own port, so a running
//   `npm run dev` (port 3000) is never tested by mistake.
const PORT = 3210;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
  },
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
