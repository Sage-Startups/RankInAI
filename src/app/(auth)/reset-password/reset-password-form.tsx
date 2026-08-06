'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

import { Alert, FieldError, FieldHint, Input, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { resetPasswordAction } from '@/app/(auth)/actions';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password';
import { firstError, type ActionResult } from '@/lib/validation';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending} loadingText="Updating…">
      Update password
    </Button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    resetPasswordAction,
    null,
  );
  const [password, setPassword] = useState('');

  if (state?.ok) {
    return (
      <Alert tone="success">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" aria-hidden="true" />
          <div>
            <p className="font-semibold text-[var(--foreground)]">Password updated</p>
            <p className="mt-1 text-sm leading-relaxed">{state.message}</p>
            <Button asChild className="mt-4">
              <Link href="/signin?notice=password-reset">Continue to sign in</Link>
            </Button>
          </div>
        </div>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />

      {state?.message && !state.ok ? (
        <Alert tone="danger" role="alert">
          {state.message}
        </Alert>
      ) : null}

      <div>
        <Label htmlFor="reset-password" required>
          New password
        </Label>
        <Input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2"
          aria-describedby="reset-password-hint"
        />
        <FieldHint id="reset-password-hint">
          At least {MIN_PASSWORD_LENGTH} characters, with an uppercase letter, a lowercase letter
          and a number.
        </FieldHint>
        <FieldError message={firstError(state?.fieldErrors, 'password')} />
      </div>

      <div>
        <Label htmlFor="reset-confirm" required>
          Confirm new password
        </Label>
        <Input
          id="reset-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="mt-2"
          aria-invalid={firstError(state?.fieldErrors, 'confirmPassword') ? true : undefined}
        />
        <FieldError message={firstError(state?.fieldErrors, 'confirmPassword')} />
      </div>

      <SubmitButton />
    </form>
  );
}
