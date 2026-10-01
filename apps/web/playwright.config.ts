import { defineConfig } from "@playwright/test";

/**
 * UI tests. They run against a dev server that is already up (pnpm web:dev, port 3000) or E2E_BASE_URL, in the
 * Chrome installed on this machine, so no browser download is needed. Run: pnpm --filter web test:ui
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // One browser at a time: under parallel load the server streams slowly and React sometimes reports a
  // recoverable hydration mismatch (#418) that it fixes itself. Known issue, tracked in docs/requests.md.
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "e2e/report", open: "never" }]],
  outputDir: "e2e/results",
  use: {
    // 3000 is in Privy's allowed domains; on a port that isn't, Privy logs a frame error on every page and the tests fail.
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    channel: process.env.E2E_CHANNEL ?? "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
