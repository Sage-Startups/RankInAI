import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, MailCheck, XCircle } from 'lucide-react';

import { Alert } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/db';
import { hashToken } from '@/lib/crypto';

export const metadata: Metadata = {
  title: 'Email verification',
  robots: { index: false, follow: false },
};

type State = 'pending' | 'verified' | 'invalid' | 'already';

/**
 * Email verification landing page.
 *
 * Verification is architecturally supported end to end: tokens are issued,
 * hashed, expired and consumed here. Accounts remain usable before
 * verification — it strengthens the account rather than gating it, which keeps
 * the product usable when no email provider is configured.
 */
async function consumeToken(token: string): Promise<State> {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, emailVerified: true, deletedAt: true } } },
  });

  if (!record || record.user.deletedAt) return 'invalid';
  if (record.usedAt) return 'already';
  if (record.expiresAt < new Date()) return 'invalid';

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return 'verified';
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const state: State = token ? await consumeToken(token) : 'pending';

  return (
    <div>
      {state === 'verified' ? (
        <>
          <CheckCircle2 className="size-10 text-emerald-500" aria-hidden="true" />
          <h1 className="mt-5 text-2xl font-bold">Email address confirmed</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
            Thanks — your email address is verified. You will receive audit notifications and
            account security emails at this address.
          </p>
          <Button asChild size="lg" className="mt-7 w-full">
            <Link href="/dashboard">Go to your dashboard</Link>
          </Button>
        </>
      ) : state === 'already' ? (
        <>
          <CheckCircle2 className="size-10 text-emerald-500" aria-hidden="true" />
          <h1 className="mt-5 text-2xl font-bold">Already confirmed</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
            This email address has already been verified. Nothing further is needed.
          </p>
          <Button asChild size="lg" className="mt-7 w-full">
            <Link href="/dashboard">Go to your dashboard</Link>
          </Button>
        </>
      ) : state === 'invalid' ? (
        <>
          <XCircle className="size-10 text-red-500" aria-hidden="true" />
          <h1 className="mt-5 text-2xl font-bold">This link is no longer valid</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
            Verification links expire after 24 hours and can only be used once. Request a new one
            from your account settings.
          </p>
          <Alert tone="info" className="mt-6">
            Your account still works normally. Verifying your email address strengthens account
            recovery — it is not required to run audits.
          </Alert>
          <Button asChild size="lg" className="mt-7 w-full">
            <Link href="/dashboard/settings">Open settings</Link>
          </Button>
        </>
      ) : (
        <>
          <MailCheck className="size-10 text-violet-500" aria-hidden="true" />
          <h1 className="mt-5 text-2xl font-bold">Confirm your email address</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
            We sent a confirmation link to the address on your account. Open it to verify your
            email. The link expires in 24 hours.
          </p>
          <Alert tone="info" className="mt-6">
            Cannot find it? Check your spam folder. You can send a new confirmation email from your
            account settings at any time.
          </Alert>
          <div className="mt-7 flex flex-col gap-2.5">
            <Button asChild size="lg">
              <Link href="/dashboard">Continue to your dashboard</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/dashboard/settings">Open settings</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
