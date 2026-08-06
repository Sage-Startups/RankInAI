import type { Metadata } from 'next';
import Link from 'next/link';

import { Alert } from '@/components/ui/primitives';
import { ResetPasswordForm } from '@/app/(auth)/reset-password/reset-password-form';

export const metadata: Metadata = {
  title: 'Choose a new password',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
        Pick a password you do not use anywhere else.
      </p>

      {!token ? (
        <Alert tone="danger" className="mt-6" title="This reset link is incomplete">
          The link you followed did not include a reset token.{' '}
          <Link href="/forgot-password" className="underline underline-offset-4">
            Request a new reset link
          </Link>
          .
        </Alert>
      ) : (
        <div className="mt-7">
          <ResetPasswordForm token={token} />
        </div>
      )}

      <p className="mt-7 text-center text-sm text-[var(--muted-foreground)]">
        <Link href="/signin" className="text-[var(--accent)] underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
