import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Clock, Coins, Sparkles } from 'lucide-react';

import { Alert, Badge, Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/logo';
import { CheckoutTracker } from '@/app/checkout/success/checkout-tracker';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getEntitlements } from '@/lib/credits';
import { PRODUCTS, isProductKey, planLabel } from '@/lib/plans';
import { isBillingSimulated } from '@/lib/billing/stripe';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Payment complete',
  robots: { index: false, follow: false },
};

/**
 * Checkout success.
 *
 * Entitlements are applied by the Stripe webhook, which can arrive a moment
 * after the browser redirect. When that has not landed yet the page shows a
 * "processing" state rather than claiming something that has not happened.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; product?: string; simulated?: string }>;
}) {
  const user = await requireUser('/dashboard');
  const params = await searchParams;

  const [entitlements, payment] = await Promise.all([
    getEntitlements(user.id),
    params.session_id
      ? prisma.payment.findUnique({
          where: { stripeCheckoutSessionId: params.session_id },
          select: { status: true, kind: true, productKey: true, amountCents: true },
        })
      : Promise.resolve(null),
  ]);

  const productKey =
    payment?.productKey && isProductKey(payment.productKey)
      ? payment.productKey
      : params.product && isProductKey(params.product)
        ? params.product
        : null;

  const product = productKey ? PRODUCTS[productKey] : null;
  const isSubscription = product?.interval === 'month';
  const confirmed = payment?.status === 'SUCCEEDED';
  const simulated = isBillingSimulated();

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface-muted)]">
      <CheckoutTracker productKey={productKey} />

      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="rk-container flex h-16 items-center">
          <Logo />
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <Card className="p-6 text-center sm:p-8">
            {confirmed ? (
              <>
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/12">
                  <CheckCircle2 className="size-7 text-emerald-500" aria-hidden="true" />
                </div>
                <h1 className="mt-5 text-2xl font-bold">
                  {isSubscription ? 'Subscription activated' : 'Audit credit added'}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
                  {isSubscription
                    ? `Your ${planLabel(entitlements.plan)} plan is active. ${entitlements.entitlements.auditsPerPeriod} audits are available this billing period.`
                    : 'Your payment is complete and one audit credit has been added to your account. Credits never expire.'}
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-violet-500/12">
                  <Clock className="size-7 text-violet-500" aria-hidden="true" />
                </div>
                <h1 className="mt-5 text-2xl font-bold">Payment processing</h1>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
                  Your payment has been submitted and we are waiting for confirmation from Stripe.
                  This normally takes a few seconds. Your account updates automatically — you do not
                  need to pay again.
                </p>
              </>
            )}

            {simulated ? (
              <Alert tone="warning" className="mt-6 text-left">
                <Badge tone="demo" className="mb-2">
                  Billing test mode
                </Badge>
                <p className="text-sm">
                  This was a simulated checkout. No payment was taken and no Stripe record exists,
                  but the entitlement was applied through the same code path production uses.
                </p>
              </Alert>
            ) : null}

            <dl className="mt-7 grid gap-3 rounded-lg bg-[var(--surface-muted)] p-5 text-left text-sm">
              <Row label="Current plan" value={planLabel(entitlements.plan)} />
              <Row label="One-time credits" value={String(entitlements.oneTimeCredits)} />
              <Row
                label="Audits available now"
                value={String(entitlements.totalAuditsAvailable)}
              />
              {entitlements.periodEnd ? (
                <Row label="Renews" value={formatDate(entitlements.periodEnd)} />
              ) : null}
            </dl>

            <div className="mt-7 flex flex-col gap-2.5">
              <Button asChild size="lg">
                <Link href="/dashboard/audits/new">
                  <Sparkles aria-hidden="true" />
                  Start an audit
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/dashboard/billing">
                  <Coins aria-hidden="true" />
                  View billing
                </Link>
              </Button>
            </div>
          </Card>

          <p className="mt-5 text-center text-xs text-[var(--muted-foreground)]">
            A receipt is available in your{' '}
            <Link href="/dashboard/billing" className="underline underline-offset-4">
              payment history
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--muted-foreground)]">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
