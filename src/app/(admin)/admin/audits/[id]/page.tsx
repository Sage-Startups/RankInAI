import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AuditStatus } from '@prisma/client';
import { ArrowLeft, Download } from 'lucide-react';

import { Alert, Badge, Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { AuditStatusBadge } from '@/components/app/audit-status-badge';
import { JobActions } from '@/components/admin/job-actions';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { formatDate, displayHost } from '@/lib/utils';
import { CATEGORY_LABELS, SEVERITY_LABELS } from '@/lib/audit/types';

export const metadata: Metadata = {
  title: 'Admin — audit detail',
  robots: { index: false, follow: false },
};

export default async function AdminAuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const audit = await prisma.audit.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true } },
      job: true,
      scores: true,
      competitors: true,
      pages: { orderBy: { createdAt: 'asc' } },
      findings: { orderBy: { sortOrder: 'asc' } },
      reports: { orderBy: { version: 'desc' } },
      creditEntries: { orderBy: { createdAt: 'desc' } },
      _count: { select: { findings: true, recommendations: true, pages: true } },
    },
  });

  if (!audit) notFound();

  const report = audit.reports[0];

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/audits">
            <ArrowLeft aria-hidden="true" />
            All audits
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{audit.businessName}</h1>
            <AuditStatusBadge status={audit.status} />
            {audit.isDemo ? <Badge tone="demo">Demo</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {displayHost(audit.websiteUrl)} · Owned by{' '}
            <Link
              href={`/admin/users/${audit.user.id}`}
              className="text-[var(--accent)] underline-offset-4 hover:underline"
            >
              {audit.user.email}
            </Link>
          </p>
          <p className="mt-0.5 font-mono text-xs text-[var(--muted-foreground)]">{audit.id}</p>
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
          <JobActions
            auditId={audit.id}
            jobStatus={audit.job?.status ?? null}
            archived={Boolean(audit.archivedAt)}
          />
        </div>
      </header>

      {audit.status === AuditStatus.FAILED ? (
        <Alert tone="danger" title="Audit failed">
          <p>
            <strong>Code:</strong> {audit.failureCode ?? 'unknown'}
          </p>
          <p className="mt-1">
            <strong>Customer message:</strong> {audit.failureMessage ?? '—'}
          </p>
          {audit.job?.lastError ? (
            <pre tabIndex={0} className="mt-3 overflow-x-auto rounded bg-[var(--surface-muted)] p-3 text-xs">
              {audit.job.lastError}
            </pre>
          ) : null}
          <p className="mt-3 text-xs">
            Credit restored: <strong>{audit.job?.creditRestored ? 'yes' : 'no'}</strong> · Attempts:{' '}
            {audit.job?.attempts ?? 0} of {audit.job?.maxAttempts ?? 0}
          </p>
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Audit</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Score" value={audit.overallScore != null ? String(audit.overallScore) : '—'} />
            <Row label="Previous score" value={audit.previousScore != null ? String(audit.previousScore) : '—'} />
            <Row label="Plan at creation" value={audit.planAtCreation} />
            <Row label="Credit source" value={audit.creditSource.replace(/_/g, ' ').toLowerCase()} />
            <Row label="Page limit" value={String(audit.pageLimit)} />
            <Row label="Competitor limit" value={String(audit.competitorLimit)} />
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Job</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Status" value={audit.job?.status ?? '—'} />
            <Row label="Progress" value={`${audit.job?.progress ?? 0}%`} />
            <Row label="Step" value={audit.job?.currentStep ?? '—'} />
            <Row
              label="Attempts"
              value={`${audit.job?.attempts ?? 0} / ${audit.job?.maxAttempts ?? 0}`}
            />
            <Row label="Locked by" value={audit.job?.lockedBy ?? 'none'} />
            <Row
              label="Started"
              value={audit.job?.startedAt ? formatDate(audit.job.startedAt, 'datetime') : '—'}
            />
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Output</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Pages recorded" value={String(audit._count.pages)} />
            <Row label="Findings" value={String(audit._count.findings)} />
            <Row label="Recommendations" value={String(audit._count.recommendations)} />
            <Row label="LLM enhanced" value={audit.llmEnhanced ? (audit.llmModel ?? 'yes') : 'no'} />
            <Row label="Search provider" value={audit.searchProvider ?? 'none'} />
            <Row
              label="PDF"
              value={
                report?.pdfBytes
                  ? `${Math.round(report.pdfBytes / 1024)} KB · ${report.downloadCount} downloads`
                  : report?.pdfError
                    ? 'generation failed'
                    : 'not generated yet'
              }
            />
          </dl>
        </Card>
      </div>

      {report?.pdfError ? (
        <Alert tone="warning" title="PDF generation error">
          <pre tabIndex={0} className="overflow-x-auto text-xs">{report.pdfError}</pre>
        </Alert>
      ) : null}

      {/* Scores */}
      {audit.scores.length > 0 ? (
        <Card>
          <div className="border-b border-[var(--border)] p-5">
            <h2 className="text-base font-semibold">Category scores</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl border-collapse text-left text-sm">
              <caption className="sr-only">Category scores for this audit</caption>
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                  <th scope="col" className="px-5 py-3 font-semibold">Category</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Score</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Points</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Base weight</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Effective weight</th>
                </tr>
              </thead>
              <tbody>
                {audit.scores.map((score) => (
                  <tr key={score.id} className="border-b border-[var(--border)] last:border-0">
                    <th scope="row" className="px-5 py-3 font-normal">
                      {CATEGORY_LABELS[score.category]}
                      {!score.available ? (
                        <Badge tone="neutral" className="ml-2">
                          unavailable
                        </Badge>
                      ) : null}
                    </th>
                    <td className="px-5 py-3 font-semibold tabular-nums">
                      {score.available ? score.score : '—'}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-[var(--muted-foreground)]">
                      {score.rawPoints} / {score.maxPoints}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-[var(--muted-foreground)]">
                      {Math.round(score.baseWeight * 100)}%
                    </td>
                    <td className="px-5 py-3 tabular-nums text-[var(--muted-foreground)]">
                      {Math.round(score.effectiveWeight * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {/* Evidence */}
      {audit.findings.length > 0 ? (
        <Card>
          <div className="border-b border-[var(--border)] p-5">
            <h2 className="text-base font-semibold">Raw evidence</h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Exactly what the audit engine observed, for debugging a disputed finding.
            </p>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {audit.findings.map((finding) => (
              <li key={finding.id} className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{finding.checkId}</span>
                  <Badge
                    tone={
                      finding.status === 'PASS'
                        ? 'success'
                        : finding.status === 'FAIL'
                          ? 'danger'
                          : finding.status === 'WARN'
                            ? 'warning'
                            : 'neutral'
                    }
                  >
                    {SEVERITY_LABELS[finding.severity]}
                  </Badge>
                  <span className="text-sm">{finding.title}</span>
                  <span className="ml-auto text-xs tabular-nums text-[var(--muted-foreground)]">
                    {finding.pointsAwarded} / {finding.pointsPossible}
                  </span>
                </div>
                <pre tabIndex={0} className="mt-2.5 overflow-x-auto rounded bg-[var(--surface-muted)] p-3 text-xs">
                  {JSON.stringify(finding.evidence, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Credit entries */}
      {audit.creditEntries.length > 0 ? (
        <Card>
          <div className="border-b border-[var(--border)] p-5">
            <h2 className="text-base font-semibold">Credit activity for this audit</h2>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {audit.creditEntries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div>
                  <p className="text-sm">{entry.note ?? entry.reason}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {formatDate(entry.createdAt, 'datetime')}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {entry.delta > 0 ? '+' : ''}
                  {entry.delta} → {entry.balanceAfter}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-2">
      <dt className="shrink-0 text-[var(--muted-foreground)]">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
