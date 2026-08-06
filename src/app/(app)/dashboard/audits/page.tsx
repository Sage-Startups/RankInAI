import type { Metadata } from 'next';
import Link from 'next/link';
import { AuditStatus, type Prisma } from '@prisma/client';
import { FileSearch, FilePlus2, Search } from 'lucide-react';

import { Badge, Card, EmptyState, Input, Select } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { AuditStatusBadge } from '@/components/app/audit-status-badge';
import { AuditRowActions } from '@/app/(app)/dashboard/audits/audit-row-actions';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { formatDate, displayHost } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Audits',
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 20;

const CREDIT_SOURCE_LABELS: Record<string, string> = {
  ONE_TIME_CREDIT: 'One-time credit',
  SUBSCRIPTION_ALLOWANCE: 'Plan allowance',
  ADMIN_GRANT: 'Admin grant',
  DEMO: 'Demo',
};

export default async function AuditsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; archived?: string }>;
}) {
  const user = await requireUser('/dashboard/audits');
  const params = await searchParams;

  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const query = (params.q ?? '').trim();
  const statusFilter =
    params.status && params.status in AuditStatus ? (params.status as AuditStatus) : undefined;
  const showArchived = params.archived === '1';

  const where: Prisma.AuditWhereInput = {
    userId: user.id,
    deletedAt: null,
    ...(showArchived ? {} : { archivedAt: null }),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(query
      ? {
          OR: [
            { businessName: { contains: query, mode: 'insensitive' } },
            { websiteUrl: { contains: query, mode: 'insensitive' } },
            { normalizedDomain: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [audits, total] = await Promise.all([
    prisma.audit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { job: { select: { progress: true, status: true } } },
    }),
    prisma.audit.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(query || statusFilter || showArchived);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Audits</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {total} {total === 1 ? 'audit' : 'audits'}
            {hasFilters ? ' matching your filters' : ' in your account'}.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/audits/new">
            <FilePlus2 aria-hidden="true" />
            New audit
          </Link>
        </Button>
      </header>

      <Card className="p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <label htmlFor="audit-search" className="sr-only">
              Search audits
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                aria-hidden="true"
              />
              <Input
                id="audit-search"
                name="q"
                defaultValue={query}
                placeholder="Search by business or website"
                className="pl-9"
              />
            </div>
          </div>

          <div className="w-44">
            <label htmlFor="audit-status" className="sr-only">
              Filter by status
            </label>
            <Select id="audit-status" name="status" defaultValue={statusFilter ?? ''}>
              <option value="">All statuses</option>
              {Object.values(AuditStatus).map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0) + status.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-40">
            <label htmlFor="audit-archived" className="sr-only">
              Archived audits
            </label>
            <Select id="audit-archived" name="archived" defaultValue={showArchived ? '1' : ''}>
              <option value="">Active only</option>
              <option value="1">Include archived</option>
            </Select>
          </div>

          <Button type="submit" variant="secondary">
            Apply
          </Button>
          {hasFilters ? (
            <Button asChild variant="ghost">
              <Link href="/dashboard/audits">Clear</Link>
            </Button>
          ) : null}
        </form>
      </Card>

      {audits.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileSearch className="size-6" aria-hidden="true" />}
            title={hasFilters ? 'No audits match those filters' : 'No audits yet'}
            description={
              hasFilters
                ? 'Try a different search term or clear the filters to see everything in your account.'
                : 'Run your first audit to see how well AI systems can discover, understand and cite your website.'
            }
            action={
              hasFilters ? (
                <Button asChild variant="secondary">
                  <Link href="/dashboard/audits">Clear filters</Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/dashboard/audits/new">Start your first audit</Link>
                </Button>
              )
            }
            className="border-0"
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-4xl border-collapse text-left text-sm">
            <caption className="sr-only">Your audits</caption>
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Business
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Website
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Score
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Date
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Used
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {audits.map((audit) => (
                <tr key={audit.id} className="border-b border-[var(--border)] last:border-0">
                  <th scope="row" className="px-5 py-3.5 font-normal">
                    <Link
                      href={`/dashboard/audits/${audit.id}`}
                      className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
                    >
                      {audit.businessName}
                    </Link>
                    {audit.archivedAt ? (
                      <Badge tone="neutral" className="ml-2">
                        Archived
                      </Badge>
                    ) : null}
                  </th>
                  <td className="px-5 py-3.5 text-[var(--muted-foreground)]">
                    {displayHost(audit.websiteUrl)}
                  </td>
                  <td className="px-5 py-3.5">
                    {audit.overallScore != null ? (
                      <span className="font-bold tabular-nums">{audit.overallScore}</span>
                    ) : audit.status === AuditStatus.RUNNING ? (
                      <span className="text-xs text-[var(--muted-foreground)] tabular-nums">
                        {audit.job?.progress ?? 0}%
                      </span>
                    ) : (
                      <span className="text-[var(--muted-foreground)]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <AuditStatusBadge status={audit.status} />
                  </td>
                  <td className="px-5 py-3.5 text-[var(--muted-foreground)]">
                    {formatDate(audit.createdAt)}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[var(--muted-foreground)]">
                    {CREDIT_SOURCE_LABELS[audit.creditSource] ?? audit.creditSource}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <AuditRowActions
                      auditId={audit.id}
                      archived={Boolean(audit.archivedAt)}
                      completed={audit.status === AuditStatus.COMPLETED}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-4" aria-label="Pagination">
          <p className="text-sm text-[var(--muted-foreground)]">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm" disabled={page <= 1}>
              <Link
                href={buildPageHref(params, page - 1)}
                aria-disabled={page <= 1}
                tabIndex={page <= 1 ? -1 : undefined}
              >
                Previous
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm" disabled={page >= totalPages}>
              <Link
                href={buildPageHref(params, page + 1)}
                aria-disabled={page >= totalPages}
                tabIndex={page >= totalPages ? -1 : undefined}
              >
                Next
              </Link>
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function buildPageHref(
  params: { q?: string; status?: string; archived?: string },
  page: number,
): string {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.status) search.set('status', params.status);
  if (params.archived) search.set('archived', params.archived);
  search.set('page', String(Math.max(1, page)));
  return `/dashboard/audits?${search.toString()}`;
}
