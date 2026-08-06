import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AuditStatus } from '@prisma/client';
import { AlertTriangle, ArrowLeft, Download, RefreshCw } from 'lucide-react';

import { Alert, Badge, Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { AuditStatusBadge } from '@/components/app/audit-status-badge';
import { AuditProgress } from '@/app/(app)/dashboard/audits/[id]/audit-progress';
import { AuditDetailActions } from '@/app/(app)/dashboard/audits/[id]/audit-detail-actions';
import { ReportView } from '@/components/report/report-view';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { buildReportData } from '@/lib/report/build';
import { formatDate, displayHost } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Audit report',
  robots: { index: false, follow: false },
};

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/audits/${id}`);

  const audit = await prisma.audit.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    include: { job: true },
  });

  if (!audit) notFound();

  const inProgress = audit.status === AuditStatus.QUEUED || audit.status === AuditStatus.RUNNING;
  const report = audit.status === AuditStatus.COMPLETED ? await buildReportData(audit.id) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="no-print">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/audits">
            <ArrowLeft aria-hidden="true" />
            All audits
          </Link>
        </Button>
      </div>

      <header className="no-print flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{audit.businessName}</h1>
            <AuditStatusBadge status={audit.status} />
            {audit.archivedAt ? <Badge tone="neutral">Archived</Badge> : null}
            {audit.isDemo ? <Badge tone="demo">Demo data</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {displayHost(audit.websiteUrl)} · Created {formatDate(audit.createdAt, 'datetime')}
            {audit.completedAt ? ` · Completed ${formatDate(audit.completedAt, 'datetime')}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {audit.status === AuditStatus.COMPLETED ? (
            <Button asChild variant="secondary">
              <a href={`/api/reports/${audit.id}/pdf`} download>
                <Download aria-hidden="true" />
                Download PDF
              </a>
            </Button>
          ) : null}
          <AuditDetailActions
            auditId={audit.id}
            archived={Boolean(audit.archivedAt)}
            canRerun={audit.status === AuditStatus.COMPLETED || audit.status === AuditStatus.FAILED}
          />
        </div>
      </header>

      {inProgress ? (
        <AuditProgress
          auditId={audit.id}
          initialProgress={audit.job?.progress ?? 0}
          initialMessage={audit.job?.progressMessage ?? 'Waiting for an available worker'}
          initialStatus={audit.status}
          pageLimit={audit.pageLimit}
        />
      ) : null}

      {audit.status === AuditStatus.FAILED ? (
        <Alert tone="danger" title="This audit could not be completed">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div>
              <p>{audit.failureMessage ?? 'The audit failed for an unknown reason.'}</p>
              {audit.job?.creditRestored ? (
                <p className="mt-2 font-medium text-[var(--foreground)]">
                  Your audit credit has been returned to your account automatically.
                </p>
              ) : null}
              <p className="mt-3 text-xs">
                If you believe this is a mistake, fix the issue above and re-run the audit, or{' '}
                <Link href="/contact" className="underline underline-offset-4">
                  contact support
                </Link>{' '}
                quoting audit ID <code className="font-mono">{audit.id}</code>.
              </p>
            </div>
          </div>
        </Alert>
      ) : null}

      {audit.status === AuditStatus.CANCELED ? (
        <Alert tone="warning" title="This audit was canceled">
          The audit was canceled before it started processing and the credit was returned to your
          account.
        </Alert>
      ) : null}

      {report ? (
        <ReportView data={report} />
      ) : audit.status === AuditStatus.COMPLETED ? (
        <Card className="p-6">
          <p className="text-sm text-[var(--muted-foreground)]">
            This audit completed but its report data could not be loaded. Please contact support.
          </p>
        </Card>
      ) : null}

      {inProgress ? (
        <Card className="p-6">
          <h2 className="text-base font-semibold">What happens next</h2>
          <ol className="mt-3 space-y-2 text-sm text-[var(--muted-foreground)]">
            <li>1. A worker picks up the job from the queue.</li>
            <li>
              2. Up to {audit.pageLimit} public pages are crawled, along with robots.txt, your
              sitemap and llms.txt.
            </li>
            <li>3. Around seventy checks score the seven audit categories.</li>
            <li>4. Findings become a prioritized action plan and the report is saved here.</li>
          </ol>
          <p className="mt-4 text-xs text-[var(--muted-foreground)]">
            You can safely close this page — the audit continues in the background and appears in
            your audit list when it finishes.
          </p>
          <Button asChild variant="secondary" size="sm" className="mt-4">
            <Link href="/dashboard/audits">
              <RefreshCw aria-hidden="true" />
              Back to audit list
            </Link>
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
