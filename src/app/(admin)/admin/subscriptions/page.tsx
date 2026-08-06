import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { SubscriptionStatus } from '@prisma/client';

import { Badge, Card, EmptyState, Skeleton } from '@/components/ui/primitives';
import { DemoToggle } from '@/components/admin/demo-toggle';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getAdminOverview } from '@/lib/admin/metrics';
import { entitlementsForPlan, planLabel } from '@/lib/plans';
import { formatDate, formatUsd } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin — subscriptions',
  robots: { index: false, follow: false },
};

const TONE: Record<SubscriptionStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success',
  TRIALING: 'success',
  PAST_DUE: 'warning',
  UNPAID: 'danger',
  CANCELED: 'neutral',
  INCOMPLETE: 'warning',
  PAUSED: 'neutral',
};

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  await requireAdmin();
  const { demo } = await searchParams;
  const includeDemo = demo === '1';
  const where = includeDemo ? {} : { isDemo: false };

  const [subscriptions, overview] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
      include: { user: { select: { id: true, email: true } } },
    }),
    getAdminOverview(includeDemo),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Subscriptions</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {overview.subscriptions.active} active ·{' '}
            {formatUsd(overview.subscriptions.mrrCents)} monthly recurring revenue.
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-10 w-56" />}>
          <DemoToggle includeDemo={includeDemo} />
        </Suspense>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {(['STARTER', 'GROWTH', 'AGENCY'] as const).map((plan) => {
          const count = overview.subscriptions.byPlan.find((row) => row.plan === plan)?.count ?? 0;
          const entitlements = entitlementsForPlan(plan);
          return (
            <Card key={plan} className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                {planLabel(plan)}
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums">{count}</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {entitlements.auditsPerPeriod} audits · {entitlements.pageLimit} pages ·{' '}
                {entitlements.competitorLimit} competitors
              </p>
            </Card>
          );
        })}
      </div>

      {subscriptions.length === 0 ? (
        <Card>
          <EmptyState
            title="No subscriptions"
            description="Subscriptions appear here once customers subscribe and Stripe confirms it."
            className="border-0"
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-4xl border-collapse text-left text-sm">
            <caption className="sr-only">All subscriptions</caption>
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                <th scope="col" className="px-5 py-3 font-semibold">Customer</th>
                <th scope="col" className="px-5 py-3 font-semibold">Plan</th>
                <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                <th scope="col" className="px-5 py-3 font-semibold">Usage</th>
                <th scope="col" className="px-5 py-3 font-semibold">Renews</th>
                <th scope="col" className="px-5 py-3 font-semibold">Cancels</th>
                <th scope="col" className="px-5 py-3 font-semibold">Stripe ID</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((subscription) => {
                const allowance = entitlementsForPlan(subscription.plan).auditsPerPeriod;
                return (
                  <tr key={subscription.id} className="border-b border-[var(--border)] last:border-0">
                    <th scope="row" className="px-5 py-3 font-normal">
                      <Link
                        href={`/admin/users/${subscription.user.id}`}
                        className="text-[var(--accent)] underline-offset-4 hover:underline"
                      >
                        {subscription.user.email}
                      </Link>
                      {subscription.isDemo ? (
                        <Badge tone="demo" className="ml-2">
                          Demo
                        </Badge>
                      ) : null}
                    </th>
                    <td className="px-5 py-3">{planLabel(subscription.plan)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={TONE[subscription.status]}>
                        {subscription.status.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 tabular-nums">
                      {subscription.auditsUsedThisPeriod} / {allowance}
                    </td>
                    <td className="px-5 py-3 text-[var(--muted-foreground)]">
                      {subscription.currentPeriodEnd
                        ? formatDate(subscription.currentPeriodEnd)
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-[var(--muted-foreground)]">
                      {subscription.cancelAtPeriodEnd ? 'At period end' : '—'}
                    </td>
                    <td className="max-w-48 truncate px-5 py-3 font-mono text-xs text-[var(--muted-foreground)]">
                      {subscription.stripeSubscriptionId ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
