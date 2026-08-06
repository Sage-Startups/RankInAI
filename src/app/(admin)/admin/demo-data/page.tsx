import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, ExternalLink } from 'lucide-react';

import { Alert, Badge, Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getDemoSnapshotTotals } from '@/lib/admin/metrics';
import { APRIL_2026_WINDOW } from '@/lib/demo/buyer-snapshot';
import { formatDate, formatUsd } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin — demo data',
  robots: { index: false, follow: false },
};

export default async function AdminDemoDataPage() {
  await requireAdmin();

  const [
    demoUsers,
    demoAudits,
    demoPayments,
    demoPurchases,
    demoSubscriptions,
    demoLedger,
    demoEvents,
    snapshot,
  ] = await Promise.all([
    prisma.user.count({ where: { isDemo: true } }),
    prisma.audit.count({ where: { isDemo: true } }),
    prisma.payment.count({ where: { isDemo: true } }),
    prisma.purchase.count({ where: { isDemo: true } }),
    prisma.subscription.count({ where: { isDemo: true } }),
    prisma.auditCreditLedger.count({ where: { isDemo: true } }),
    prisma.analyticsEvent.count({ where: { isDemo: true } }),
    getDemoSnapshotTotals(APRIL_2026_WINDOW.from, APRIL_2026_WINDOW.to),
  ]);

  const totalDemoRecords =
    demoUsers +
    demoAudits +
    demoPayments +
    demoPurchases +
    demoSubscriptions +
    demoLedger +
    demoEvents +
    snapshot.records.length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Demonstration data</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Every seeded record carries <code className="font-mono text-xs">isDemo: true</code> and is
          excluded from real analytics unless the &quot;Include demo data&quot; toggle is turned on.
        </p>
      </header>

      <Alert tone="danger" title="Fabricated data — never present as real performance">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p>
              The records listed on this page were created by the seed script for product
              demonstration. They do not represent verified revenue, real customers or actual
              historical performance.
            </p>
            <p className="mt-2">
              Presenting fabricated metrics to a prospective buyer, investor or customer as genuine
              financial performance is misrepresentation. See{' '}
              <code className="font-mono text-xs">FLIPPA_HANDOVER.md</code> in the repository for
              the handover rules.
            </p>
          </div>
        </div>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Demo users" value={demoUsers} />
        <Stat label="Demo audits" value={demoAudits} />
        <Stat label="Demo payments" value={demoPayments} />
        <Stat label="Demo purchases" value={demoPurchases} />
        <Stat label="Demo subscriptions" value={demoSubscriptions} />
        <Stat label="Demo credit entries" value={demoLedger} />
        <Stat label="Demo analytics events" value={demoEvents} />
        <Stat label="Buyer-preview day records" value={snapshot.records.length} />
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">April 2026 buyer-preview dataset</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Seeded demonstration figures for {formatDate(APRIL_2026_WINDOW.from, 'long')} to{' '}
              {formatDate(APRIL_2026_WINDOW.to, 'long')}.
            </p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href="/business-snapshot">
              <ExternalLink aria-hidden="true" />
              Open buyer preview
            </Link>
          </Button>
        </div>

        <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Row label="Demonstration sign-ups" value={String(snapshot.totals.signups)} />
          <Row label="Demonstration one-time sales" value={String(snapshot.totals.oneTimeSales)} />
          <Row
            label="Demonstration gross revenue"
            value={formatUsd(snapshot.totals.revenueCents)}
          />
          <Row label="Demonstration subscription revenue" value={formatUsd(0)} />
          <Row label="Purchased audit credits" value={String(snapshot.totals.oneTimeSales)} />
          <Row
            label="Completed demonstration audits"
            value={String(snapshot.totals.auditsCompleted)}
          />
        </dl>

        <p className="mt-5 text-xs leading-relaxed text-[var(--muted-foreground)]">
          The buyer-preview page at <code className="font-mono">/business-snapshot</code> is
          excluded from the sitemap, carries noindex and nofollow directives, and displays a
          permanent banner and watermark stating that the figures are fabricated demonstration data.
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold">How demo data is kept separate</h2>
        <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-[var(--muted-foreground)]">
          <li>
            Every business table (users, audits, payments, purchases, subscriptions, credit ledger,
            analytics events) has an <code className="font-mono text-xs">isDemo</code> column with a
            database index.
          </li>
          <li>
            Every admin metric query applies{' '}
            <code className="font-mono text-xs">isDemo: false</code> by default. Including demo data
            requires an explicit toggle that defaults to off on every screen.
          </li>
          <li>
            Records created by real Stripe payments always have{' '}
            <code className="font-mono text-xs">isDemo: false</code>. There is no interface anywhere
            in the product that can flip a fabricated record to look real, or remove the demo
            disclaimer from one.
          </li>
          <li>
            The seed script is idempotent — running it repeatedly updates the same records rather
            than inflating the counts.
          </li>
        </ul>
      </Card>

      {snapshot.records.length > 0 ? (
        <Card className="overflow-x-auto">
          <div className="border-b border-[var(--border)] p-5">
            <h2 className="text-base font-semibold">Seeded daily records</h2>
          </div>
          <table className="w-full min-w-3xl border-collapse text-left text-sm">
            <caption className="sr-only">Seeded April 2026 daily demonstration records</caption>
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Date
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Sign-ups
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  One-time sales
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Revenue
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Audits completed
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Marker
                </th>
              </tr>
            </thead>
            <tbody>
              {snapshot.records
                .filter(
                  (record) =>
                    record.signups > 0 ||
                    record.oneTimeSales > 0 ||
                    record.revenueCents > 0 ||
                    record.auditsCompleted > 0,
                )
                .map((record) => (
                  <tr key={record.id} className="border-b border-[var(--border)] last:border-0">
                    <th scope="row" className="px-5 py-3 font-normal">
                      {formatDate(record.date)}
                    </th>
                    <td className="px-5 py-3 tabular-nums">{record.signups}</td>
                    <td className="px-5 py-3 tabular-nums">{record.oneTimeSales}</td>
                    <td className="px-5 py-3 tabular-nums">{formatUsd(record.revenueCents)}</td>
                    <td className="px-5 py-3 tabular-nums">{record.auditsCompleted}</td>
                    <td className="px-5 py-3">
                      <Badge tone="demo">isDemo: true</Badge>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      <p className="text-center text-xs text-[var(--muted-foreground)]">
        {totalDemoRecords} demonstration records exist in this database. Remove them with{' '}
        <code className="font-mono">npm run db:reset</code> followed by a seed run without the demo
        dataset, or delete rows where <code className="font-mono">isDemo = true</code>.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
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
