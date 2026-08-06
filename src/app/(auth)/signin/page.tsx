import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Alert } from '@/components/ui/primitives';
import { SignInForm } from '@/app/(auth)/signin/signin-form';
import { getCurrentUser } from '@/lib/auth/guards';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your RankInAI account to run audits and open your reports.',
};

const NOTICES: Record<string, { tone: 'success' | 'info' | 'warning'; message: string }> = {
  'password-reset': {
    tone: 'success',
    message: 'Your password has been updated. Sign in with your new password.',
  },
  'signed-out': { tone: 'info', message: 'You have been signed out.' },
  'session-expired': {
    tone: 'warning',
    message: 'Your session expired. Please sign in again.',
  },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; notice?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const { callbackUrl, notice } = await searchParams;
  const noticeConfig = notice ? NOTICES[notice] : undefined;

  return (
    <div>
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        New to RankInAI?{' '}
        <Link href="/signup" className="text-[var(--accent)] underline underline-offset-4">
          Create an account
        </Link>
      </p>

      {noticeConfig ? (
        <Alert tone={noticeConfig.tone} className="mt-6">
          {noticeConfig.message}
        </Alert>
      ) : null}

      <div className="mt-7">
        <SignInForm callbackUrl={callbackUrl ?? null} />
      </div>
    </div>
  );
}
