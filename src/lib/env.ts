import { z } from 'zod';

/**
 * Centralized, validated environment access.
 *
 * Policy: serve safely and say so, never refuse. In production:
 *  - a missing/weak AUTH_SECRET falls back to an ephemeral random secret
 *    (sessions reset on every restart until a real one is set)
 *  - the crawler test-fixture bypass is IGNORED (url-safety enforces this
 *    independently of anything decided here)
 *  - billing test mode is FORCED OFF unless explicitly acknowledged
 * Every degraded state is logged and listed in `configWarnings`, which
 * /api/health and the admin area surface. Only a missing DATABASE_URL is
 * fatal at runtime — nothing works without it.
 *
 * Only server code may import this module.
 */

const booleanish = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => {
    if (typeof v === 'boolean') return v;
    if (!v) return false;
    return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
  });

const intFromString = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return fallback;
      const n = Number.parseInt(v, 10);
      return Number.isFinite(n) && n > 0 ? n : fallback;
    });

/**
 * A URL that forgives the most common operator mistake: pasting a bare domain
 * without a scheme. `rankinai.up.railway.app` becomes `https://…`; anything
 * still unparseable falls back to the default rather than failing the whole
 * environment — a wrong public URL mis-addresses Stripe redirects, which is
 * recoverable, while a failed parse used to take down every route.
 */
const lenientUrl = (fallback: string) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }, z.string().url().catch(fallback).default(fallback));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  AUTH_SECRET: z.string().optional(),
  AUTH_TRUST_HOST: booleanish,
  NEXT_PUBLIC_APP_URL: lenientUrl('http://localhost:3000'),

  // `.catch` on the forgiving fields below: a malformed optional value must
  // degrade to its default, not fail the parse and 500 every request. Only
  // DATABASE_URL stays strict — nothing works without it.
  SUPER_ADMIN_EMAIL: z.string().email().catch('admin@rankinai.com').default('admin@rankinai.com'),
  SUPER_ADMIN_SEED_PASSWORD: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ONE_TIME_AUDIT: z.string().optional(),
  STRIPE_PRICE_STARTER_MONTHLY: z.string().optional(),
  STRIPE_PRICE_GROWTH_MONTHLY: z.string().optional(),
  STRIPE_PRICE_AGENCY_MONTHLY: z.string().optional(),
  BILLING_TEST_MODE: booleanish,
  BILLING_TEST_MODE_ALLOW_PRODUCTION: booleanish,

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4.1-mini'),
  OPENAI_BASE_URL: lenientUrl('https://api.openai.com/v1'),

  SEARCH_PROVIDER: z.enum(['none', 'serper']).catch('none').default('none'),
  SERPER_API_KEY: z.string().optional(),

  EMAIL_PROVIDER: z.enum(['console', 'resend']).catch('console').default('console'),
  EMAIL_FROM: z.string().default('RankInAI <no-reply@rankinai.com>'),
  EMAIL_PROVIDER_API_KEY: z.string().optional(),
  SUPPORT_EMAIL: z.string().default('support@rankinai.com'),

  CRON_SECRET: z.string().optional(),
  AUDIT_WORKER_SECRET: z.string().optional(),
  WORKER_POLL_INTERVAL_MS: intFromString(4000),
  WORKER_CONCURRENCY: intFromString(1),
  WORKER_ID: z.string().optional(),

  CRAWL_TIMEOUT_MS: intFromString(15000),
  CRAWL_MAX_BYTES: intFromString(3_000_000),
  CRAWL_MAX_REDIRECTS: intFromString(5),
  CRAWL_DELAY_MS: intFromString(400),
  CRAWL_USER_AGENT: z.string().default('RankInAI-Auditor/1.0 (+https://rankinai.com/crawler)'),

  ALLOW_TEST_FIXTURE_HOST: z.string().optional(),
  TEST_FIXTURE_ORIGIN: z.string().optional(),

  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
  NEXT_PUBLIC_ANALYTICS_ENABLED: booleanish,
});

export type AppEnv = z.infer<typeof schema> & {
  isProduction: boolean;
  isTest: boolean;
  isDevelopment: boolean;
  billingTestMode: boolean;
  llmEnabled: boolean;
  searchEnabled: boolean;
  stripeConfigured: boolean;
  authSecret: string;
  /** True when the secret was generated at boot because none was configured. */
  authSecretEphemeral: boolean;
  /** Degraded-configuration notices, surfaced by /api/health and the admin area. */
  configWarnings: string[];
};

let cached: AppEnv | null = null;

function build(): AppEnv {
  // `next build` runs with NODE_ENV=production but compiles an artifact rather
  // than serving a request, so the production guards here are scoped to
  // runtime: a build warns, a running server refuses. Otherwise a perfectly
  // valid build fails on a variable that is only needed to serve traffic —
  // which on any platform that builds and runs in separate steps (Vercel,
  // Railway, a Docker CI job) is a deployment failure with a misleading cause.
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

  // Checked before parsing, because a missing DATABASE_URL fails the schema
  // itself and would never reach the guards below.
  const source: NodeJS.ProcessEnv = { ...process.env };
  if (isBuildPhase && !source.DATABASE_URL) {
    console.warn(
      '[rankinai] WARNING: DATABASE_URL is not set during a production build.\n[rankinai] The build will continue, but the deployed server will refuse every request until this is fixed.',
    );
    source.DATABASE_URL = 'postgresql://build-phase-placeholder:0/none';
  }

  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  const raw = parsed.data;
  const isProduction = raw.NODE_ENV === 'production';
  const isTest = raw.NODE_ENV === 'test';

  /**
   * Degraded-configuration policy: serve safely and say so, never refuse.
   *
   * Earlier versions threw here in production, which turned every request —
   * including the platform health check — into a 500. In practice that
   * converts a missing variable into a completely dead deployment whose
   * diagnosis depends on someone reading the right log at the right moment.
   * Every case below has a safe degraded behavior, so the correct move is to
   * take it, warn loudly, and surface the state in /api/health and the admin
   * area. Nothing here is silent, and nothing here weakens security:
   * the fixture bypass is ignored, simulated billing is forced off, and a
   * missing secret becomes a cryptographically random one.
   */
  const configWarnings: string[] = [];
  const warn = (message: string) => {
    configWarnings.push(message);
    console.warn(`[rankinai] WARNING: ${message}`);
  };

  // AUTH_SECRET: required for durable sessions. When absent or invalid in
  // production, fall back to a cryptographically random per-process secret:
  // tokens cannot be forged, sign-in works, but every restart or deploy signs
  // everyone out until a real value is configured. The generated value is
  // written back to process.env so the edge middleware — which reads
  // process.env.AUTH_SECRET directly — verifies the same tokens Auth.js signs.
  let authSecret = raw.AUTH_SECRET ?? '';
  let authSecretEphemeral = process.env.AUTH_SECRET_EPHEMERAL === '1';
  if (isProduction) {
    const tooShort = !authSecret || authSecret.length < 32;
    const isPlaceholder = authSecret.startsWith('replace-me');
    if (tooShort || isPlaceholder) {
      if (isBuildPhase) {
        // Nothing is served during a build; a marked placeholder is enough.
        authSecret = 'rankinai-build-phase-placeholder-never-used-to-sign-anything';
        console.warn(
          '[rankinai] WARNING: AUTH_SECRET is missing or invalid. The build will continue; the deployed server will fall back to an ephemeral secret until a real one is set.',
        );
      } else {
        const bytes = new Uint8Array(48);
        globalThis.crypto.getRandomValues(bytes);
        authSecret = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        authSecretEphemeral = true;
        process.env.AUTH_SECRET = authSecret;
        process.env.AUTH_SECRET_EPHEMERAL = '1';
        warn(
          tooShort
            ? 'AUTH_SECRET is not set — using an ephemeral secret for this instance. Sign-in works, but every deploy or restart signs everyone out. Set AUTH_SECRET (openssl rand -base64 48) to fix this.'
            : 'AUTH_SECRET still holds the placeholder from .env.example — using an ephemeral secret for this instance. Set a real AUTH_SECRET (openssl rand -base64 48).',
        );
      }
    }
  } else if (!authSecret) {
    // Deterministic, clearly-marked development fallback so `next dev` and the
    // test suite work without manual setup. Never reachable in production.
    authSecret = 'rankinai-development-only-secret-do-not-use-in-production';
  }

  // When the entrypoint already generated the fallback (before the server
  // loaded, so the edge middleware agrees from the first request), getEnv sees
  // a perfectly valid secret — the marker env var is how the warning survives
  // into /api/health and the admin area.
  if (authSecretEphemeral && !configWarnings.some((w) => w.includes('AUTH_SECRET'))) {
    configWarnings.push(
      'AUTH_SECRET is not set — running on an ephemeral secret. Sign-in works, but every deploy or restart signs everyone out. Set AUTH_SECRET (openssl rand -base64 48).',
    );
  }

  // The crawler fixture bypass would be an SSRF hole in production —
  // `url-safety.ts` therefore ignores it outright whenever NODE_ENV is
  // production, and the unit suite asserts that. The variable being present is
  // a configuration mistake worth shouting about, not worth dying over.
  if (isProduction && raw.ALLOW_TEST_FIXTURE_HOST && !isBuildPhase) {
    warn(
      'ALLOW_TEST_FIXTURE_HOST is set but IGNORED in production — the crawler never relaxes SSRF protection here. Remove the variable.',
    );
  }

  // Billing test mode must never silently activate in production: without the
  // explicit acknowledgement it is forced OFF, so a stray variable can never
  // cause simulated checkouts on a live storefront.
  let billingTestMode = raw.BILLING_TEST_MODE === true;
  if (isProduction && billingTestMode && raw.BILLING_TEST_MODE_ALLOW_PRODUCTION !== true) {
    billingTestMode = false;
    if (!isBuildPhase) {
      warn(
        'BILLING_TEST_MODE is set but FORCED OFF in production. Unset it, or set BILLING_TEST_MODE_ALLOW_PRODUCTION=true to run simulated billing deliberately.',
      );
    }
  }

  const stripeConfigured = Boolean(raw.STRIPE_SECRET_KEY);
  if (!stripeConfigured && !billingTestMode) {
    // Without Stripe keys the only usable path is the simulated checkout.
    billingTestMode = !isProduction;
    if (isProduction && !isBuildPhase) {
      warn(
        'Stripe is not configured (no STRIPE_SECRET_KEY) — checkout is unavailable. The rest of the application works normally.',
      );
    }
  }

  return {
    ...raw,
    authSecret,
    authSecretEphemeral,
    configWarnings,
    isProduction,
    isTest,
    isDevelopment: raw.NODE_ENV === 'development',
    billingTestMode,
    stripeConfigured,
    llmEnabled: Boolean(raw.OPENAI_API_KEY),
    searchEnabled: raw.SEARCH_PROVIDER === 'serper' && Boolean(raw.SERPER_API_KEY),
  };
}

export function getEnv(): AppEnv {
  if (!cached) cached = build();
  return cached;
}

/** Test helper: forget the memoized snapshot after mutating process.env. */
export function resetEnvCache(): void {
  cached = null;
}

export const env = new Proxy({} as AppEnv, {
  get(_t, prop: string) {
    return getEnv()[prop as keyof AppEnv];
  },
});
