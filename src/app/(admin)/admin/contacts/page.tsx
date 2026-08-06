import type { Metadata } from 'next';
import { ContactStatus, type Prisma } from '@prisma/client';

import { Badge, Card, EmptyState, Select } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { ContactStatusButtons } from '@/components/admin/contact-status-buttons';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin — contacts',
  robots: { index: false, follow: false },
};

const TONE: Record<ContactStatus, 'info' | 'neutral' | 'success' | 'warning' | 'danger'> = {
  NEW: 'info',
  READ: 'neutral',
  RESPONDED: 'success',
  ARCHIVED: 'neutral',
  SPAM: 'danger',
};

export default async function AdminContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const status =
    params.status && params.status in ContactStatus ? (params.status as ContactStatus) : undefined;

  const where: Prisma.ContactSubmissionWhereInput = status ? { status } : {};

  const [submissions, counts] = await Promise.all([
    prisma.contactSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: { handledBy: { select: { email: true } } },
    }),
    prisma.contactSubmission.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const countFor = (value: ContactStatus) =>
    counts.find((row) => row.status === value)?._count._all ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Contact submissions</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {countFor(ContactStatus.NEW)} unread ·{' '}
          {counts.reduce((sum, row) => sum + row._count._all, 0)} total.
        </p>
      </header>

      <Card className="p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="w-52">
            <label htmlFor="contact-status" className="sr-only">
              Filter by status
            </label>
            <Select id="contact-status" name="status" defaultValue={status ?? ''}>
              <option value="">All statuses</option>
              {Object.values(ContactStatus).map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0) + value.slice(1).toLowerCase()} ({countFor(value)})
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            Apply
          </Button>
        </form>
      </Card>

      {submissions.length === 0 ? (
        <Card>
          <EmptyState
            title="No submissions"
            description="Messages sent through the public contact form appear here."
            className="border-0"
          />
        </Card>
      ) : (
        <ul className="space-y-4">
          {submissions.map((submission) => (
            <li key={submission.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold">{submission.subject}</h2>
                      <Badge tone={TONE[submission.status]}>
                        {submission.status.toLowerCase()}
                      </Badge>
                      {submission.isDemo ? <Badge tone="demo">Demo</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {submission.name}
                      {submission.company ? ` · ${submission.company}` : ''} ·{' '}
                      <a
                        href={`mailto:${submission.email}`}
                        className="text-[var(--accent)] underline-offset-4 hover:underline"
                      >
                        {submission.email}
                      </a>
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                    {formatDate(submission.createdAt, 'datetime')}
                  </span>
                </div>

                <p className="mt-4 rounded-lg bg-[var(--surface-muted)] p-4 text-sm leading-relaxed whitespace-pre-line">
                  {submission.message}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <ContactStatusButtons id={submission.id} current={submission.status} />
                  {submission.handledBy ? (
                    <span className="text-xs text-[var(--muted-foreground)]">
                      Handled by {submission.handledBy.email}
                      {submission.handledAt ? ` · ${formatDate(submission.handledAt)}` : ''}
                    </span>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
