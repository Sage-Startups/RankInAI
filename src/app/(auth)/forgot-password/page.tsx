import type { Metadata } from 'next';
import Link from 'next/link';

import { ForgotPasswordForm } from '@/app/(auth)/forgot-password/forgot-password-form';

export const metadata: Metadata = {
  title: 'Reset your password',
  description: 'Request a password reset link for your RankInAI account.',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
        Enter the email address on your account and we&apos;ll send you a link to choose a new
        password. Links expire after 60 minutes and can be used once.
      </p>

      <div className="mt-7">
        <ForgotPasswordForm />
      </div>

      <p className="mt-7 text-center text-sm text-[var(--muted-foreground)]">
        Remembered it?{' '}
        <Link href="/signin" className="text-[var(--accent)] underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
