import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getEnv, resetEnvCache } from '@/lib/env';

/**
 * The degraded-configuration policy: production serves safely and says so,
 * never refuses. These tests exist because the opposite design — throwing on
 * imperfect configuration — shipped first and turned a single missing
 * variable into a completely dead deployment.
 */

const KEYS = [
  'NODE_ENV',
  'AUTH_SECRET',
  'AUTH_SECRET_EPHEMERAL',
  'BILLING_TEST_MODE',
  'BILLING_TEST_MODE_ALLOW_PRODUCTION',
  'ALLOW_TEST_FIXTURE_HOST',
  'NEXT_PUBLIC_APP_URL',
  'SUPER_ADMIN_EMAIL',
  'EMAIL_PROVIDER',
  'DATABASE_URL',
  'NEXT_PHASE',
  'STRIPE_SECRET_KEY',
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of KEYS) saved[key] = process.env[key];
  // A clean production runtime baseline for each test.
  Object.assign(process.env, { NODE_ENV: 'production' });
  process.env.DATABASE_URL = 'postgresql://u:p@127.0.0.1:5432/db';
  delete process.env.AUTH_SECRET;
  delete process.env.AUTH_SECRET_EPHEMERAL;
  delete process.env.BILLING_TEST_MODE;
  delete process.env.BILLING_TEST_MODE_ALLOW_PRODUCTION;
  delete process.env.ALLOW_TEST_FIXTURE_HOST;
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PHASE;
  delete process.env.STRIPE_SECRET_KEY;
  resetEnvCache();
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else Object.assign(process.env, { [key]: saved[key] });
  }
  resetEnvCache();
});

describe('production without AUTH_SECRET', () => {
  it('serves with an ephemeral secret instead of refusing', () => {
    const env = getEnv();
    expect(env.authSecretEphemeral).toBe(true);
    expect(env.authSecret.length).toBeGreaterThanOrEqual(32);
    expect(env.authSecret).not.toContain('development-only');
    // Written back so the edge middleware verifies the same tokens.
    expect(process.env.AUTH_SECRET).toBe(env.authSecret);
    expect(env.configWarnings.join(' ')).toMatch(/ephemeral/i);
  });

  it('treats the .env.example placeholder the same as missing', () => {
    process.env.AUTH_SECRET = 'replace-me-with-a-48-byte-random-string';
    const env = getEnv();
    expect(env.authSecretEphemeral).toBe(true);
    expect(env.authSecret).not.toContain('replace-me');
  });

  it('uses a configured secret verbatim, with no warning', () => {
    process.env.AUTH_SECRET = 'a-real-production-length-secret-value-abcdefghijklmnop';
    const env = getEnv();
    expect(env.authSecretEphemeral).toBe(false);
    expect(env.authSecret).toBe(process.env.AUTH_SECRET);
    expect(env.configWarnings.join(' ')).not.toMatch(/AUTH_SECRET/);
  });
});

describe('production with dangerous variables set', () => {
  it('forces billing test mode OFF without the explicit acknowledgement', () => {
    process.env.BILLING_TEST_MODE = 'true';
    const env = getEnv();
    expect(env.billingTestMode).toBe(false);
    expect(env.configWarnings.join(' ')).toMatch(/FORCED OFF/);
  });

  it('honors billing test mode when explicitly acknowledged', () => {
    process.env.BILLING_TEST_MODE = 'true';
    process.env.BILLING_TEST_MODE_ALLOW_PRODUCTION = 'true';
    const env = getEnv();
    expect(env.billingTestMode).toBe(true);
    expect(env.configWarnings.join(' ')).not.toMatch(/FORCED OFF/);
  });

  it('warns about the fixture bypass but keeps serving — url-safety ignores it anyway', () => {
    process.env.ALLOW_TEST_FIXTURE_HOST = '127.0.0.1:4321';
    const env = getEnv();
    expect(env.configWarnings.join(' ')).toMatch(/IGNORED in production/);
  });
});

describe('lenient parsing of recoverable fields', () => {
  it('adds https:// to a bare public-domain value', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'rankinai-production.up.railway.app';
    const env = getEnv();
    expect(env.NEXT_PUBLIC_APP_URL).toBe('https://rankinai-production.up.railway.app');
  });

  it('falls back to the default for a hopeless URL rather than failing the parse', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'not a url at all';
    const env = getEnv();
    expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
  });

  it('falls back to the default for an invalid admin email', () => {
    process.env.SUPER_ADMIN_EMAIL = 'not-an-email';
    const env = getEnv();
    expect(env.SUPER_ADMIN_EMAIL).toBe('admin@rankinai.com');
  });
});

describe('the one fatal case', () => {
  it('still refuses at runtime when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    expect(() => getEnv()).toThrow(/DATABASE_URL/);
  });

  it('but warns and continues during the build phase', () => {
    delete process.env.DATABASE_URL;
    process.env.NEXT_PHASE = 'phase-production-build';
    expect(() => getEnv()).not.toThrow();
  });
});
