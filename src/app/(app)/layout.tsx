import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';

import { AppShell } from '@/components/app/app-shell';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { billingModeLabel, isBillingSimulated } from '@/lib/billing/stripe';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser('/dashboard');

  // A brand-new account is sent through onboarding once; it can be skipped.
  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { onboardingCompleted: true, onboardingSkipped: true },
  });

  if (profile && !profile.onboardingCompleted && !profile.onboardingSkipped) {
    redirect('/onboarding');
  }

  return (
    <AppShell
      user={{ name: user.name, email: user.email }}
      isAdmin={user.role === Role.SUPER_ADMIN}
      billingTestMode={isBillingSimulated()}
      billingModeMessage={billingModeLabel()}
    >
      {children}
    </AppShell>
  );
}
