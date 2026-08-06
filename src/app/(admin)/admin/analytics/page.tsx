import type { Metadata } from 'next';
import { Suspense } from 'react';

import { Alert, Card, Skeleton } from '@/components/ui/primitives';
import {
  AuditsChart,
  ConversionFunnel,
  RevenueChart,
  SignupChart,
} from '@/components/admin/charts';
import { DemoToggle } from '@/components/admin/demo-toggle';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminOverview, getDailySeries } from '@/lib/admin/metrics';
import { prisma } from '@/lib/db';
import { formatDate, formatUsd } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin — analytics',
  robots: { index: false, follow: false },
};

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; days?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const includeDemo = params.demo === '1';
  const days = Math.min(365, Math.max(7, Number.parseInt(params.days ?? '90', 10) || 90));

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const [series, overview, recentEvents] = await Promise.all([
    getDailySeries({ from, to, includeDemo }),
    getAdminOverview(includeDemo),
    prisma.analyticsEvent.groupBy({
      by: ['name'],
      where: {
        createdAt: { gte: from },
        ...(includeDemo ? {} : { isDemo: false }),
      },
      _count: { _all: true },
      orderBy: { _count: { name: 'desc' } },
    }),
  ]);

  const totalRevenue = series.reduce((sum, point) => sum + point.revenueCents, 0);
  const totalSignups = series.reduce((sum, point) => sum + point.signups, 0);
  const totalAudits = series.reduce((sum, point) => sum + point.audits, 0);

  const funnelSteps = [
    { label: 'Home page viewed', value: overview.funnel.homeViewed },
    { label: 'Demo started', value: overview.funnel.demoStarted },
    { label: 'Demo completed', value: overview.funnel.demoCompleted },
    { label: 'Pricing viewed', value: overview.funnel.pricingViewed },
    { label: 'Sign-up completed', value: overview.funnel.signupCompleted },
    { label: 'Checkout started', value: overview.funnel.checkoutStarted },
    { label: 'Checkout completed', value: overview.funnel.checkoutCompleted },
    { label: 'Audit created', value: overview.funnel.auditCreated },
    { label: 'Audit completed', value: overview.funnel.auditCompleted },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {formatDate(from)} — {formatDate(to)} ({days} days)
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-10 w-56" />}>
          <DemoToggle includeDemo={includeDemo} />
        </Suspense>
      </header>

      {includeDemo ? (
        <Alert tone="warning" title="Demo data included">
          These charts include fabricated demonstration records and must not be presented as
          verified business performance.
        </Alert>
      ) : null}

      <nav aria-label="Date range" className="flex flex-wrap gap-2">
        {[30, 90, 180, 365].map((option) => (
          <a
            key={option}
            href={`/admin/analytics?days=${option}${includeDemo ? '&demo=1' : ''}`}
            className={
              option === days
                ? 'rounded-lg border border-violet-500 bg-violet-500/10 px-3.5 py-1.5 text-sm font-medium'
                : 'rounded-lg border border-[var(--border-strong)] px-3.5 py-1.5 text-sm text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]'
            }
          >
            {option} days
          </a>
        ))}
      </nav>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={`Revenue (${days}d)`} value={formatUsd(totalRevenue)} />
        <Stat label={`Sign-ups (${days}d)`} value={String(totalSignups)} />
        <Stat label={`Audits created (${days}d)`} value={String(totalAudits)} />
      </div>

      <Card className="p-5">
        <h2 className="text-base font-semibold">Daily revenue</h2>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Successful payments only, in US dollars.
        </p>
        <div className="mt-4">
          <RevenueChart data={series} title={`Daily revenue over the last ${days} days`} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold">Sign-up activity</h2>
          <div className="mt-4">
            <SignupChart data={series} title={`Daily sign-ups over the last ${days} days`} />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Audits created</h2>
          <div className="mt-4">
            <AuditsChart data={series} title={`Daily audits over the last ${days} days`} />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold">Conversion funnel</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            All-time internal event counts. Not a cohort analysis — each step counts events, not
            unique visitors.
          </p>
          <div className="mt-5">
            <ConversionFunnel steps={funnelSteps} />
          </div>
        </Card>

        <Card>
          <div className="border-b border-[var(--border)] p-5">
            <h2 className="text-base font-semibold">Event breakdown</h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Events recorded in the selected range.
            </p>
          </div>
          {recentEvents.length === 0 ? (
            <p className="p-5 text-sm text-[var(--muted-foreground)]">
              No analytics events in this range.
            </p>
          ) : (
            <dl className="divide-y divide-[var(--border)]">
              {recentEvents.map((event) => (
                <div
                  key={event.name}
                  className="flex items-baseline justify-between gap-3 px-5 py-2.5"
                >
                  <dt className="font-mono text-xs text-[var(--muted-foreground)]">{event.name}</dt>
                  <dd className="text-sm font-semibold tabular-nums">{event._count._all}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-base font-semibold">Privacy note</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
          RankInAI records product events through a first-party system. Event properties are
          restricted to a fixed whitelist and never contain form values, message contents,
          credentials or payment details. IP addresses used for rate limiting are stored as salted
          one-way hashes and pruned automatically. No third-party analytics script is loaded unless
          the operator explicitly configures one.
        </p>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </Card>
  );
}
