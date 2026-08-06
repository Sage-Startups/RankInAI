import type { Metadata } from 'next';
import Link from 'next/link';
import { AuditStatus } from '@prisma/client';
import {
  ArrowRight,
  ArrowUpRight,
  Coins,
  FilePlus2,
  FileSearch,
  Gauge,
  ListChecks,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

import { Alert, Badge, Card, EmptyState, Progress } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { ScoreDelta, ScoreRing } from '@/components/score/score-ring';
import { AuditStatusBadge } from '@/components/app/audit-status-badge';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getEntitlements } from '@/lib/credits';
import { planLabel } from '@/lib/plans';
import { formatDate, displayHost, relativeTime } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false },
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser('/dashboard');
  const { denied } = await searchParams;

  const [entitlements, audits, totalAudits, latestCompleted, openRecommendations] =
    await Promise.all([
      getEntitlements(user.id),
      prisma.audit.findMany({
        where: { userId: user.id, deletedAt: null, archivedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { job: { select: { progress: true, progressMessage: true, status: true } } },
      }),
      prisma.audit.count({ where: { userId: user.id, deletedAt: null } }),
      prisma.audit.findFirst({
        where: { userId: user.id, status: AuditStatus.COMPLETED, deletedAt: null },
        orderBy: { completedAt: 'desc' },
        select: {
          id: true,
          businessName: true,
          websiteUrl: true,
          overallScore: true,
          previousScore: true,
          completedAt: true,
        },
      }),
      prisma.auditRecommendation.findMany({
        where: {
          audit: {
            userId: user.id,
            status: AuditStatus.COMPLETED,
            deletedAt: null,
            archivedAt: null,
          },
          horizon: 'DO_FIRST',
        },
        orderBy: [{ audit: { completedAt: 'desc' } }, { priority: 'asc' }],
        take: 5,
        select: {
          id: true,
          title: true,
          category: true,
          impact: true,
          effort: true,
          auditId: true,
          audit: { select: { businessName: true } },
        },
      }),
    ]);

  const isNewAccount = totalAudits === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {user.name ? `Welcome back, ${user.name.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Your AI visibility audits, scores and next actions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button asChild variant="secondary">
            <Link href="/sample-report">View demo report</Link>
          </Button>
          <Button asChild disabled={!entitlements.canCreateAudit}>
            <Link href="/dashboard/audits/new">
              <FilePlus2 aria-hidden="true" />
              Start a new audit
            </Link>
          </Button>
        </div>
      </header>

      {denied === 'admin' ? (
        <Alert tone="danger" title="Access denied">
          <span className="flex items-center gap-2">
            <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
            Your account does not have administrator permissions.
          </span>
        </Alert>
      ) : null}

      {!entitlements.canCreateAudit ? (
        <Alert tone="warning" title="No audits remaining">
          You have used your plan allowance and have no one-time credits left.{' '}
          <Link href="/dashboard/billing" className="underline underline-offset-4">
            Buy another audit or upgrade your plan
          </Link>{' '}
          to continue.
        </Alert>
      ) : null}

      {/* Stat row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Gauge}
          label="Current plan"
          value={planLabel(entitlements.plan)}
          detail={
            entitlements.subscriptionActive && entitlements.periodEnd
              ? `Renews ${formatDate(entitlements.periodEnd)}`
              : 'No active subscription'
          }
        />
        <StatCard
          icon={ListChecks}
          label="Plan audits left"
          value={
            entitlements.entitlements.auditsPerPeriod > 0
              ? `${entitlements.auditsRemainingThisPeriod} / ${entitlements.entitlements.auditsPerPeriod}`
              : '—'
          }
          detail={
            entitlements.entitlements.auditsPerPeriod > 0
              ? `${entitlements.auditsUsedThisPeriod} used this period`
              : 'Subscribe for a monthly allowance'
          }
        >
          {entitlements.entitlements.auditsPerPeriod > 0 ? (
            <Progress
              value={
                (entitlements.auditsUsedThisPeriod / entitlements.entitlements.auditsPerPeriod) *
                100
              }
              label="Plan allowance used"
              className="mt-3"
            />
          ) : null}
        </StatCard>
        <StatCard
          icon={Coins}
          label="One-time credits"
          value={String(entitlements.oneTimeCredits)}
          detail={
            entitlements.oneTimeCredits > 0
              ? 'Never expire · used after your plan allowance'
              : 'Buy a single audit for $49'
          }
        />
        <StatCard
          icon={FileSearch}
          label="Total audits"
          value={String(totalAudits)}
          detail={
            latestCompleted?.completedAt
              ? `Last completed ${relativeTime(latestCompleted.completedAt)}`
              : 'No completed audits yet'
          }
        />
      </div>

      {isNewAccount ? (
        <Card>
          <EmptyState
            icon={<Sparkles className="size-6" aria-hidden="true" />}
            title="Run your first audit"
            description="Enter your website and RankInAI will crawl it, score seven AI visibility categories and give you a prioritized action plan. Not ready? Open the sample report to see exactly what you'll get."
            action={
              <div className="flex flex-wrap justify-center gap-2.5">
                <Button asChild>
                  <Link href="/dashboard/audits/new">
                    Start your first audit
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/sample-report">View the sample report</Link>
                </Button>
              </div>
            }
            className="border-0"
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            {latestCompleted ? (
              <Card className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Latest score</h2>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/dashboard/audits/${latestCompleted.id}`}>
                      Open report
                      <ArrowUpRight aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
                <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
                  <ScoreRing
                    score={latestCompleted.overallScore ?? 0}
                    size={140}
                    showLabel={false}
                    className="shrink-0"
                  />
                  <div className="min-w-0 text-center sm:text-left">
                    <p className="truncate text-base font-semibold">
                      {latestCompleted.businessName}
                    </p>
                    <p className="truncate text-sm text-[var(--muted-foreground)]">
                      {displayHost(latestCompleted.websiteUrl)}
                    </p>
                    <p className="mt-2">
                      <ScoreDelta
                        current={latestCompleted.overallScore ?? 0}
                        previous={latestCompleted.previousScore}
                      />
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      Completed {formatDate(latestCompleted.completedAt, 'datetime')}
                    </p>
                  </div>
                </div>
              </Card>
            ) : null}

            <Card>
              <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
                <h2 className="text-base font-semibold">Recent audits</h2>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/dashboard/audits">View all</Link>
                </Button>
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {audits.map((audit) => (
                  <li key={audit.id}>
                    <Link
                      href={`/dashboard/audits/${audit.id}`}
                      className="flex items-center gap-4 p-5 transition-colors hover:bg-[var(--surface-muted)]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{audit.businessName}</p>
                        <p className="truncate text-xs text-[var(--muted-foreground)]">
                          {displayHost(audit.websiteUrl)} · {formatDate(audit.createdAt)}
                        </p>
                        {audit.status === AuditStatus.RUNNING && audit.job ? (
                          <div className="mt-2 max-w-xs">
                            <Progress value={audit.job.progress} label="Audit progress" />
                            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                              {audit.job.progressMessage ?? 'Processing…'}
                            </p>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <AuditStatusBadge status={audit.status} />
                        {audit.overallScore != null ? (
                          <span className="text-lg font-bold tabular-nums">
                            {audit.overallScore}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="h-fit">
            <div className="border-b border-[var(--border)] p-5">
              <h2 className="text-base font-semibold">High-priority open actions</h2>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                The &quot;Do first&quot; recommendations from your most recent audits.
              </p>
            </div>
            {openRecommendations.length === 0 ? (
              <p className="p-5 text-sm text-[var(--muted-foreground)]">
                No open high-priority actions. Complete an audit to see recommendations here.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {openRecommendations.map((rec) => (
                  <li key={rec.id}>
                    <Link
                      href={`/dashboard/audits/${rec.auditId}#action-plan`}
                      className="block p-5 transition-colors hover:bg-[var(--surface-muted)]"
                    >
                      <p className="text-sm font-medium">{rec.title}</p>
                      <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">
                        {rec.audit.businessName}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge tone={rec.impact === 'HIGH' ? 'danger' : 'neutral'}>
                          {rec.impact.toLowerCase()} impact
                        </Badge>
                        <Badge tone="neutral">{rec.effort.toLowerCase()} effort</Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  children,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  value: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5">
        <Icon className="size-4 text-[var(--muted-foreground)]" aria-hidden />
        <p className="text-xs font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
          {label}
        </p>
      </div>
      <p className="mt-2.5 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">{detail}</p>
      {children}
    </Card>
  );
}
