import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for ReportStack E2E tests.
 *
 * Env vars:
 *   RS_FRONTEND_URL  Frontend base URL  (default http://localhost:3000)
 *   RS_API_URL       Backend base URL   (default http://localhost:8000/api/v1)
 *   RS_HEADLESS      "0" to run headed  (default headless)
 */

const FRONTEND_URL = process.env.RS_FRONTEND_URL || "http://localhost:3000";

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts$/,
  timeout: 30_000,
  expect: { timeout: 7_500 },
  fullyParallel: false, // tests share a single backend; run serially for now
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: FRONTEND_URL,
    headless: process.env.RS_HEADLESS !== "0",
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
