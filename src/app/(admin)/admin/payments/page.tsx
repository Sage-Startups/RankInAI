import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PaymentStatus } from '@prisma/client';

import { Badge, Card, EmptyState, Skeleton } from '@/components/ui/primitives';
import { DemoToggle } from '@/components/admin/demo-toggle';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { formatDate, formatUsd } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin — payments',
  robots: { index: false, follow: false },
};

const TONE: Record<PaymentStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  SUCCEEDED: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  REFUNDED: 'neutral',
  PARTIALLY_REFUNDED: 'neutral',
};

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  await requireAdmin();
  const { demo } = await searchParams;
  const includeDemo = demo === '1';
  const where = includeDemo ? {} : { isDemo: false };

  const [payments, purchases, webhooks, totals] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: { user: { select: { id: true, email: true } }, purchases: true },
    }),
    prisma.purchase.count({ where }),
    prisma.stripeWebhookEvent.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 25,
    }),
    prisma.payment.aggregate({
      where: { ...where, status: PaymentStatus.SUCCEEDED },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {totals._count._all} successful payments totalling{' '}
            {formatUsd(totals._sum.amountCents ?? 0)} · {purchases} audit-credit purchases.
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-10 w-56" />}>
          <DemoToggle includeDemo={includeDemo} />
        </Suspense>
      </header>

      <p className="text-xs text-[var(--muted-foreground)]">
        RankInAI never handles card data. All card details and refunds are managed inside Stripe;
        this view reflects what Stripe has reported through webhooks.
      </p>

      {payments.length === 0 ? (
        <Card>
          <EmptyState
            title="No payments recorded"
            description="Payments appear here after Stripe confirms them through a webhook."
            className="border-0"
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-4xl border-collapse text-left text-sm">
            <caption className="sr-only">All payments</caption>
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Date
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Customer
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Product
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Amount
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Refunded
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Credits
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-[var(--border)] last:border-0">
                  <th scope="row" className="px-5 py-3 font-normal text-[var(--muted-foreground)]">
                    {formatDate(payment.paidAt ?? payment.createdAt, 'datetime')}
                  </th>
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/users/${payment.user.id}`}
                      className="text-[var(--accent)] underline-offset-4 hover:underline"
                    >
                      {payment.user.email}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    {payment.description ?? payment.kind.replace(/_/g, ' ').toLowerCase()}
                    {payment.isDemo ? (
                      <Badge tone="demo" className="ml-2">
                        Demo
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 font-semibold tabular-nums">
                    {formatUsd(payment.amountCents)}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={TONE[payment.status]}>
                      {payment.status.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-[var(--muted-foreground)] tabular-nums">
                    {payment.refundedCents > 0 ? formatUsd(payment.refundedCents) : '—'}
                  </td>
                  <td className="px-5 py-3 text-[var(--muted-foreground)] tabular-nums">
                    {payment.purchases.reduce((sum, p) => sum + p.creditsGranted, 0) || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card>
        <div className="border-b border-[var(--border)] p-5">
          <h2 className="text-base font-semibold">Stripe webhook history</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Every received event is recorded with a unique constraint on the Stripe event ID, so a
            duplicate delivery can never grant a credit twice.
          </p>
        </div>
        {webhooks.length === 0 ? (
          <p className="p-5 text-sm text-[var(--muted-foreground)]">
            No webhook events received yet. In billing test mode, checkout is fulfilled locally and
            no Stripe events are generated.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {webhooks.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-mono text-xs">{event.type}</span>
                    <Badge
                      tone={
                        event.status === 'PROCESSED'
                          ? 'success'
                          : event.status === 'FAILED'
                            ? 'danger'
                            : 'neutral'
                      }
                      className="ml-2"
                    >
                      {event.status.toLowerCase()}
                    </Badge>
                  </p>
                  <p className="truncate font-mono text-xs text-[var(--muted-foreground)]">
                    {event.stripeEventId}
                  </p>
                  {event.error ? (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{event.error}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                  {formatDate(event.receivedAt, 'datetime')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
