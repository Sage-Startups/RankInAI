import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountStatus } from '@prisma/client';

import { Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import {
  BrandingForm,
  DeleteAccountForm,
  EmailPreferencesForm,
  PasswordForm,
  ProfileForm,
  VerifyEmailButton,
} from '@/app/(app)/dashboard/settings/settings-forms';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getEntitlements } from '@/lib/credits';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await requireUser('/dashboard/settings');
  const [profile, entitlements] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: user.id } }),
    getEntitlements(user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Your profile, security, notifications and report defaults.
        </p>
      </header>

      <Section
        title="Profile"
        description="How your account and company appear inside RankInAI."
      >
        <ProfileForm
          defaults={{
            name: user.name ?? '',
            companyName: profile?.companyName ?? '',
            companyWebsite: profile?.companyWebsite ?? '',
            businessType: profile?.businessType ?? '',
          }}
        />
      </Section>

      <Section title="Account" description="Details of this RankInAI account.">
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Field label="Email address" value={user.email} />
          <Field
            label="Email verified"
            value={user.emailVerified ? formatDate(user.emailVerified) : 'Not verified'}
          />
          <Field label="Account created" value={formatDate(user.createdAt)} />
          <Field label="Role" value={user.role === 'SUPER_ADMIN' ? 'Super admin' : 'User'} />
        </dl>
        <div className="mt-5">
          <VerifyEmailButton verified={Boolean(user.emailVerified)} />
        </div>
      </Section>

      <Section title="Password" description="Change the password used to sign in.">
        <PasswordForm />
      </Section>

      <Section
        title="Email preferences"
        description="Choose which non-essential emails you receive."
      >
        <EmailPreferencesForm
          defaults={{
            emailProductUpdates: profile?.emailProductUpdates ?? true,
            emailAuditComplete: profile?.emailAuditComplete ?? true,
            emailMarketing: profile?.emailMarketing ?? false,
          }}
        />
      </Section>

      <Section
        title="Default report branding"
        description="Applied automatically when you white-label a new audit report."
      >
        <BrandingForm
          allowed={entitlements.entitlements.whiteLabelReports}
          defaults={{
            brandingCompanyName: profile?.brandingCompanyName ?? '',
            brandingLogoUrl: profile?.brandingLogoUrl ?? '',
            brandingAccentColor: profile?.brandingAccentColor ?? '',
          }}
        />
      </Section>

      <Section title="Sign out" description="End this session on this device.">
        <Button asChild variant="secondary">
          <Link href="/signout">Sign out</Link>
        </Button>
      </Section>

      <Card className="border-red-500/35 p-6">
        <h2 className="text-base font-semibold text-red-700 dark:text-red-400">Delete account</h2>
        <div className="mt-4">
          <DeleteAccountForm
            alreadyRequested={
              user.status === AccountStatus.PENDING_DELETION
            }
          />
        </div>
      </Card>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-2">
      <dt className="text-[var(--muted-foreground)]">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
