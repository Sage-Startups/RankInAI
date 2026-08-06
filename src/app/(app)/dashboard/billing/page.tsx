import type { Metadata } from 'next';
import Link from 'next/link';
import { PaymentStatus, SubscriptionStatus } from '@prisma/client';
import { Check } from 'lucide-react';

import { Alert, Badge, Card, EmptyState, Progress } from '@/components/ui/primitives';
import {
  BillingPortalButton,
  CheckoutButton,
} from '@/app/(app)/dashboard/billing/billing-buttons';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getEntitlements } from '@/lib/credits';
import { ALL_PRODUCTS, PRODUCTS, planLabel } from '@/lib/plans';
import { isBillingSimulated } from '@/lib/billing/stripe';
import { formatDate, formatUsd, cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Billing',
  robots: { index: false, follow: false },
};

const SUBSCRIPTION_STATUS_TONE: Record<SubscriptionStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success',
  TRIALING: 'success',
  PAST_DUE: 'warning',
  UNPAID: 'danger',
  CANCELED: 'neutral',
  INCOMPLETE: 'warning',
  PAUSED: 'neutral',
};

const PAYMENT_STATUS_TONE: Record<PaymentStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  SUCCEEDED: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  REFUNDED: 'neutral',
  PARTIALLY_REFUNDED: 'neutral',
};

export default async function BillingPage() {
  const user = await requireUser('/dashboard/billing');

  const [entitlements, subscription, payments, creditLedger] = await Promise.all([
    getEntitlements(user.id),
    prisma.subscription.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.auditCreditLedger.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const simulated = isBillingSimulated();
  const currentProductKey = ALL_PRODUCTS.find((p) => p.plan === entitlements.plan)?.key;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Your plan, usage, credits and payment history. All amounts in US dollars.
        </p>
      </header>

      {simulated ? (
        <Alert tone="warning" title="Billing test mode is active">
          Checkout is simulated locally and no payment is taken. Entitlements are applied through
          the same code path the Stripe webhook uses, so the flow is identical — but nothing is
          charged and no Stripe record is created.
        </Alert>
      ) : null}

      {/* Current plan */}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Current plan
              </p>
              <h2 className="mt-1 text-xl font-bold">{planLabel(entitlements.plan)}</h2>
            </div>
            {subscription ? (
              <Badge tone={SUBSCRIPTION_STATUS_TONE[subscription.status]}>
                {subscription.status.replace(/_/g, ' ').toLowerCase()}
              </Badge>
            ) : (
              <Badge tone="neutral">No subscription</Badge>
            )}
          </div>

          {entitlements.entitlements.auditsPerPeriod > 0 ? (
            <div className="mt-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-[var(--muted-foreground)]">
                  Audits used this period
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {entitlements.auditsUsedThisPeriod} / {entitlements.entitlements.auditsPerPeriod}
                </span>
              </div>
              <Progress
                value={
                  (entitlements.auditsUsedThisPeriod / entitlements.entitlements.auditsPerPeriod) *
                  100
                }
                label="Plan allowance used"
                className="mt-2.5"
              />
            </div>
          ) : (
            <p className="mt-5 text-sm text-[var(--muted-foreground)]">
              You are not on a monthly plan. Buy a one-time audit below, or subscribe for a monthly
              allowance.
            </p>
          )}

          <dl className="mt-6 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <Field
              label="Renewal date"
              value={
                subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : '—'
              }
            />
            <Field
              label="Cancels at period end"
              value={subscription?.cancelAtPeriodEnd ? 'Yes' : 'No'}
            />
            <Field label="One-time credits" value={String(entitlements.oneTimeCredits)} />
            <Field
              label="Total audits available"
              value={String(entitlements.totalAuditsAvailable)}
            />
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <BillingPortalButton
              disabled={simulated || !user.stripeCustomerId}
              reason={
                simulated
                  ? 'The Stripe Customer Portal is unavailable while billing test mode is active.'
                  : !user.stripeCustomerId
                    ? 'A billing account is created with your first purchase.'
                    : undefined
              }
            />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold">Need another audit now?</h2>
          <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
            One-time credits never expire and are used only after your plan allowance for the
            period.
          </p>
          <p className="mt-5 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tabular-nums">
              {formatUsd(PRODUCTS.ONE_TIME_AUDIT.priceCents)}
            </span>
            <span className="text-sm text-[var(--muted-foreground)]">one-time</span>
          </p>
          <CheckoutButton
            productKey="ONE_TIME_AUDIT"
            label="Buy one audit credit"
            className="mt-5"
          />
          <ul className="mt-5 space-y-2">
            {PRODUCTS.ONE_TIME_AUDIT.features.slice(0, 5).map((feature) => (
              <li key={feature} className="flex gap-2.5 text-xs text-[var(--muted-foreground)]">
                <Check className="mt-0.5 size-3.5 shrink-0 text-violet-500" aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Plan options */}
      <Card>
        <div className="border-b border-[var(--border)] p-5">
          <h2 className="text-base font-semibold">Monthly plans</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Upgrade or downgrade at any time. Changing plans resets your period allowance to the new
            tier.
          </p>
        </div>
        <div className="grid gap-5 p-5 md:grid-cols-3">
          {ALL_PRODUCTS.filter((p) => p.interval === 'month').map((product) => {
            const isCurrent = currentProductKey === product.key && entitlements.subscriptionActive;
            return (
              <div
                key={product.key}
                className={cn(
                  'rounded-xl border p-5',
                  isCurrent
                    ? 'border-violet-500/50 bg-violet-500/5'
                    : product.mostPopular
                      ? 'border-[var(--border-strong)]'
                      : 'border-[var(--border)]',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{product.name}</h3>
                  {isCurrent ? (
                    <Badge tone="accent">Current</Badge>
                  ) : product.mostPopular ? (
                    <Badge tone="neutral">Most popular</Badge>
                  ) : null}
                </div>
                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tabular-nums">
                    {formatUsd(product.priceCents)}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)]">/ month</span>
                </p>
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                  {product.entitlements.auditsPerPeriod} audits · {product.entitlements.pageLimit}{' '}
                  pages · {product.entitlements.competitorLimit} competitors
                </p>
                {isCurrent ? (
                  <p className="mt-4 text-xs text-[var(--muted-foreground)]">
                    Manage or cancel this plan from the billing portal.
                  </p>
                ) : (
                  <CheckoutButton
                    productKey={product.key}
                    label={
                      entitlements.subscriptionActive
                        ? `Switch to ${product.name}`
                        : `Choose ${product.name}`
                    }
                    variant={product.mostPopular ? 'primary' : 'secondary'}
                    className="mt-4"
                  />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Payment history */}
      <Card>
        <div className="border-b border-[var(--border)] p-5">
          <h2 className="text-base font-semibold">Payment history</h2>
        </div>
        {payments.length === 0 ? (
          <EmptyState
            title="No payments yet"
            description="Purchases and subscription charges appear here once processed."
            className="m-5 border-0"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl border-collapse text-left text-sm">
              <caption className="sr-only">Your payment history</caption>
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                  <th scope="col" className="px-5 py-3 font-semibold">Date</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Description</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Amount</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-[var(--border)] last:border-0">
                    <th scope="row" className="px-5 py-3 font-normal text-[var(--muted-foreground)]">
                      {formatDate(payment.paidAt ?? payment.createdAt)}
                    </th>
                    <td className="px-5 py-3">
                      {payment.description ?? 'RankInAI purchase'}
                      {payment.isDemo ? (
                        <Badge tone="demo" className="ml-2">
                          Demo
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 tabular-nums">{formatUsd(payment.amountCents)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={PAYMENT_STATUS_TONE[payment.status]}>
                        {payment.status.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Credit ledger */}
      {creditLedger.length > 0 ? (
        <Card>
          <div className="border-b border-[var(--border)] p-5">
            <h2 className="text-base font-semibold">Recent credit activity</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Every change to your one-time credit balance, including automatic refunds for failed
              audits.
            </p>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {creditLedger.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm">{entry.note ?? entry.reason.replace(/_/g, ' ').toLowerCase()}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {formatDate(entry.createdAt, 'datetime')}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      entry.delta > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-[var(--muted-foreground)]',
                    )}
                  >
                    {entry.delta > 0 ? '+' : ''}
                    {entry.delta}
                  </span>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    balance {entry.balanceAfter}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="text-center text-xs text-[var(--muted-foreground)]">
        Payments are processed by Stripe. RankInAI never receives or stores your card details. See
        the{' '}
        <Link href="/legal/refunds" className="underline underline-offset-4">
          Refund Policy
        </Link>{' '}
        for how refunds work.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-2">
      <dt className="text-[var(--muted-foreground)]">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
