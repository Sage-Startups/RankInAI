import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Alert, Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { CheckoutButton } from '@/app/(app)/dashboard/billing/billing-buttons';
import { requireUser } from '@/lib/auth/guards';
import { PRODUCTS, isProductKey } from '@/lib/plans';
import { isBillingSimulated } from '@/lib/billing/stripe';
import { formatUsd } from '@/lib/utils';
import { Logo } from '@/components/brand/logo';

export const metadata: Metadata = {
  title: 'Continue to checkout',
  robots: { index: false, follow: false },
};

/**
 * Bridge page between registration/onboarding and Stripe Checkout.
 *
 * A deliberate confirmation step rather than an automatic redirect — an
 * automatic redirect into a payment flow immediately after sign-up is hostile.
 */
export default async function CheckoutStartPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  await requireUser('/dashboard/billing');
  const { plan } = await searchParams;

  if (!plan || !isProductKey(plan)) {
    redirect('/dashboard/billing');
  }

  const product = PRODUCTS[plan];
  const simulated = isBillingSimulated();

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface-muted)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="rk-container flex h-16 items-center">
          <Logo />
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <Card className="p-6 sm:p-8">
            <p className="text-xs font-semibold tracking-[0.14em] text-violet-600 uppercase dark:text-violet-300">
              Confirm your purchase
            </p>
            <h1 className="mt-2 text-2xl font-bold">{product.name}</h1>
            <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">{product.tagline}</p>

            <p className="mt-6 flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">
                {formatUsd(product.priceCents)}
              </span>
              <span className="text-sm text-[var(--muted-foreground)]">
                {product.interval === 'month' ? 'per month, billed monthly' : 'one-time payment'}
              </span>
            </p>

            <ul className="mt-6 space-y-2">
              {product.features.map((feature) => (
                <li key={feature} className="flex gap-2.5 text-sm text-[var(--muted-foreground)]">
                  <span
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-violet-500"
                    aria-hidden="true"
                  />
                  {feature}
                </li>
              ))}
            </ul>

            {simulated ? (
              <Alert tone="warning" className="mt-6" title="Billing test mode">
                Checkout is simulated locally. No payment will be taken and no Stripe record is
                created, but the entitlement is applied exactly as it would be in production.
              </Alert>
            ) : null}

            <div className="mt-7">
              <CheckoutButton
                productKey={product.key}
                label={simulated ? 'Complete simulated checkout' : 'Continue to secure checkout'}
              />
            </div>

            <p className="mt-4 text-center text-xs text-[var(--muted-foreground)]">
              {simulated
                ? 'Billing test mode is enabled on this deployment.'
                : 'Payments are processed securely by Stripe. RankInAI never sees your card details.'}
            </p>

            <div className="mt-6 border-t border-[var(--border)] pt-5 text-center">
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">Skip for now — go to my dashboard</Link>
              </Button>
            </div>
          </Card>

          <p className="mt-5 text-center text-xs text-[var(--muted-foreground)]">
            By continuing you agree to the{' '}
            <Link href="/legal/terms" className="underline underline-offset-4">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/legal/refunds" className="underline underline-offset-4">
              Refund Policy
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
