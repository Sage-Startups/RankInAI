import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  FileCheck2,
  Repeat,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';

import {
  AuditsChart,
  ConversionFunnel,
  RevenueChart,
  SignupChart,
} from '@/components/admin/charts';
import { DemoMetricCard } from '@/components/admin/demo-metric-card';
import { Badge, Card } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/guards';
import {
  GROWTH_PRICE_CENTS,
  ONE_TIME_PRICE_CENTS,
  SIMULATED_FEE_FLAT_CENTS,
  SIMULATED_FEE_PERCENT,
  STARTER_PRICE_CENTS,
  simulatedFeeCents,
  SUMMER_2026_WINDOW,
  SUMMER_MONTHS,
  SUMMER_SERIES,
  SUMMER_SNAPSHOT_BANNER,
  SUMMER_SNAPSHOT_NOTES,
  SUMMER_SUBSCRIPTIONS,
  SUMMER_TOTALS,
  SUMMER_TRANSACTIONS,
} from '@/lib/demo/summer-snapshot';
import { formatDate, formatUsd } from '@/lib/utils';

/**
 * One-page demonstration snapshot: three one-time Full Audits, a Starter
 * subscription started in June, and a Growth subscription started in July.
 *
 * Sits inside the admin area, so it is behind `requireAdmin` like every other
 * admin route. Every figure is fabricated, and the page says so in an
 * unremovable banner — there is deliberately no way to turn that labeling off.
 */
export const metadata: Metadata = {
  title: 'Admin — demo revenue snapshot',
  robots: { index: false, follow: false },
};

export default async function AdminDemoSnapshotPage() {
  await requireAdmin();

  // Audits completed is deliberately NOT a funnel step: the subscriptions
  // produce many audits per customer, so the count rises at the end and a
  // funnel that grows reads as an error. It is a headline figure instead.
  const funnelSteps = [
    { label: 'Demo runs', value: SUMMER_TOTALS.demoRuns },
    { label: 'Homepage previews', value: SUMMER_TOTALS.previewRuns },
    { label: 'Sign-ups', value: SUMMER_TOTALS.signups },
    {
      label: 'Paying customers',
      value: SUMMER_TOTALS.oneTimeSales + SUMMER_TOTALS.activeSubscriptions,
    },
  ];

  const windowLabel = `${formatDate(SUMMER_2026_WINDOW.from, 'long')} – ${formatDate(SUMMER_2026_WINDOW.to, 'long')}`;

  return (
    <div className="space-y-6">
      <div
        role="alert"
        className="flex items-center justify-center gap-2.5 rounded-lg border-2 border-amber-600 bg-amber-500 px-4 py-3 text-center"
      >
        <AlertTriangle className="size-5 shrink-0 text-amber-950" aria-hidden="true" />
        <p className="text-xs leading-relaxed font-bold tracking-wide text-amber-950 uppercase sm:text-sm">
          {SUMMER_SNAPSHOT_BANNER}
        </p>
      </div>

      <header>
        <h1 className="text-2xl font-bold">Demonstration revenue snapshot</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--muted-foreground)]">
          {windowLabel}. Three one-time Full Audits, a Starter subscription from June and a Growth
          subscription from July — a small dataset that shows both revenue types working end to end,
          with the recurring layer compounding month over month. Nothing on this page is real
          revenue, a real customer or a forecast.
        </p>
      </header>

      {/* Headline figures */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DemoMetricCard
          icon={TrendingUp}
          label="Demonstration gross revenue"
          value={formatUsd(SUMMER_TOTALS.grossRevenueCents)}
          detail={`${formatUsd(SUMMER_TOTALS.oneTimeRevenueCents)} one-time + ${formatUsd(SUMMER_TOTALS.subscriptionRevenueCents)} recurring; ${formatUsd(SUMMER_TOTALS.netRevenueCents)} net of simulated fees`}
          badge={false}
        />
        <DemoMetricCard
          icon={ShoppingCart}
          label="One-time Full Audits"
          value={String(SUMMER_TOTALS.oneTimeSales)}
          detail={`${formatUsd(ONE_TIME_PRICE_CENTS)} each, ${SUMMER_TOTALS.oneTimeSales} customers`}
          badge={false}
        />
        <DemoMetricCard
          icon={Repeat}
          label="Active subscriptions"
          value={String(SUMMER_TOTALS.activeSubscriptions)}
          detail={`Starter ${formatUsd(STARTER_PRICE_CENTS)}/mo + Growth ${formatUsd(GROWTH_PRICE_CENTS)}/mo, ${SUMMER_TOTALS.subscriptionInvoices} invoices`}
          badge={false}
        />
        <DemoMetricCard
          icon={FileCheck2}
          label="Audits completed"
          value={String(SUMMER_TOTALS.auditsCompleted)}
          detail={`${SUMMER_TOTALS.oneTimeSales} from credits, ${SUMMER_TOTALS.auditsCompleted - SUMMER_TOTALS.oneTimeSales} from the subscriptions`}
          badge={false}
        />
      </div>

      {/* Month by month */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-5">
          <div>
            <h2 className="text-base font-semibold">Month by month</h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Fees are simulated at standard card pricing — {SIMULATED_FEE_PERCENT}% +{' '}
              {formatUsd(SIMULATED_FEE_FLAT_CENTS)} per charge. No processor was involved; real fees
              exist only in a real Stripe account&apos;s own reporting.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-2xl border-collapse text-left text-sm">
            <caption className="sr-only">
              Fabricated demonstration revenue by month for June and July 2026
            </caption>
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Month
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Sign-ups
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  One-time audits
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  One-time revenue
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Subscription revenue
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Gross
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Fees (simulated)
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Net
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Audits completed
                </th>
              </tr>
            </thead>
            <tbody>
              {SUMMER_MONTHS.map((month) => (
                <tr key={month.key} className="border-b border-[var(--border)] last:border-0">
                  <th scope="row" className="px-5 py-3 font-medium">
                    {month.label}
                  </th>
                  <td className="px-5 py-3 tabular-nums">{month.signups}</td>
                  <td className="px-5 py-3 tabular-nums">{month.oneTimeSales}</td>
                  <td className="px-5 py-3 tabular-nums">{formatUsd(month.oneTimeRevenueCents)}</td>
                  <td className="px-5 py-3 tabular-nums">
                    {formatUsd(month.subscriptionRevenueCents)}
                  </td>
                  <td className="px-5 py-3 font-semibold tabular-nums">
                    {formatUsd(month.grossRevenueCents)}
                  </td>
                  <td className="px-5 py-3 text-[var(--muted-foreground)] tabular-nums">
                    −{formatUsd(month.simulatedFeeCents)}
                  </td>
                  <td className="px-5 py-3 font-semibold tabular-nums">
                    {formatUsd(month.netRevenueCents)}
                  </td>
                  <td className="px-5 py-3 tabular-nums">{month.auditsCompleted}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--border-strong)] bg-[var(--surface-muted)]">
                <th scope="row" className="px-5 py-3 font-semibold">
                  Total
                </th>
                <td className="px-5 py-3 font-bold tabular-nums">{SUMMER_TOTALS.signups}</td>
                <td className="px-5 py-3 font-bold tabular-nums">{SUMMER_TOTALS.oneTimeSales}</td>
                <td className="px-5 py-3 font-bold tabular-nums">
                  {formatUsd(SUMMER_TOTALS.oneTimeRevenueCents)}
                </td>
                <td className="px-5 py-3 font-bold tabular-nums">
                  {formatUsd(SUMMER_TOTALS.subscriptionRevenueCents)}
                </td>
                <td className="px-5 py-3 font-bold tabular-nums">
                  {formatUsd(SUMMER_TOTALS.grossRevenueCents)}
                </td>
                <td className="px-5 py-3 font-bold text-[var(--muted-foreground)] tabular-nums">
                  −{formatUsd(SUMMER_TOTALS.simulatedFeeCents)}
                </td>
                <td className="px-5 py-3 font-bold tabular-nums">
                  {formatUsd(SUMMER_TOTALS.netRevenueCents)}
                </td>
                <td className="px-5 py-3 font-bold tabular-nums">
                  {SUMMER_TOTALS.auditsCompleted}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Charts */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Daily demonstration revenue</h2>
        </div>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          The {formatUsd(STARTER_PRICE_CENTS)} points are the Starter subscription billing in June
          and again in July; the {formatUsd(GROWTH_PRICE_CENTS)} point is the Growth subscription
          starting in July; the {formatUsd(ONE_TIME_PRICE_CENTS)} points are the one-time audits.
        </p>
        <div className="mt-4">
          <RevenueChart
            data={SUMMER_SERIES}
            title="Daily demonstration revenue for June and July 2026"
          />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Sign-up activity</h2>
          </div>
          <div className="mt-4">
            <SignupChart
              data={SUMMER_SERIES}
              title="Daily demonstration sign-ups for June and July 2026"
            />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Audits created</h2>
          </div>
          <div className="mt-4">
            <AuditsChart
              data={SUMMER_SERIES}
              title="Daily demonstration audits for June and July 2026"
            />
          </div>
        </Card>
      </div>

      {/* Every charge */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-5">
          <div>
            <h2 className="text-base font-semibold">Every demonstration charge</h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              All {SUMMER_TRANSACTIONS.length} charges in the window, with a simulated processing
              fee of {SIMULATED_FEE_PERCENT}% + {formatUsd(SIMULATED_FEE_FLAT_CENTS)} per charge.
              Nothing is summarized away.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl border-collapse text-left text-sm">
            <caption className="sr-only">
              Fabricated demonstration charges for June and July 2026
            </caption>
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
                  Type
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Amount
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Fee (simulated)
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Net
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Audits granted
                </th>
              </tr>
            </thead>
            <tbody>
              {SUMMER_TRANSACTIONS.map((transaction) => (
                <tr
                  key={`${transaction.date}-${transaction.email}`}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <th scope="row" className="px-5 py-3 font-normal text-[var(--muted-foreground)]">
                    {formatDate(new Date(`${transaction.date}T12:00:00Z`))}
                  </th>
                  <td className="px-5 py-3">
                    {transaction.customerLabel}
                    <span className="block text-xs text-[var(--muted-foreground)]">
                      {transaction.email}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {transaction.product}
                    <span className="block text-xs text-[var(--muted-foreground)]">
                      {transaction.description}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={transaction.kind === 'SUBSCRIPTION' ? 'accent' : 'info'}>
                      {transaction.kind === 'SUBSCRIPTION' ? 'Recurring' : 'One-time'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 font-semibold tabular-nums">
                    {formatUsd(transaction.amountCents)}
                  </td>
                  <td className="px-5 py-3 text-[var(--muted-foreground)] tabular-nums">
                    −{formatUsd(simulatedFeeCents(transaction.amountCents))}
                  </td>
                  <td className="px-5 py-3 font-semibold tabular-nums">
                    {formatUsd(
                      transaction.amountCents - simulatedFeeCents(transaction.amountCents),
                    )}
                  </td>
                  <td className="px-5 py-3 tabular-nums">{transaction.creditsGranted}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--border-strong)] bg-[var(--surface-muted)]">
                <th scope="row" colSpan={4} className="px-5 py-3 text-right font-semibold">
                  Total
                </th>
                <td className="px-5 py-3 font-bold tabular-nums">
                  {formatUsd(SUMMER_TOTALS.grossRevenueCents)}
                </td>
                <td className="px-5 py-3 font-bold text-[var(--muted-foreground)] tabular-nums">
                  −{formatUsd(SUMMER_TOTALS.simulatedFeeCents)}
                </td>
                <td className="px-5 py-3 font-bold tabular-nums">
                  {formatUsd(SUMMER_TOTALS.netRevenueCents)}
                </td>
                <td className="px-5 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* The subscriptions */}
      <Card>
        <div className="border-b border-[var(--border)] p-5">
          <h2 className="text-base font-semibold">The two subscriptions</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            A Starter that began in June and has renewed once, and a Growth that began in July and
            has not reached its first renewal yet.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl border-collapse text-left text-sm">
            <caption className="sr-only">
              Fabricated demonstration subscriptions for June and July 2026
            </caption>
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Customer
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Plan
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Started
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Last billed
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Next renewal
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Periods billed
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Audits used
                </th>
              </tr>
            </thead>
            <tbody>
              {SUMMER_SUBSCRIPTIONS.map((subscription) => (
                <tr
                  key={subscription.email}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <th scope="row" className="px-5 py-3 font-normal">
                    {subscription.customerLabel}
                    <span className="block text-xs text-[var(--muted-foreground)]">
                      {subscription.email}
                    </span>
                  </th>
                  <td className="px-5 py-3 font-medium">
                    {subscription.planName}
                    <span className="block text-xs font-normal text-[var(--muted-foreground)]">
                      {formatUsd(subscription.priceCents)}/month
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone="success">{subscription.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-[var(--muted-foreground)]">
                    {formatDate(new Date(`${subscription.startedOn}T12:00:00Z`))}
                  </td>
                  <td className="px-5 py-3 text-[var(--muted-foreground)]">
                    {formatDate(
                      new Date(`${subscription.renewedOn ?? subscription.startedOn}T12:00:00Z`),
                    )}
                  </td>
                  <td className="px-5 py-3 text-[var(--muted-foreground)]">
                    {formatDate(new Date(`${subscription.nextRenewalOn}T12:00:00Z`))}
                  </td>
                  <td className="px-5 py-3 tabular-nums">{subscription.periodsBilled}</td>
                  <td className="px-5 py-3 tabular-nums">
                    {subscription.auditsUsedByPeriod
                      .map((used) => `${used} of ${subscription.auditsIncludedPerPeriod}`)
                      .join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[var(--border)] p-5 text-sm leading-relaxed text-[var(--muted-foreground)]">
          Recurring revenue in force on the last day of the window:{' '}
          <strong className="font-semibold text-[var(--foreground)]">
            {formatUsd(SUMMER_TOTALS.recurringAtWindowEndCents)}/month
          </strong>
          . Two subscribers over two months is not a run rate, so it is not annualized here.
        </p>
      </Card>

      {/* Funnel */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Demonstration conversion funnel</h2>
        </div>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Fabricated event counts showing the shape of the funnel from free demo through to a
          completed paid audit.
        </p>
        <div className="mt-5">
          <ConversionFunnel steps={funnelSteps} />
        </div>
      </Card>

      {/* Notes */}
      <div className="grid gap-5 lg:grid-cols-2">
        {SUMMER_SNAPSHOT_NOTES.map((note) => (
          <Card key={note.heading} className="p-5">
            <h2 className="text-base font-semibold">{note.heading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
              {note.body}
            </p>
          </Card>
        ))}
      </div>

      <Card className="border-amber-500/50 bg-amber-500/[0.07] p-5">
        <h2 className="text-sm font-semibold">How this data is kept out of real reporting</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
          Every record behind this page carries{' '}
          <code className="font-mono text-xs">isDemo: true</code> and is excluded from the admin
          metrics unless the &quot;Include demo data&quot; toggle is explicitly turned on, which
          announces itself when it is.
        </p>
        <p className="mt-3 text-sm">
          <Link
            href="/admin/demo-data"
            className="inline-flex items-center gap-1.5 text-[var(--accent)] underline underline-offset-4"
          >
            View how demo data is segregated
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </p>
      </Card>
    </div>
  );
}
