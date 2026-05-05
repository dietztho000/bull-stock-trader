import { defineConfig, devices } from "playwright/test";

/** End-to-end smoke tests for the dashboard.
 *
 *  Scope: assert that key pages render without server errors and that the
 *  major user-visible interactions wired up during the audit (journal
 *  drill-down popover, empty states, mascot mount) actually work in a real
 *  browser. Not exhaustive — catches CSS / hydration / Server Component
 *  regressions that vitest unit tests can't see.
 *
 *  Run locally:
 *    pnpm test:e2e
 *
 *  Playwright auto-starts the Next.js production server on port 3334 (kept
 *  off the dev-server's default 3000 so a `next dev` instance can keep
 *  running alongside). The server picks up the repo's actual `memory/`
 *  tree by default — empty states are exercised by pointing
 *  PORT_TEST_EMPTY_MEMORY=1 at a tmp dir if you want those covered.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "list" : "list",
  use: {
    baseURL: "http://127.0.0.1:3334",
    trace: "on-first-retry",
    // Match dashboard CT timezone so any time-sensitive UI renders the way
    // a CT user would see it.
    timezoneId: "America/Chicago",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start -- -p 3334",
    url: "http://127.0.0.1:3334",
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
  },
});
