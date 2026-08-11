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
  ONE_TIME_PRICE_CENTS,
  STARTER_PRICE_CENTS,
  SUMMER_2026_WINDOW,
  SUMMER_MONTHS,
  SUMMER_SERIES,
  SUMMER_SNAPSHOT_BANNER,
  SUMMER_SNAPSHOT_NOTES,
  SUMMER_SUBSCRIPTION,
  SUMMER_TOTALS,
  SUMMER_TRANSACTIONS,
} from '@/lib/demo/summer-snapshot';
import { formatDate, formatUsd } from '@/lib/utils';

/**
 * One-page demonstration snapshot: three one-time Full Audits and one Starter
 * subscription across June and July 2026.
 *
 * Sits inside the admin area, so it is behind `requireAdmin` like every other
 * admin route. Every figure is fabricated, and the page says so in a banner, on
 * each panel, and once more at the foot — there is deliberately no way to turn
 * that labeling off.
 */
export const metadata: Metadata = {
  title: 'Admin — demo revenue snapshot',
  robots: { index: false, follow: false },
};

export default async function AdminDemoSnapshotPage() {
  await requireAdmin();

  // Audits completed is deliberately NOT a funnel step: the subscription
  // produced five audits from one customer, so the count rises at the end and a
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
          {windowLabel}. Three one-time Full Audits and one Starter subscription — the smallest
          dataset that shows both revenue types working end to end. Nothing on this page is real
          revenue, a real customer or a forecast.
        </p>
      </header>

      {/* Headline figures */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DemoMetricCard
          icon={TrendingUp}
          label="Demonstration gross revenue"
          value={formatUsd(SUMMER_TOTALS.grossRevenueCents)}
          detail={`${formatUsd(SUMMER_TOTALS.oneTimeRevenueCents)} one-time + ${formatUsd(SUMMER_TOTALS.subscriptionRevenueCents)} recurring`}
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
          label="Starter subscriptions"
          value={String(SUMMER_TOTALS.activeSubscriptions)}
          detail={`${formatUsd(STARTER_PRICE_CENTS)}/month, billed ${SUMMER_TOTALS.subscriptionInvoices} times`}
          badge={false}
        />
        <DemoMetricCard
          icon={FileCheck2}
          label="Audits completed"
          value={String(SUMMER_TOTALS.auditsCompleted)}
          detail={`${SUMMER_TOTALS.oneTimeSales} from credits, ${SUMMER_TOTALS.auditsCompleted - SUMMER_TOTALS.oneTimeSales} from the subscription`}
          badge={false}
        />
      </div>

      {/* Month by month */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-5">
          <h2 className="text-base font-semibold">Month by month</h2>
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
          The two {formatUsd(STARTER_PRICE_CENTS)} points are the subscription billing on{' '}
          {formatDate(new Date(`${SUMMER_SUBSCRIPTION.startedOn}T12:00:00Z`))} and{' '}
          {formatDate(new Date(`${SUMMER_SUBSCRIPTION.renewedOn}T12:00:00Z`))}; the three taller
          ones are the one-time audits.
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
              All {SUMMER_TRANSACTIONS.length} charges in the window. Nothing is summarized away.
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
                <td className="px-5 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* The subscription itself */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">The Starter subscription</h2>
        </div>
        <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Row label="Customer" value={SUMMER_SUBSCRIPTION.customerLabel} />
          <Row
            label="Plan"
            value={`${SUMMER_SUBSCRIPTION.planName} — ${formatUsd(SUMMER_SUBSCRIPTION.priceCents)}/month`}
          />
          <Row label="Status" value={SUMMER_SUBSCRIPTION.status} />
          <Row
            label="Started"
            value={formatDate(new Date(`${SUMMER_SUBSCRIPTION.startedOn}T12:00:00Z`))}
          />
          <Row
            label="Renewed"
            value={formatDate(new Date(`${SUMMER_SUBSCRIPTION.renewedOn}T12:00:00Z`))}
          />
          <Row label="Periods billed" value={String(SUMMER_SUBSCRIPTION.periodsBilled)} />
          <Row
            label="Audits included per period"
            value={String(SUMMER_SUBSCRIPTION.auditsIncludedPerPeriod)}
          />
          <Row
            label="Used in the first period"
            value={`${SUMMER_SUBSCRIPTION.auditsUsedFirstPeriod} of ${SUMMER_SUBSCRIPTION.auditsIncludedPerPeriod}`}
          />
          <Row
            label="Used in the second period"
            value={`${SUMMER_SUBSCRIPTION.auditsUsedSecondPeriod} of ${SUMMER_SUBSCRIPTION.auditsIncludedPerPeriod}`}
          />
        </dl>
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted-foreground)]">
          Recurring revenue in force on the last day of the window:{' '}
          <strong className="font-semibold text-[var(--foreground)]">
            {formatUsd(SUMMER_TOTALS.recurringAtWindowEndCents)}
          </strong>
          . One subscriber over two months is not a run rate, so it is not annualized here.
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-2">
      <dt className="text-[var(--muted-foreground)]">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
