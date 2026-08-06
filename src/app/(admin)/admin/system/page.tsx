import type { Metadata } from 'next';
import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react';

import { Alert, Badge, Card } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { ALL_PRODUCTS, stripePriceIdFor } from '@/lib/plans';
import { getQueueStats } from '@/lib/queue';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin — system',
  robots: { index: false, follow: false },
};

/**
 * System diagnostics.
 *
 * Reports whether each capability is configured — never the value of any
 * secret. Presence is shown as a boolean and nothing more.
 */
export default async function AdminSystemPage() {
  await requireAdmin();
  const env = getEnv();

  const [dbLatency, queue, counts, latestMigration] = await Promise.all([
    measureDbLatency(),
    getQueueStats(true),
    Promise.all([
      prisma.user.count(),
      prisma.audit.count(),
      prisma.payment.count(),
      prisma.report.count(),
      prisma.analyticsEvent.count(),
      prisma.rateLimitEvent.count(),
    ]),
    prisma
      .$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
        SELECT migration_name, finished_at
        FROM _prisma_migrations
        ORDER BY finished_at DESC NULLS LAST
        LIMIT 1
      `
      .catch(() => []),
  ]);

  const [userCount, auditCount, paymentCount, reportCount, eventCount, rateLimitCount] = counts;

  const capabilities = [
    {
      label: 'Database',
      configured: dbLatency != null,
      detail: dbLatency != null ? `Connected · ${dbLatency}ms` : 'Not reachable',
      required: true,
    },
    {
      label: 'Auth secret',
      configured: env.authSecret.length >= 32,
      detail:
        env.authSecret.length >= 32
          ? 'Set (value not shown)'
          : 'Using the development fallback — set AUTH_SECRET before production',
      required: true,
    },
    {
      label: 'Stripe secret key',
      configured: env.stripeConfigured,
      detail: env.stripeConfigured ? 'Configured' : 'Not configured — checkout is simulated',
      required: false,
    },
    {
      label: 'Stripe webhook secret',
      configured: Boolean(env.STRIPE_WEBHOOK_SECRET),
      detail: env.STRIPE_WEBHOOK_SECRET
        ? 'Configured'
        : 'Not configured — webhooks will be rejected',
      required: false,
    },
    {
      label: 'Billing test mode',
      configured: !env.billingTestMode,
      detail: env.billingTestMode
        ? 'ENABLED — checkout is simulated and no payments are taken'
        : 'Disabled — live billing',
      required: false,
      invertTone: true,
    },
    {
      label: 'OpenAI narrative enhancement',
      configured: env.llmEnabled,
      detail: env.llmEnabled
        ? `Enabled · model ${env.OPENAI_MODEL}`
        : 'Disabled — deterministic report templates are used. Scoring is unaffected.',
      required: false,
    },
    {
      label: 'Search observations',
      configured: env.searchEnabled,
      detail: env.searchEnabled
        ? `Enabled · provider ${env.SEARCH_PROVIDER}`
        : 'Disabled — the public-web observations section is omitted',
      required: false,
    },
    {
      label: 'Email provider',
      configured: env.EMAIL_PROVIDER !== 'console',
      detail:
        env.EMAIL_PROVIDER === 'console'
          ? 'Console adapter — messages are logged, not delivered'
          : `${env.EMAIL_PROVIDER} configured`,
      required: false,
    },
    {
      label: 'Cron secret',
      configured: Boolean(env.CRON_SECRET),
      detail: env.CRON_SECRET ? 'Configured' : 'Not configured',
      required: false,
    },
    {
      label: 'Worker secret',
      configured: Boolean(env.AUDIT_WORKER_SECRET),
      detail: env.AUDIT_WORKER_SECRET ? 'Configured' : 'Not configured',
      required: false,
    },
    {
      label: 'Crawler test-fixture bypass',
      configured: !env.ALLOW_TEST_FIXTURE_HOST,
      detail: env.ALLOW_TEST_FIXTURE_HOST
        ? `ENABLED for ${env.ALLOW_TEST_FIXTURE_HOST} — must never be set in production`
        : 'Disabled (correct for production)',
      required: false,
      invertTone: true,
    },
  ];

  const missingPrices = ALL_PRODUCTS.filter((product) => !stripePriceIdFor(product.key));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">System</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Configuration and health. Secret values are never displayed — only whether they are set.
        </p>
      </header>

      {env.billingTestMode ? (
        <Alert tone="warning" title="Billing test mode is enabled">
          Checkout is simulated on this deployment and no real payments are being taken. Unset
          <code className="mx-1 font-mono text-xs">BILLING_TEST_MODE</code> and configure Stripe
          keys before taking live payments.
        </Alert>
      ) : null}

      {!env.llmEnabled ? (
        <Alert tone="info" title="Enhanced narrative generation is disabled">
          <code className="font-mono text-xs">OPENAI_API_KEY</code> is not configured. Audits still
          run end to end using deterministic report templates — only the wording of summaries is
          affected. Category scores and evidence are always rule-based.
        </Alert>
      ) : null}

      <Card>
        <div className="border-b border-[var(--border)] p-5">
          <h2 className="text-base font-semibold">Capabilities</h2>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {capabilities.map((capability) => (
            <li key={capability.label} className="flex items-start gap-3 px-5 py-3.5">
              <span className="mt-0.5 shrink-0">
                {capability.configured ? (
                  <CheckCircle2 className="size-4.5 text-emerald-500" aria-hidden="true" />
                ) : capability.required ? (
                  <XCircle className="size-4.5 text-red-500" aria-hidden="true" />
                ) : (
                  <MinusCircle className="size-4.5 text-amber-500" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {capability.label}
                  {capability.required ? (
                    <Badge tone="neutral" className="ml-2">
                      Required
                    </Badge>
                  ) : null}
                </p>
                <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{capability.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="border-b border-[var(--border)] p-5">
          <h2 className="text-base font-semibold">Stripe price configuration</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Price IDs are read from environment variables and never hardcoded. Generate them with{' '}
            <code className="font-mono">npm run stripe:setup</code>.
          </p>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {ALL_PRODUCTS.map((product) => {
            const priceId = stripePriceIdFor(product.key);
            return (
              <li
                key={product.key}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <div>
                  <p className="text-sm font-medium">{product.name}</p>
                  <p className="font-mono text-xs text-[var(--muted-foreground)]">
                    {product.envVar}
                  </p>
                </div>
                {priceId ? (
                  <Badge tone="success">Configured</Badge>
                ) : (
                  <Badge tone="warning">Not set</Badge>
                )}
              </li>
            );
          })}
        </ul>
        {missingPrices.length > 0 ? (
          <div className="border-t border-[var(--border)] p-5">
            <p className="text-sm text-[var(--muted-foreground)]">
              {missingPrices.length} price {missingPrices.length === 1 ? 'ID is' : 'IDs are'} not
              configured. Those products cannot be purchased through Stripe until the corresponding
              environment {missingPrices.length === 1 ? 'variable is' : 'variables are'} set.
            </p>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold">Runtime</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Environment" value={env.NODE_ENV} />
            <Row label="Public URL" value={env.NEXT_PUBLIC_APP_URL} />
            <Row label="Node version" value={process.version} />
            <Row label="Uptime" value={`${Math.round(process.uptime() / 60)} minutes`} />
            <Row
              label="Latest migration"
              value={
                latestMigration[0]
                  ? `${latestMigration[0].migration_name}${
                      latestMigration[0].finished_at
                        ? ` · ${formatDate(latestMigration[0].finished_at)}`
                        : ''
                    }`
                  : 'unknown'
              }
            />
            <Row label="Crawl timeout" value={`${env.CRAWL_TIMEOUT_MS}ms`} />
            <Row label="Crawl max bytes" value={`${Math.round(env.CRAWL_MAX_BYTES / 1024)} KB`} />
            <Row label="Crawler user agent" value={env.CRAWL_USER_AGENT} />
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Data volume</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Users" value={String(userCount)} />
            <Row label="Audits" value={String(auditCount)} />
            <Row label="Payments" value={String(paymentCount)} />
            <Row label="Stored PDF reports" value={String(reportCount)} />
            <Row label="Analytics events" value={String(eventCount)} />
            <Row label="Rate-limit rows" value={String(rateLimitCount)} />
          </dl>

          <h3 className="mt-6 text-sm font-semibold">Queue (including demo)</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Queued" value={String(queue.queued)} />
            <Row label="Running" value={String(queue.running)} />
            <Row label="Completed" value={String(queue.completed)} />
            <Row label="Failed" value={String(queue.failed)} />
          </dl>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-base font-semibold">Health endpoint</h2>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          <code className="font-mono text-xs">GET /api/health</code> returns 200 when the database
          is reachable and 503 otherwise. Point your uptime monitor and the Railway health check at
          it.
        </p>
      </Card>
    </div>
  );
}

async function measureDbLatency(): Promise<number | null> {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    return Date.now() - start;
  } catch {
    return null;
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-2">
      <dt className="shrink-0 text-[var(--muted-foreground)]">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
