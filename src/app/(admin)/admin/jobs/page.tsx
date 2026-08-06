import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { JobStatus, Prisma } from '@prisma/client';

import { Alert, Badge, Card, EmptyState, Progress, Select, Skeleton } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { JobActions } from '@/components/admin/job-actions';
import { DemoToggle } from '@/components/admin/demo-toggle';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getJobHealth } from '@/lib/admin/metrics';
import { formatDate, relativeTime, displayHost } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin — jobs',
  robots: { index: false, follow: false },
};

const STATUS_TONE: Record<JobStatus, 'info' | 'success' | 'danger' | 'warning' | 'neutral'> = {
  QUEUED: 'info',
  RUNNING: 'info',
  COMPLETED: 'success',
  FAILED: 'danger',
  CANCELED: 'warning',
};

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; demo?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const includeDemo = params.demo === '1';
  const status =
    params.status && params.status in JobStatus ? (params.status as JobStatus) : undefined;

  const where: Prisma.AuditJobWhereInput = {
    ...(includeDemo ? {} : { isDemo: false }),
    ...(status ? { status } : {}),
  };

  const [jobs, health] = await Promise.all([
    prisma.auditJob.findMany({
      where,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 60,
      include: {
        audit: {
          select: {
            id: true,
            businessName: true,
            websiteUrl: true,
            status: true,
            isDemo: true,
            user: { select: { email: true } },
          },
        },
      },
    }),
    getJobHealth(includeDemo),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Worker queue</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Live state of the audit job queue processed by the worker service.
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-10 w-56" />}>
          <DemoToggle includeDemo={includeDemo} />
        </Suspense>
      </header>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Queued" value={health.queued} />
        <Stat label="Running" value={health.running} />
        <Stat label="Completed" value={health.completed} />
        <Stat label="Failed" value={health.failed} tone={health.failed > 0 ? 'danger' : 'neutral'} />
      </div>

      {health.queued > 0 && health.running === 0 && health.oldestQueuedAt ? (
        <Alert tone="warning" title="Jobs are queued but nothing is running">
          The oldest job has been waiting since {formatDate(health.oldestQueuedAt, 'datetime')} (
          {relativeTime(health.oldestQueuedAt)}). Confirm the worker service is deployed and running
          — on Railway it should be a separate service using <code>npm run worker</code>.
        </Alert>
      ) : null}

      <Card className="p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          {includeDemo ? <input type="hidden" name="demo" value="1" /> : null}
          <div className="w-52">
            <label htmlFor="job-status" className="sr-only">
              Filter by status
            </label>
            <Select id="job-status" name="status" defaultValue={status ?? ''}>
              <option value="">All statuses</option>
              {Object.values(JobStatus).map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0) + value.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            Apply
          </Button>
        </form>
      </Card>

      {jobs.length === 0 ? (
        <Card>
          <EmptyState
            title="No jobs"
            description="Jobs appear here as customers create audits."
            className="border-0"
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--border)]">
            {jobs.map((job) => (
              <li key={job.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/audits/${job.auditId}`}
                        className="text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
                      >
                        {job.audit.businessName}
                      </Link>
                      <Badge tone={STATUS_TONE[job.status]}>{job.status.toLowerCase()}</Badge>
                      {job.audit.isDemo ? <Badge tone="demo">Demo</Badge> : null}
                      {job.creditRestored ? <Badge tone="neutral">Credit restored</Badge> : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">
                      {displayHost(job.audit.websiteUrl)} · {job.audit.user.email} · attempt{' '}
                      {job.attempts} of {job.maxAttempts}
                    </p>

                    {job.status === JobStatus.RUNNING ? (
                      <div className="mt-3 max-w-md">
                        <Progress value={job.progress} label="Job progress" />
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          {job.progressMessage ?? 'Processing…'} · locked by {job.lockedBy ?? '—'}
                        </p>
                      </div>
                    ) : null}

                    {job.lastError ? (
                      <pre tabIndex={0} className="mt-3 max-w-2xl overflow-x-auto rounded bg-[var(--surface-muted)] p-3 text-xs">
                        {job.lastError}
                      </pre>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {formatDate(job.updatedAt, 'datetime')}
                    </span>
                    <JobActions
                      auditId={job.auditId}
                      jobStatus={job.status}
                      archived={false}
                      compact
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </p>
      <p
        className={
          tone === 'danger'
            ? 'mt-2 text-2xl font-bold tabular-nums text-red-600 dark:text-red-400'
            : 'mt-2 text-2xl font-bold tabular-nums'
        }
      >
        {value}
      </p>
    </Card>
  );
}
