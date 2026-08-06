import type { Metadata } from 'next';
import Link from 'next/link';
import { XCircle } from 'lucide-react';

import { Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/logo';
import { PRODUCTS, isProductKey } from '@/lib/plans';
import { formatUsd } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Checkout cancelled',
  robots: { index: false, follow: false },
};

export default async function CheckoutCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: raw } = await searchParams;
  const product = raw && isProductKey(raw) ? PRODUCTS[raw] : null;

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface-muted)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="rk-container flex h-16 items-center">
          <Logo />
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <Card className="p-6 text-center sm:p-8">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--surface-muted)]">
              <XCircle className="size-7 text-[var(--muted-foreground)]" aria-hidden="true" />
            </div>
            <h1 className="mt-5 text-2xl font-bold">Checkout cancelled</h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
              No payment was taken and nothing has changed on your account.
              {product
                ? ` The ${product.name} plan (${formatUsd(product.priceCents)}) is still available whenever you're ready.`
                : ''}
            </p>

            <div className="mt-7 flex flex-col gap-2.5">
              {product ? (
                <Button asChild size="lg">
                  <Link href={`/checkout/start?plan=${product.key}`}>Try {product.name} again</Link>
                </Button>
              ) : null}
              <Button asChild size="lg" variant={product ? 'secondary' : 'primary'}>
                <Link href="/dashboard/billing">Back to billing</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/dashboard">Go to my dashboard</Link>
              </Button>
            </div>
          </Card>

          <p className="mt-5 text-center text-xs leading-relaxed text-[var(--muted-foreground)]">
            Something go wrong at checkout?{' '}
            <Link href="/contact" className="underline underline-offset-4">
              Tell us what happened
            </Link>{' '}
            and we&apos;ll help.
          </p>
        </div>
      </main>
    </div>
  );
}
