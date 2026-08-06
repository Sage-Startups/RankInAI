'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';

import { Alert, Input, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { signInAction } from '@/app/(auth)/actions';
import type { ActionResult } from '@/lib/validation';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending} loadingText="Signing in…">
      Sign in
    </Button>
  );
}

export function SignInForm({ callbackUrl }: { callbackUrl: string | null }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(signInAction, null);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}

      {state?.message && !state.ok ? (
        <Alert tone="danger" role="alert">
          {state.message}
        </Alert>
      ) : null}

      <div>
        <Label htmlFor="signin-email" required>
          Email
        </Label>
        <Input
          id="signin-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          className="mt-2"
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="signin-password" required>
            Password
          </Label>
          <Link
            href="/forgot-password"
            className="text-xs text-[var(--accent)] underline underline-offset-4"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="signin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
