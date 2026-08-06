import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  AlertTriangle,
  Coins,
  CreditCard,
  FileSearch,
  Gauge,
  Mail,
  TrendingUp,
  Users,
} from 'lucide-react';

import { Alert, Badge, Card, Skeleton } from '@/components/ui/primitives';
import { DemoToggle } from '@/components/admin/demo-toggle';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getAdminOverview, getJobHealth } from '@/lib/admin/metrics';
import { getEnv } from '@/lib/env';
import { ADMIN_ACTION_LABELS, type AdminAction } from '@/lib/admin-log';
import { formatDate, formatNumber, formatUsd, relativeTime } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin overview',
  robots: { index: false, follow: false },
};

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  await requireAdmin();
  const { demo } = await searchParams;
  const includeDemo = demo === '1';

  const [overview, jobs, recentActivity] = await Promise.all([
    getAdminOverview(includeDemo),
    getJobHealth(includeDemo),
    prisma.adminActivity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { admin: { select: { email: true, name: true } } },
    }),
  ]);

  const env = getEnv();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin overview</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Real business metrics. Demonstration data is excluded by default.
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-10 w-56" />}>
          <DemoToggle includeDemo={includeDemo} />
        </Suspense>
      </header>

      {includeDemo ? (
        <Alert tone="warning" title="Demo data is included in these figures">
          Seeded demonstration records are being counted. These numbers do not represent verified
          revenue or actual historical performance and must never be presented to a buyer as genuine
          financial results.
        </Alert>
      ) : null}

      {!env.llmEnabled ? (
        <Alert tone="info" title="Enhanced narrative generation is disabled">
          <code className="font-mono text-xs">OPENAI_API_KEY</code> is not configured, so audits use
          deterministic report templates. Scoring and evidence are unaffected — they are always
          rule-based.
        </Alert>
      ) : null}

      {env.billingTestMode ? (
        <Alert tone="warning" title="Billing test mode is enabled">
          Checkout is simulated and no real payments are being taken on this deployment.
        </Alert>
      ) : null}

      {/* Revenue */}
      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
          Revenue
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={CreditCard}
            label="Gross revenue"
            value={formatUsd(overview.revenue.grossCents)}
            detail="All successful payments"
          />
          <Stat
            icon={TrendingUp}
            label="Monthly recurring revenue"
            value={formatUsd(overview.subscriptions.mrrCents)}
            detail={`${overview.subscriptions.active} active subscriptions`}
          />
          <Stat
            icon={Coins}
            label="One-time audit sales"
            value={formatNumber(overview.revenue.oneTimePurchases)}
            detail={formatUsd(overview.revenue.oneTimeCents)}
          />
          <Stat
            icon={TrendingUp}
            label="Last 30 days"
            value={formatUsd(overview.revenue.last30DaysCents)}
            detail={
              overview.revenue.refundedCents > 0
                ? `${formatUsd(overview.revenue.refundedCents)} refunded overall`
                : 'No refunds recorded'
            }
          />
        </div>
      </section>

      {/* Users and audits */}
      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
          Users and audits
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={Users}
            label="Registered users"
            value={formatNumber(overview.users.total)}
            detail={`${overview.users.newLast30Days} in the last 30 days · ${overview.users.suspended} suspended`}
          />
          <Stat
            icon={FileSearch}
            label="Audits completed"
            value={formatNumber(overview.audits.completed)}
            detail={`${overview.audits.total} created in total`}
          />
          <Stat
            icon={Gauge}
            label="Average score"
            value={
              overview.audits.averageScore != null ? String(overview.audits.averageScore) : '—'
            }
            detail="Across completed audits"
          />
          <Stat
            icon={AlertTriangle}
            label="Audit pipeline"
            value={`${overview.audits.processing} running`}
            detail={`${overview.audits.queued} queued · ${overview.audits.failed} failed`}
            tone={overview.audits.failed > 0 ? 'warning' : 'neutral'}
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Conversion funnel */}
        <Card>
          <div className="border-b border-[var(--border)] p-5">
            <h2 className="text-base font-semibold">Conversion events</h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Internal, privacy-conscious product analytics. No form values or personal data are
              recorded.
            </p>
          </div>
          <dl className="divide-y divide-[var(--border)]">
            {[
              ['Home page viewed', overview.funnel.homeViewed],
              ['Demo started', overview.funnel.demoStarted],
              ['Demo completed', overview.funnel.demoCompleted],
              ['Live preview requested', overview.funnel.previewRequested],
              ['Pricing viewed', overview.funnel.pricingViewed],
              ['Sign-ups completed', overview.funnel.signupCompleted],
              ['Checkout started', overview.funnel.checkoutStarted],
              ['Checkout completed', overview.funnel.checkoutCompleted],
              ['Audits created', overview.funnel.auditCreated],
              ['Audits completed', overview.funnel.auditCompleted],
              ['Reports downloaded', overview.funnel.reportDownloaded],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="flex items-baseline justify-between gap-3 px-5 py-2.5"
              >
                <dt className="text-sm text-[var(--muted-foreground)]">{label}</dt>
                <dd className="text-sm font-semibold tabular-nums">
                  {formatNumber(Number(value))}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="space-y-5">
          {/* Job health */}
          <Card>
            <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
              <h2 className="text-base font-semibold">Worker queue</h2>
              <Link
                href="/admin/jobs"
                className="text-sm text-[var(--accent)] underline-offset-4 hover:underline"
              >
                View jobs
              </Link>
            </div>
            <dl className="grid grid-cols-2 gap-px bg-[var(--border)]">
              <QueueStat label="Queued" value={jobs.queued} />
              <QueueStat label="Running" value={jobs.running} />
              <QueueStat label="Completed" value={jobs.completed} />
              <QueueStat
                label="Failed"
                value={jobs.failed}
                tone={jobs.failed > 0 ? 'danger' : 'neutral'}
              />
            </dl>
            {jobs.oldestQueuedAt ? (
              <p className="border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--muted-foreground)]">
                Oldest queued job waiting since {formatDate(jobs.oldestQueuedAt, 'datetime')} (
                {relativeTime(jobs.oldestQueuedAt)}). If this keeps growing, check that the worker
                service is running.
              </p>
            ) : null}
          </Card>

          {/* Contacts */}
          <Card>
            <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
              <h2 className="text-base font-semibold">Contact submissions</h2>
              <Link
                href="/admin/contacts"
                className="text-sm text-[var(--accent)] underline-offset-4 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="flex items-center gap-4 p-5">
              <Mail className="size-8 text-[var(--muted-foreground)]" aria-hidden="true" />
              <div>
                <p className="text-2xl font-bold tabular-nums">{overview.contacts.unread}</p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  unread of {overview.contacts.total} total
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Admin activity */}
      <Card>
        <div className="border-b border-[var(--border)] p-5">
          <h2 className="text-base font-semibold">Recent admin activity</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Every privileged action is recorded with the administrator who performed it.
          </p>
        </div>
        {recentActivity.length === 0 ? (
          <p className="p-5 text-sm text-[var(--muted-foreground)]">
            No admin actions recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {recentActivity.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    <Badge tone="neutral" className="mr-2">
                      {ADMIN_ACTION_LABELS[entry.action as AdminAction] ?? entry.action}
                    </Badge>
                    {entry.summary}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    {entry.admin.name ?? entry.admin.email}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                  {formatDate(entry.createdAt, 'datetime')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'warning';
}) {
  return (
    <Card className={tone === 'warning' ? 'border-amber-500/40 p-5' : 'p-5'}>
      <div className="flex items-center gap-2.5">
        <Icon className="size-4 text-[var(--muted-foreground)]" aria-hidden />
        <p className="text-xs font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
          {label}
        </p>
      </div>
      <p className="mt-2.5 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">{detail}</p>
    </Card>
  );
}

function QueueStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <div className="bg-[var(--surface)] px-5 py-4">
      <dt className="text-xs tracking-wide text-[var(--muted-foreground)] uppercase">{label}</dt>
      <dd
        className={
          tone === 'danger'
            ? 'mt-1 text-xl font-bold text-red-600 tabular-nums dark:text-red-400'
            : 'mt-1 text-xl font-bold tabular-nums'
        }
      >
        {value}
      </dd>
    </div>
  );
}
