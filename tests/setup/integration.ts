import { config } from 'dotenv';

import { writeTestEnvFile } from '../test-env';

/**
 * Integration-test environment.
 *
 * `.env.test` is regenerated first so a fresh clone works with no manual setup
 * and so this run and the E2E suite always agree on the settings. It points
 * DATABASE_URL at the dedicated `rankinai_test` database. Tests clean up after
 * themselves rather than truncating everything, so a developer's seeded demo
 * data survives a test run.
 */
writeTestEnvFile();
config({ path: '.env.test', override: true });

Object.assign(process.env, { NODE_ENV: 'test' });
process.env.BILLING_TEST_MODE = 'true';
process.env.EMAIL_PROVIDER = 'console';
process.env.SEARCH_PROVIDER = 'none';
process.env.ALLOW_TEST_FIXTURE_HOST = process.env.ALLOW_TEST_FIXTURE_HOST ?? '127.0.0.1:4321';
process.env.CRAWL_DELAY_MS = '0';

if (!process.env.DATABASE_URL?.includes('test')) {
  throw new Error(
    `Refusing to run integration tests against a non-test database (${process.env.DATABASE_URL ?? 'unset'}). Set DATABASE_URL in .env.test to a database whose name contains "test".`,
  );
}
