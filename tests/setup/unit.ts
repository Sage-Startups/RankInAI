/**
 * Unit-test environment.
 *
 * Deterministic values only — no real secrets, no database, no network.
 */
// NODE_ENV is typed readonly by @types/node; assign through the object.
Object.assign(process.env, { NODE_ENV: 'test' });
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET ?? 'unit-test-secret-value-that-is-long-enough-abcdefgh';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://rankinai:rankinai@127.0.0.1:5432/rankinai_test';
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
process.env.BILLING_TEST_MODE = 'true';
process.env.EMAIL_PROVIDER = 'console';
process.env.SEARCH_PROVIDER = 'none';

// The crawler fixture bypass is only ever enabled outside production.
process.env.ALLOW_TEST_FIXTURE_HOST = process.env.ALLOW_TEST_FIXTURE_HOST ?? '127.0.0.1:4321';
