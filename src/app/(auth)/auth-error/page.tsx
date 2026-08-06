import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

import { Alert } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Sign-in problem',
  robots: { index: false, follow: false },
};

/**
 * Authentication error page.
 *
 * Messages are deliberately non-specific about account existence — an error
 * page must not become an enumeration oracle.
 */
const ERRORS: Record<string, { title: string; body: string }> = {
  AccountSuspended: {
    title: 'This account has been suspended',
    body: 'Access to this account is currently disabled. If you believe this is a mistake, contact support and we will review it.',
  },
  CredentialsSignin: {
    title: 'We could not sign you in',
    body: 'The email address or password did not match. Check both and try again, or reset your password.',
  },
  SessionRequired: {
    title: 'Please sign in to continue',
    body: 'That page requires an account. Sign in and we will take you straight there.',
  },
  Configuration: {
    title: 'Sign-in is temporarily unavailable',
    body: 'There is a problem with the authentication configuration on this deployment. This has been logged. Please try again shortly.',
  },
  AccessDenied: {
    title: 'Access denied',
    body: 'Your account does not have permission to open that page.',
  },
  Verification: {
    title: 'That link is no longer valid',
    body: 'Sign-in links expire and can only be used once. Request a new one.',
  },
};

const DEFAULT_ERROR = {
  title: 'Something went wrong signing in',
  body: 'We could not complete that request. Please try again — if it keeps happening, contact support.',
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const settings = await getSettings();
  const detail = (error && ERRORS[error]) || DEFAULT_ERROR;

  return (
    <div>
      <ShieldAlert className="size-10 text-amber-500" aria-hidden="true" />
      <h1 className="mt-5 text-2xl font-bold">{detail.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">{detail.body}</p>

      <div className="mt-7 flex flex-col gap-2.5">
        <Button asChild size="lg">
          <Link href="/signin">Back to sign in</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/forgot-password">Reset your password</Link>
        </Button>
      </div>

      <Alert tone="neutral" className="mt-7">
        Still stuck? Email{' '}
        <a
          href={`mailto:${settings.supportEmail}`}
          className="text-[var(--accent)] underline underline-offset-4"
        >
          {settings.supportEmail}
        </a>{' '}
        or use the{' '}
        <Link href="/contact" className="text-[var(--accent)] underline underline-offset-4">
          contact form
        </Link>
        .
      </Alert>
    </div>
  );
}
