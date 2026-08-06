import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, Coins, FileCheck2, TrendingUp, UserPlus } from 'lucide-react';

import { Badge, Card } from '@/components/ui/primitives';
import { Logo } from '@/components/brand/logo';
import {
  AuditsChart,
  ConversionFunnel,
  RevenueChart,
  SignupChart,
} from '@/components/admin/charts';
import {
  APRIL_2026_WINDOW,
  BUYER_PREVIEW_BANNER,
  DEMO_DAYS,
  DEMO_PURCHASES,
  DEMO_SNAPSHOT_TOTALS,
  ONE_TIME_MODEL_EXPLANATION,
  ONE_TIME_PRICE_CENTS,
} from '@/lib/demo/buyer-snapshot';
import { formatDate, formatUsd } from '@/lib/utils';

/**
 * Buyer-preview page.
 *
 * Deliberately excluded from the public navigation and the sitemap, and served
 * with noindex/nofollow both here and via a header in next.config.ts. Every
 * figure on the page is fabricated demonstration data and is labeled as such in
 * a banner, a watermark and per-section notes.
 */
export const metadata: Metadata = {
  title: 'Business snapshot — demonstration data',
  description: 'Demonstration business-performance preview using fabricated data.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function BusinessSnapshotPage() {
  // Build the daily series in the shape the charts expect.
  const series = DEMO_DAYS.map((day) => ({
    date: day.date,
    revenueCents: day.oneTimeSales * ONE_TIME_PRICE_CENTS,
    signups: day.signups,
    audits: day.auditsCreated,
  }));

  const funnelSteps = [
    { label: 'Demo runs', value: DEMO_DAYS.reduce((sum, d) => sum + d.demoRuns, 0) },
    { label: 'Homepage previews', value: DEMO_DAYS.reduce((sum, d) => sum + d.previewRuns, 0) },
    { label: 'Sign-ups', value: DEMO_SNAPSHOT_TOTALS.signups },
    { label: 'One-time purchases', value: DEMO_SNAPSHOT_TOTALS.oneTimeSales },
    { label: 'Audits completed', value: DEMO_SNAPSHOT_TOTALS.auditsCompleted },
  ];

  return (
    <div className="relative min-h-dvh bg-[var(--surface-muted)]">
      {/* Repeating watermark */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-10 overflow-hidden opacity-[0.06] select-none"
      >
        <div className="grid h-full w-full grid-cols-2 place-items-center gap-8 sm:grid-cols-3">
          {Array.from({ length: 18 }).map((_, index) => (
            <span
              key={index}
              className="-rotate-[24deg] text-2xl font-black tracking-widest whitespace-nowrap text-[var(--foreground)] uppercase"
            >
              Demo data
            </span>
          ))}
        </div>
      </div>

      {/* Banner */}
      <div
        role="alert"
        className="sticky top-0 z-40 border-b-2 border-amber-600 bg-amber-500 px-4 py-3 text-center"
      >
        <p className="mx-auto flex max-w-5xl items-center justify-center gap-2.5 text-xs leading-relaxed font-bold tracking-wide text-amber-950 uppercase sm:text-sm">
          <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
          {BUYER_PREVIEW_BANNER}
        </p>
      </div>

      <header className="relative z-20 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="rk-container flex h-16 items-center justify-between gap-4">
          <Logo />
          <Badge tone="demo">Product presentation preview</Badge>
        </div>
      </header>

      <main id="main" className="rk-container relative z-20 py-8 lg:py-10">
        <div className="mb-7">
          <h1 className="text-2xl font-bold">Business snapshot — demonstration data</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted-foreground)]">
            This page shows how business performance would be presented inside RankInAI. Every
            figure below was fabricated by the seed script for{' '}
            {formatDate(APRIL_2026_WINDOW.from, 'long')} through{' '}
            {formatDate(APRIL_2026_WINDOW.to, 'long')}. Nothing here is verified revenue, real
            customer activity or actual historical performance.
          </p>
        </div>

        <Card className="mb-7 border-red-500/40 bg-red-500/[0.05] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
            <AlertTriangle className="size-4" aria-hidden="true" />
            Disclosure
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
            <li>
              All records shown are seeded demonstration data stored with{' '}
              <code className="font-mono text-xs">isDemo: true</code>.
            </li>
            <li>
              These figures are excluded from the platform&apos;s real admin analytics unless an
              administrator explicitly enables the &quot;Include demo data&quot; toggle.
            </li>
            <li>
              No customer named on this page exists. Every email address uses the reserved{' '}
              <code className="font-mono text-xs">.invalid</code> domain.
            </li>
            <li>
              Representing these numbers to a buyer, investor or customer as genuine financial
              performance would be misrepresentation.
            </li>
          </ul>
        </Card>

        {/* Metric cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={TrendingUp}
            label="Demonstration gross revenue"
            value={formatUsd(DEMO_SNAPSHOT_TOTALS.grossRevenueCents)}
            detail={`${DEMO_SNAPSHOT_TOTALS.oneTimeSales} one-time audits at ${formatUsd(ONE_TIME_PRICE_CENTS)}`}
          />
          <MetricCard
            icon={UserPlus}
            label="Demonstration sign-ups"
            value={String(DEMO_SNAPSHOT_TOTALS.signups)}
            detail="New accounts in the demonstration month"
          />
          <MetricCard
            icon={Coins}
            label="One-time audit sales"
            value={String(DEMO_SNAPSHOT_TOTALS.oneTimeSales)}
            detail={`${DEMO_SNAPSHOT_TOTALS.creditsPurchased} audit credits purchased`}
          />
          <MetricCard
            icon={FileCheck2}
            label="Audits completed"
            value={String(DEMO_SNAPSHOT_TOTALS.auditsCompleted)}
            detail="Every purchased credit was used"
          />
        </div>

        <Card className="mt-4 p-5">
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Row
              label="Demonstration subscription revenue"
              value={formatUsd(DEMO_SNAPSHOT_TOTALS.subscriptionRevenueCents)}
            />
            <Row label="One-time audit price" value={formatUsd(ONE_TIME_PRICE_CENTS)} />
            <Row
              label="Average revenue per sign-up"
              value={formatUsd(
                Math.round(DEMO_SNAPSHOT_TOTALS.grossRevenueCents / DEMO_SNAPSHOT_TOTALS.signups),
              )}
            />
            <Row
              label="Audits per paying customer"
              value={(DEMO_SNAPSHOT_TOTALS.auditsCompleted / DEMO_SNAPSHOT_TOTALS.signups).toFixed(
                1,
              )}
            />
          </dl>
        </Card>

        {/* Charts */}
        <div className="mt-7 space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Daily demonstration revenue</h2>
              <Badge tone="demo">Demo data</Badge>
            </div>
            <div className="mt-4">
              <RevenueChart data={series} title="Daily demonstration revenue for April 2026" />
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Sign-up activity</h2>
                <Badge tone="demo">Demo data</Badge>
              </div>
              <div className="mt-4">
                <SignupChart data={series} title="Daily demonstration sign-ups for April 2026" />
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Audits created</h2>
                <Badge tone="demo">Demo data</Badge>
              </div>
              <div className="mt-4">
                <AuditsChart data={series} title="Daily demonstration audits for April 2026" />
              </div>
            </Card>
          </div>
        </div>

        {/* Purchase table */}
        <Card className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-5">
            <h2 className="text-base font-semibold">Demonstration purchases</h2>
            <Badge tone="demo">Demo data</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl border-collapse text-left text-sm">
              <caption className="sr-only">
                Fabricated demonstration purchases for April 2026
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
                    Amount
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Credits
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Audit
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {DEMO_PURCHASES.map((purchase, index) => (
                  <tr key={index} className="border-b border-[var(--border)] last:border-0">
                    <th
                      scope="row"
                      className="px-5 py-3 font-normal text-[var(--muted-foreground)]"
                    >
                      {formatDate(new Date(`${purchase.date}T12:00:00Z`))}
                    </th>
                    <td className="px-5 py-3">
                      {purchase.customerLabel}
                      <span className="block text-xs text-[var(--muted-foreground)]">
                        {purchase.email}
                      </span>
                    </td>
                    <td className="px-5 py-3">{purchase.product}</td>
                    <td className="px-5 py-3 font-semibold tabular-nums">
                      {formatUsd(purchase.amountCents)}
                    </td>
                    <td className="px-5 py-3 tabular-nums">{purchase.creditsGranted}</td>
                    <td className="px-5 py-3 text-[var(--muted-foreground)]">
                      {purchase.auditDomain}
                    </td>
                    <td className="px-5 py-3 font-semibold tabular-nums">{purchase.auditScore}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--border-strong)] bg-[var(--surface-muted)]">
                  <th scope="row" colSpan={3} className="px-5 py-3 text-right font-semibold">
                    Total
                  </th>
                  <td className="px-5 py-3 font-bold tabular-nums">
                    {formatUsd(DEMO_SNAPSHOT_TOTALS.grossRevenueCents)}
                  </td>
                  <td className="px-5 py-3 font-bold tabular-nums">
                    {DEMO_SNAPSHOT_TOTALS.creditsPurchased}
                  </td>
                  <td colSpan={2} className="px-5 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {/* Funnel */}
        <Card className="mt-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Demonstration conversion funnel</h2>
            <Badge tone="demo">Demo data</Badge>
          </div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Fabricated event counts showing the shape of the funnel from free demo through to a
            completed paid audit.
          </p>
          <div className="mt-5">
            <ConversionFunnel steps={funnelSteps} />
          </div>
        </Card>

        {/* Model explanation */}
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {ONE_TIME_MODEL_EXPLANATION.map((section) => (
            <Card key={section.heading} className="p-5">
              <h2 className="text-base font-semibold">{section.heading}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
                {section.body}
              </p>
            </Card>
          ))}
        </div>

        <Card className="mt-5 border-amber-500/50 bg-amber-500/[0.07] p-5">
          <h2 className="text-sm font-semibold">Where real figures come from</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
            Genuine performance data lives in the Stripe dashboard and in the platform&apos;s
            non-demo records, visible under{' '}
            <Link href="/admin" className="text-[var(--accent)] underline underline-offset-4">
              the admin area
            </Link>{' '}
            with the demo toggle switched off. Any due-diligence request should be answered with
            Stripe exports and read-only admin access — never with this page.
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

        <p className="mt-8 text-center text-xs font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-400">
          {BUYER_PREVIEW_BANNER}
        </p>
      </main>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="relative overflow-hidden p-5">
      <span className="absolute top-3 right-3">
        <Badge tone="demo">Demo</Badge>
      </span>
      <div className="flex items-center gap-2.5">
        <Icon className="size-4 text-[var(--muted-foreground)]" aria-hidden />
        <p className="text-xs font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
          {label}
        </p>
      </div>
      <p className="mt-2.5 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">{detail}</p>
    </Card>
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
