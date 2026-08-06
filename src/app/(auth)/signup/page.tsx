import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Alert, Badge } from '@/components/ui/primitives';
import { SignUpForm } from '@/app/(auth)/signup/signup-form';
import { getCurrentUser } from '@/lib/auth/guards';
import { getSettings } from '@/lib/settings';
import { PRODUCTS, isProductKey } from '@/lib/plans';
import { formatUsd } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Create your account',
  description:
    'Create a RankInAI account to run a full AI visibility audit of your website and get a prioritized action plan.',
  robots: { index: true, follow: true },
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const { plan: rawPlan } = await searchParams;
  const settings = await getSettings();
  const plan = rawPlan && isProductKey(rawPlan) ? rawPlan : null;
  const product = plan ? PRODUCTS[plan] : null;

  return (
    <div>
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        Already have one?{' '}
        <Link href="/signin" className="text-[var(--accent)] underline underline-offset-4">
          Sign in
        </Link>
      </p>

      {product ? (
        <Alert tone="info" className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">Selected</Badge>
            <span className="font-medium text-[var(--foreground)]">
              {product.name} — {formatUsd(product.priceCents)}
              {product.interval === 'month' ? '/month' : ' once'}
            </span>
          </div>
          <p className="mt-1.5 text-sm">
            We&apos;ll take you to checkout right after your account is created.
          </p>
        </Alert>
      ) : null}

      {!settings.signupsEnabled ? (
        <Alert tone="warning" className="mt-6" title="Registrations are temporarily closed">
          New accounts cannot be created right now. Please check back soon, or contact us if you
          need access urgently.
        </Alert>
      ) : (
        <div className="mt-7">
          <SignUpForm plan={plan} />
        </div>
      )}

      <p className="mt-7 text-center text-xs leading-relaxed text-[var(--muted-foreground)]">
        No credit card is required to create an account. You can run the free demo and the homepage
        preview without paying anything.
      </p>
    </div>
  );
}
