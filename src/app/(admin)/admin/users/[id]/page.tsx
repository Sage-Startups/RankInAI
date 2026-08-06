import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Alert, Badge, Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { AuditStatusBadge } from '@/components/app/audit-status-badge';
import {
  CreditAdjustForm,
  RoleForm,
  SuspensionForm,
} from '@/app/(admin)/admin/users/[id]/user-admin-forms';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getEntitlements } from '@/lib/credits';
import { planLabel } from '@/lib/plans';
import { formatDate, formatUsd, displayHost } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin — user',
  robots: { index: false, follow: false },
};

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      profile: true,
      subscriptions: { orderBy: { createdAt: 'desc' } },
      payments: { orderBy: { createdAt: 'desc' }, take: 20 },
      purchases: { orderBy: { createdAt: 'desc' }, take: 20 },
      creditLedger: { orderBy: { createdAt: 'desc' }, take: 20 },
      audits: { orderBy: { createdAt: 'desc' }, take: 20, where: { deletedAt: null } },
    },
  });

  if (!user) notFound();

  const entitlements = await getEntitlements(user.id);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/users">
            <ArrowLeft aria-hidden="true" />
            All users
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{user.name ?? user.email}</h1>
            <Badge tone={user.role === 'SUPER_ADMIN' ? 'info' : 'neutral'}>
              {user.role === 'SUPER_ADMIN' ? 'Super admin' : 'User'}
            </Badge>
            <Badge
              tone={
                user.status === 'ACTIVE'
                  ? 'success'
                  : user.status === 'SUSPENDED'
                    ? 'danger'
                    : 'warning'
              }
            >
              {user.status.replace(/_/g, ' ').toLowerCase()}
            </Badge>
            {user.isDemo ? <Badge tone="demo">Demo account</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {user.email} · Joined {formatDate(user.createdAt, 'datetime')} · Last sign-in{' '}
            {user.lastLoginAt ? formatDate(user.lastLoginAt, 'datetime') : 'never'}
          </p>
        </div>
      </header>

      {user.status === 'SUSPENDED' ? (
        <Alert tone="danger" title="This account is suspended">
          {user.suspendedReason ?? 'No reason recorded.'} Suspended{' '}
          {formatDate(user.suspendedAt, 'datetime')}.
        </Alert>
      ) : null}

      {user.deletionRequestedAt ? (
        <Alert tone="warning" title="Account deletion requested">
          The account holder requested deletion on{' '}
          {formatDate(user.deletionRequestedAt, 'datetime')}.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Entitlements</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Plan" value={planLabel(entitlements.plan)} />
            <Row
              label="Plan audits left"
              value={
                entitlements.entitlements.auditsPerPeriod > 0
                  ? `${entitlements.auditsRemainingThisPeriod} / ${entitlements.entitlements.auditsPerPeriod}`
                  : '—'
              }
            />
            <Row label="One-time credits" value={String(user.oneTimeCredits)} />
            <Row label="Total available" value={String(entitlements.totalAuditsAvailable)} />
            <Row
              label="Renews"
              value={entitlements.periodEnd ? formatDate(entitlements.periodEnd) : '—'}
            />
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Profile</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Company" value={user.profile?.companyName ?? '—'} />
            <Row
              label="Website"
              value={user.profile?.companyWebsite ? displayHost(user.profile.companyWebsite) : '—'}
            />
            <Row label="Business type" value={user.profile?.businessType ?? '—'} />
            <Row label="Use case" value={user.profile?.primaryUseCase ?? '—'} />
            <Row
              label="Onboarding"
              value={
                user.profile?.onboardingCompleted
                  ? 'Completed'
                  : user.profile?.onboardingSkipped
                    ? 'Skipped'
                    : 'Not started'
              }
            />
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Billing</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Stripe customer" value={user.stripeCustomerId ?? 'None'} />
            <Row label="Payments" value={String(user.payments.length)} />
            <Row label="Purchases" value={String(user.purchases.length)} />
            <Row
              label="Lifetime value"
              value={formatUsd(
                user.payments
                  .filter((p) => p.status === 'SUCCEEDED')
                  .reduce((sum, p) => sum + p.amountCents, 0),
              )}
            />
            <Row label="Email verified" value={user.emailVerified ? 'Yes' : 'No'} />
          </dl>
        </Card>
      </div>

      {/* Admin actions */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Adjust audit credits</h2>
          <div className="mt-4">
            <CreditAdjustForm userId={user.id} />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Account status</h2>
          <div className="mt-4">
            <SuspensionForm userId={user.id} suspended={user.status === 'SUSPENDED'} />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Role</h2>
          <div className="mt-4">
            <RoleForm userId={user.id} currentRole={user.role} />
          </div>
        </Card>
      </div>

      {/* Subscriptions */}
      <Card>
        <div className="border-b border-[var(--border)] p-5">
          <h2 className="text-base font-semibold">Subscriptions</h2>
        </div>
        {user.subscriptions.length === 0 ? (
          <p className="p-5 text-sm text-[var(--muted-foreground)]">No subscription records.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {user.subscriptions.map((subscription) => (
              <li
                key={subscription.id}
                className="flex flex-wrap items-center justify-between gap-3 p-5"
              >
                <div>
                  <p className="text-sm font-medium">
                    {planLabel(subscription.plan)}{' '}
                    <Badge tone={subscription.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {subscription.status.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                    {subscription.isDemo ? (
                      <Badge tone="demo" className="ml-2">
                        Demo
                      </Badge>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    {subscription.stripeSubscriptionId ?? 'No Stripe subscription ID'} ·{' '}
                    {subscription.auditsUsedThisPeriod} audits used this period
                  </p>
                </div>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {subscription.currentPeriodEnd
                    ? `Renews ${formatDate(subscription.currentPeriodEnd)}`
                    : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Audits */}
      <Card>
        <div className="border-b border-[var(--border)] p-5">
          <h2 className="text-base font-semibold">Audits</h2>
        </div>
        {user.audits.length === 0 ? (
          <p className="p-5 text-sm text-[var(--muted-foreground)]">No audits yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {user.audits.map((audit) => (
              <li key={audit.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div className="min-w-0">
                  <Link
                    href={`/admin/audits/${audit.id}`}
                    className="text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
                  >
                    {audit.businessName}
                  </Link>
                  <p className="truncate text-xs text-[var(--muted-foreground)]">
                    {displayHost(audit.websiteUrl)} · {formatDate(audit.createdAt)} ·{' '}
                    {audit.creditSource.replace(/_/g, ' ').toLowerCase()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <AuditStatusBadge status={audit.status} />
                  {audit.overallScore != null ? (
                    <span className="font-bold tabular-nums">{audit.overallScore}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Payments & credit ledger */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="border-b border-[var(--border)] p-5">
            <h2 className="text-base font-semibold">Payments</h2>
          </div>
          {user.payments.length === 0 ? (
            <p className="p-5 text-sm text-[var(--muted-foreground)]">No payments.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {user.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{payment.description ?? payment.kind}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {formatDate(payment.paidAt ?? payment.createdAt)} ·{' '}
                      {payment.status.toLowerCase()}
                      {payment.isDemo ? ' · demo' : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatUsd(payment.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="border-b border-[var(--border)] p-5">
            <h2 className="text-base font-semibold">Credit ledger</h2>
          </div>
          {user.creditLedger.length === 0 ? (
            <p className="p-5 text-sm text-[var(--muted-foreground)]">No credit activity.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {user.creditLedger.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {entry.note ?? entry.reason.replace(/_/g, ' ').toLowerCase()}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {formatDate(entry.createdAt, 'datetime')}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-semibold tabular-nums">
                      {entry.delta > 0 ? '+' : ''}
                      {entry.delta}
                    </span>
                    <p className="text-xs text-[var(--muted-foreground)]">→ {entry.balanceAfter}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
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
