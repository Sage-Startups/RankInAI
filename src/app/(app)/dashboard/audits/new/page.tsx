import type { Metadata } from 'next';
import Link from 'next/link';

import { Alert, Badge, Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { NewAuditForm } from '@/app/(app)/dashboard/audits/new/new-audit-form';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { effectiveAuditLimits, getEntitlements } from '@/lib/credits';
import { getSettings } from '@/lib/settings';
import { planLabel } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'New audit',
  robots: { index: false, follow: false },
};

export default async function NewAuditPage() {
  const user = await requireUser('/dashboard/audits/new');
  const [entitlements, settings, profile] = await Promise.all([
    getEntitlements(user.id),
    getSettings(),
    prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: { brandingCompanyName: true, brandingLogoUrl: true, companyWebsite: true },
    }),
  ]);

  const limits = effectiveAuditLimits(entitlements);
  const pageLimit = Math.min(limits.pageLimit, settings.maxCrawlPagesHardLimit);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Start a new audit</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          RankInAI will crawl the site, score seven AI visibility categories and build a prioritized
          action plan.
        </p>
      </header>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Audits available
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums">
              {entitlements.totalAuditsAvailable}
              <span className="ml-2 text-sm font-normal text-[var(--muted-foreground)]">
                {entitlements.auditsRemainingThisPeriod > 0
                  ? `${entitlements.auditsRemainingThisPeriod} from your ${planLabel(entitlements.plan)} plan`
                  : ''}
                {entitlements.auditsRemainingThisPeriod > 0 && entitlements.oneTimeCredits > 0
                  ? ' · '
                  : ''}
                {entitlements.oneTimeCredits > 0
                  ? `${entitlements.oneTimeCredits} one-time ${
                      entitlements.oneTimeCredits === 1 ? 'credit' : 'credits'
                    }`
                  : ''}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{pageLimit} pages per audit</Badge>
            <Badge tone="neutral">
              {limits.competitorLimit}{' '}
              {limits.competitorLimit === 1 ? 'competitor' : 'competitors'}
            </Badge>
            {limits.whiteLabel ? <Badge tone="accent">White-label</Badge> : null}
          </div>
        </div>
      </Card>

      {!entitlements.canCreateAudit ? (
        <Alert tone="warning" title="No audits remaining">
          <p>
            You have used your plan allowance and have no one-time credits left. Buy a single audit
            for $49 or upgrade your plan to continue.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link href="/dashboard/billing">Go to billing</Link>
          </Button>
        </Alert>
      ) : null}

      <NewAuditForm
        competitorLimit={limits.competitorLimit}
        pageLimit={pageLimit}
        whiteLabelAllowed={limits.whiteLabel}
        canCreate={entitlements.canCreateAudit}
        defaultBranding={{
          name: profile?.brandingCompanyName ?? null,
          logoUrl: profile?.brandingLogoUrl ?? null,
        }}
      />

      <Alert tone="neutral">
        <p className="text-xs leading-relaxed">
          Audits usually complete in one to four minutes depending on how many pages are crawled.
          You can leave this page — the audit runs in the background and the report appears in your
          audit list when it finishes. If the audit fails before producing results, the credit is
          returned to your account automatically.
        </p>
      </Alert>
    </div>
  );
}
