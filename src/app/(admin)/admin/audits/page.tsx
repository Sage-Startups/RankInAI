import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuditStatus, type Prisma } from '@prisma/client';
import { Search } from 'lucide-react';

import { Badge, Card, EmptyState, Input, Select, Skeleton } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { AuditStatusBadge } from '@/components/app/audit-status-badge';
import { DemoToggle } from '@/components/admin/demo-toggle';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { formatDate, displayHost } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin — audits',
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 25;

export default async function AdminAuditsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; demo?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const includeDemo = params.demo === '1';
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const status =
    params.status && params.status in AuditStatus ? (params.status as AuditStatus) : undefined;

  const where: Prisma.AuditWhereInput = {
    deletedAt: null,
    ...(includeDemo ? {} : { isDemo: false }),
    ...(status ? { status } : {}),
    ...(params.q
      ? {
          OR: [
            { businessName: { contains: params.q, mode: 'insensitive' } },
            { normalizedDomain: { contains: params.q, mode: 'insensitive' } },
            { user: { email: { contains: params.q, mode: 'insensitive' } } },
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
      include: {
        user: { select: { id: true, email: true } },
        job: { select: { status: true, progress: true, attempts: true } },
      },
    }),
    prisma.audit.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Audits</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {total} {total === 1 ? 'audit' : 'audits'} across all accounts.
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-10 w-56" />}>
          <DemoToggle includeDemo={includeDemo} />
        </Suspense>
      </header>

      <Card className="p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          {includeDemo ? <input type="hidden" name="demo" value="1" /> : null}
          <div className="min-w-56 flex-1">
            <label htmlFor="audit-q" className="sr-only">
              Search audits
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                aria-hidden="true"
              />
              <Input
                id="audit-q"
                name="q"
                defaultValue={params.q ?? ''}
                placeholder="Business, domain or customer email"
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-44">
            <label htmlFor="audit-status" className="sr-only">
              Status
            </label>
            <Select id="audit-status" name="status" defaultValue={status ?? ''}>
              <option value="">All statuses</option>
              {Object.values(AuditStatus).map((value) => (
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

      {audits.length === 0 ? (
        <Card>
          <EmptyState
            title="No audits found"
            description="Adjust the filters, or wait for customers to run audits."
            className="border-0"
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-4xl border-collapse text-left text-sm">
            <caption className="sr-only">All audits</caption>
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Audit
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Customer
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Score
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Attempts
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {audits.map((audit) => (
                <tr key={audit.id} className="border-b border-[var(--border)] last:border-0">
                  <th scope="row" className="px-5 py-3.5 font-normal">
                    <Link
                      href={`/admin/audits/${audit.id}`}
                      className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
                    >
                      {audit.businessName}
                    </Link>
                    <span className="block text-xs text-[var(--muted-foreground)]">
                      {displayHost(audit.websiteUrl)}
                    </span>
                    {audit.isDemo ? (
                      <Badge tone="demo" className="mt-1">
                        Demo
                      </Badge>
                    ) : null}
                  </th>
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/admin/users/${audit.user.id}`}
                      className="text-[var(--accent)] underline-offset-4 hover:underline"
                    >
                      {audit.user.email}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <AuditStatusBadge status={audit.status} />
                  </td>
                  <td className="px-5 py-3.5 tabular-nums">
                    {audit.overallScore ?? (audit.job ? `${audit.job.progress}%` : '—')}
                  </td>
                  <td className="px-5 py-3.5 text-[var(--muted-foreground)] tabular-nums">
                    {audit.job?.attempts ?? 0}
                  </td>
                  <td className="px-5 py-3.5 text-[var(--muted-foreground)]">
                    {formatDate(audit.createdAt, 'datetime')}
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
              <Link href={href(params, page - 1)}>Previous</Link>
            </Button>
            <Button asChild variant="secondary" size="sm" disabled={page >= totalPages}>
              <Link href={href(params, page + 1)}>Next</Link>
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function href(params: { q?: string; status?: string; demo?: string }, page: number): string {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.status) search.set('status', params.status);
  if (params.demo) search.set('demo', params.demo);
  search.set('page', String(Math.max(1, page)));
  return `/admin/audits?${search.toString()}`;
}
