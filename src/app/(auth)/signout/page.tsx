import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth';
import { getCurrentUser } from '@/lib/auth/guards';

export const metadata: Metadata = {
  title: 'Sign out',
  robots: { index: false, follow: false },
};

/**
 * Sign-out confirmation.
 *
 * Signing out happens through a POST server action rather than a GET link, so a
 * third-party page cannot log a user out with an image tag.
 */
export default async function SignOutPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/signin?notice=signed-out');

  async function confirmSignOut() {
    'use server';
    await signOut({ redirectTo: '/signin?notice=signed-out' });
  }

  return (
    <div>
      <LogOut className="size-10 text-violet-500" aria-hidden="true" />
      <h1 className="mt-5 text-2xl font-bold">Sign out of RankInAI?</h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
        You are signed in as <strong className="text-[var(--foreground)]">{user.email}</strong>.
        Your audits and reports stay in your account.
      </p>

      <form action={confirmSignOut} className="mt-7">
        <Button type="submit" size="lg" className="w-full">
          Sign out
        </Button>
      </form>

      <Button asChild size="lg" variant="secondary" className="mt-2.5 w-full">
        <a href="/dashboard">Stay signed in</a>
      </Button>
    </div>
  );
}
