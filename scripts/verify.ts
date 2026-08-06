/**
 * Pre-deployment verification.
 *
 * Reports what is configured, what is missing and what would stop the server
 * from booting — without starting it. Exits non-zero when something would
 * genuinely break in the target environment, so it is safe to run in CI or as
 * a Railway pre-deploy step.
 *
 *   npm run verify
 */
import { PrismaClient } from '@prisma/client';

import { ALL_PRODUCTS } from '../src/lib/plans';

type Level = 'pass' | 'warn' | 'fail';

interface Check {
  name: string;
  level: Level;
  detail: string;
}

const results: Check[] = [];

function record(name: string, level: Level, detail: string) {
  results.push({ name, level, detail });
}

const ICON: Record<Level, string> = { pass: '✓', warn: '!', fail: '✗' };

function required(name: string, hint: string) {
  const value = process.env[name];
  if (value && value.trim().length > 0) {
    record(name, 'pass', 'set');
  } else {
    record(name, 'fail', `missing — ${hint}`);
  }
}

function optional(name: string, hint: string) {
  const value = process.env[name];
  if (value && value.trim().length > 0) {
    record(name, 'pass', 'set');
  } else {
    record(name, 'warn', `not set — ${hint}`);
  }
}

async function checkDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    record('database', 'fail', 'DATABASE_URL is not set, so no connection was attempted');
    return;
  }

  const prisma = new PrismaClient();
  try {
    const started = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - started;

    // A migrated database has the application tables; an empty one does not.
    const [{ count }] = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'User'
    `;

    if (Number(count) === 0) {
      record(
        'database',
        'fail',
        `reachable in ${latency}ms but not migrated — run npm run db:migrate`,
      );
    } else {
      const admins = await prisma.user.count({ where: { role: 'SUPER_ADMIN', deletedAt: null } });
      record('database', 'pass', `reachable in ${latency}ms, migrated, ${admins} super admin(s)`);
      if (admins === 0) {
        record('super admin', 'fail', 'no super admin exists — run npm run db:seed');
      } else {
        record('super admin', 'pass', `${admins} account(s) with SUPER_ADMIN`);
      }
    }
  } catch (error) {
    record(
      'database',
      'fail',
      `could not connect: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

function checkBilling() {
  const testMode = process.env.BILLING_TEST_MODE === 'true';
  const hasSecret = Boolean(process.env.STRIPE_SECRET_KEY);
  const isProduction = process.env.NODE_ENV === 'production';

  if (testMode) {
    const acknowledged = process.env.BILLING_TEST_MODE_ALLOW_PRODUCTION === 'true';
    if (isProduction && !acknowledged) {
      record(
        'billing',
        'fail',
        'BILLING_TEST_MODE=true in production. The server will refuse to start. Unset it, or set BILLING_TEST_MODE_ALLOW_PRODUCTION=true to accept that no real payments are taken.',
      );
    } else {
      record(
        'billing',
        'warn',
        'simulated — checkout is faked locally and no payment is taken. Fine for staging, never for a live storefront.',
      );
    }
    return;
  }

  if (!hasSecret) {
    record(
      'billing',
      'fail',
      'STRIPE_SECRET_KEY is missing and BILLING_TEST_MODE is off, so checkout cannot work',
    );
    return;
  }

  record(
    'billing',
    process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'pass' : 'warn',
    process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')
      ? 'live Stripe key configured'
      : 'test-mode Stripe key configured — real cards will be declined',
  );

  required('STRIPE_WEBHOOK_SECRET', 'webhook signatures cannot be verified without it');

  for (const product of ALL_PRODUCTS) {
    const value = process.env[product.envVar];
    if (value) {
      record(product.envVar, 'pass', `${product.name} → ${value}`);
    } else {
      record(product.envVar, 'fail', `${product.name} has no price ID — run npm run stripe:setup`);
    }
  }
}

function checkSafety() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_TEST_FIXTURE_HOST) {
    record(
      'ALLOW_TEST_FIXTURE_HOST',
      'fail',
      "set in production — it relaxes the crawler's SSRF protection and the server will refuse to start",
    );
  } else if (process.env.ALLOW_TEST_FIXTURE_HOST) {
    record(
      'ALLOW_TEST_FIXTURE_HOST',
      'warn',
      `set to ${process.env.ALLOW_TEST_FIXTURE_HOST} — fine outside production, but the server will refuse to start with it present when NODE_ENV=production`,
    );
  } else {
    record('ALLOW_TEST_FIXTURE_HOST', 'pass', 'not set');
  }

  const secret = process.env.AUTH_SECRET ?? '';
  if (secret.length >= 32) {
    record('AUTH_SECRET', 'pass', `${secret.length} characters`);
  } else if (secret.length > 0) {
    record('AUTH_SECRET', 'fail', `only ${secret.length} characters — use at least 32`);
  } else {
    record('AUTH_SECRET', 'fail', 'missing — sessions cannot be signed');
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  if (!appUrl) {
    record('NEXT_PUBLIC_APP_URL', 'fail', 'missing — Stripe redirects and canonical URLs need it');
  } else if (process.env.NODE_ENV === 'production' && !appUrl.startsWith('https://')) {
    record('NEXT_PUBLIC_APP_URL', 'fail', `must be https in production (got ${appUrl})`);
  } else {
    record('NEXT_PUBLIC_APP_URL', 'pass', appUrl);
  }
}

async function main() {
  console.log('\nRankInAI deployment verification\n');
  console.log(`  environment: ${process.env.NODE_ENV ?? 'development'}\n`);

  required('DATABASE_URL', 'the application cannot run without a database');
  checkSafety();
  await checkDatabase();
  checkBilling();

  optional('OPENAI_API_KEY', 'audits use deterministic templates instead of AI-written narrative');
  optional('SERPER_API_KEY', 'optional public-web search observations are disabled');
  optional('EMAIL_PROVIDER_API_KEY', 'transactional email falls back to the console provider');
  required('SUPER_ADMIN_EMAIL', 'the seed needs to know which account is the administrator');

  const width = Math.max(...results.map((r) => r.name.length));
  for (const result of results) {
    console.log(`  ${ICON[result.level]} ${result.name.padEnd(width)}  ${result.detail}`);
  }

  const failures = results.filter((r) => r.level === 'fail');
  const warnings = results.filter((r) => r.level === 'warn');

  console.log(
    `\n  ${results.length - failures.length - warnings.length} passed, ${warnings.length} warning(s), ${failures.length} blocking\n`,
  );

  if (failures.length > 0) {
    console.error('This environment is not ready to serve traffic.\n');
    process.exit(1);
  }
  console.log('Ready to deploy.\n');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
