'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { MailCheck } from 'lucide-react';

import { Alert, FieldError, Input, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { requestPasswordResetAction } from '@/app/(auth)/actions';
import { firstError, type ActionResult } from '@/lib/validation';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending} loadingText="Sending…">
      Send reset link
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    requestPasswordResetAction,
    null,
  );

  if (state?.ok) {
    return (
      <Alert tone="success">
        <div className="flex items-start gap-3">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" aria-hidden="true" />
          <div>
            <p className="font-semibold text-[var(--foreground)]">Check your inbox</p>
            <p className="mt-1 text-sm leading-relaxed">{state.message}</p>
          </div>
        </div>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state?.message && !state.ok ? (
        <Alert tone="danger" role="alert">
          {state.message}
        </Alert>
      ) : null}

      <div>
        <Label htmlFor="forgot-email" required>
          Email
        </Label>
        <Input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          className="mt-2"
          aria-invalid={firstError(state?.fieldErrors, 'email') ? true : undefined}
          aria-describedby={firstError(state?.fieldErrors, 'email') ? 'forgot-email-error' : undefined}
        />
        <FieldError id="forgot-email-error" message={firstError(state?.fieldErrors, 'email')} />
      </div>

      <SubmitButton />
    </form>
  );
}
