import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Badge, Card } from '@/components/ui/primitives';
import { Logo } from '@/components/brand/logo';
import { OnboardingForm } from '@/app/onboarding/onboarding-form';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { PRODUCTS, isProductKey } from '@/lib/plans';
import { formatUsd } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Set up your account',
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const user = await requireUser('/onboarding');

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: {
      fullName: true,
      companyName: true,
      companyWebsite: true,
      onboardingCompleted: true,
      onboardingSkipped: true,
      pendingPlanSelection: true,
    },
  });

  if (profile?.onboardingCompleted || profile?.onboardingSkipped) {
    redirect('/dashboard');
  }

  const pendingPlan =
    profile?.pendingPlanSelection && isProductKey(profile.pendingPlanSelection)
      ? PRODUCTS[profile.pendingPlanSelection]
      : null;

  return (
    <div className="min-h-dvh bg-[var(--surface-muted)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="rk-container flex h-16 items-center">
          <Logo href={null} />
        </div>
      </header>

      <main id="main" className="rk-container py-10 lg:py-14">
        <div className="mx-auto max-w-2xl">
          <div className="mb-7">
            <p className="text-xs font-semibold tracking-[0.14em] text-violet-600 uppercase dark:text-violet-300">
              Step 1 of 1
            </p>
            <h1 className="mt-2 text-2xl font-bold">Tell us a little about your work</h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
              This takes about thirty seconds and makes several audit checks more useful —
              particularly terminology alignment and geographic clarity. You can skip it and fill it
              in later from settings.
            </p>
          </div>

          {pendingPlan ? (
            <Card className="mb-5 border-violet-500/40 bg-violet-500/5 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">Selected plan</Badge>
                <span className="text-sm font-medium">
                  {pendingPlan.name} — {formatUsd(pendingPlan.priceCents)}
                  {pendingPlan.interval === 'month' ? '/month' : ' once'}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                We&apos;ll take you to checkout as soon as you finish or skip this step.
              </p>
            </Card>
          ) : null}

          <Card className="p-6 sm:p-8">
            <OnboardingForm
              defaults={{
                fullName: profile?.fullName ?? user.name ?? '',
                companyName: profile?.companyName ?? '',
                companyWebsite: profile?.companyWebsite ?? '',
              }}
            />
          </Card>
        </div>
      </main>
    </div>
  );
}
