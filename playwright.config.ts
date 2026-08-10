import { existsSync } from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

import { E2E_BASE_URL, E2E_PORT, TEST_ENV, writeTestEnvFile } from './tests/test-env';

/**
 * End-to-end configuration.
 *
 * The app runs with NODE_ENV=test because the crawler fixture bypass
 * (ALLOW_TEST_FIXTURE_HOST) is deliberately refused when NODE_ENV=production —
 * that guard is a feature, so the tests work with it rather than around it.
 * The bypass names an exact origin, so only the fixture website is reachable,
 * not everything else listening on loopback.
 *
 * `global-setup.ts` starts the fixture website and the audit worker; the
 * `webServer` block below starts the application.
 */

/**
 * Some container images ship a Chromium build that does not match the exact
 * revision this Playwright version would download. Reuse it when present
 * rather than fetching a second copy.
 */
const CHROMIUM_CANDIDATES = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter((candidate): candidate is string => Boolean(candidate));

const PRESET_CHROMIUM = CHROMIUM_CANDIDATES.find((candidate) => existsSync(candidate));

const E2E_ENV = TEST_ENV;

// Must run before the web server starts; see tests/test-env.ts.
writeTestEnvFile();

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 90_000,
  expect: { timeout: 15_000 },

  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',

  use: {
    baseURL: E2E_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // The app under test is `next dev`, which compiles each route the first
    // time it is requested. On a loaded machine that first compile can take
    // tens of seconds, and it lands on whichever test happens to touch the
    // route first — so a tight action timeout produces failures that move
    // around between runs and look like product bugs. Assertions keep their
    // own 15s budget above; this only governs how long a request or an
    // interaction may wait on the server.
    actionTimeout: 45_000,
    navigationTimeout: 45_000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Prefer a Chromium already present in the environment. Falls back to
        // Playwright's own download when none is found, so this config works
        // both in CI images and on a developer machine.
        launchOptions: PRESET_CHROMIUM ? { executablePath: PRESET_CHROMIUM } : {},
      },
    },
  ],

  webServer: {
    command: `node ./node_modules/next/dist/bin/next dev -p ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/api/health`,
    // Never reuse: a server left over from another command would be running
    // with the developer's `.env` — and therefore the development database —
    // which produces failures that look like application bugs.
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { ...E2E_ENV },
  },
});

export { E2E_ENV, E2E_BASE_URL, E2E_PORT };
