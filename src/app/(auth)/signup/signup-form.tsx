'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';

import { Alert, Checkbox, FieldError, FieldHint, Input, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { signUpAction } from '@/app/(auth)/actions';
import { checkPasswordStrength, MIN_PASSWORD_LENGTH } from '@/lib/auth/password';
import { firstError, type ActionResult } from '@/lib/validation';
import { track } from '@/components/site/analytics-provider';
import { cn } from '@/lib/utils';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      className="w-full"
      loading={pending}
      loadingText="Creating your account…"
      onClick={() => track('signup_started')}
    >
      Create account
    </Button>
  );
}

const STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-emerald-500',
];

export function SignUpForm({ plan }: { plan: string | null }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(signUpAction, null);
  const [password, setPassword] = useState('');
  const strength = password ? checkPasswordStrength(password) : null;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {plan ? <input type="hidden" name="plan" value={plan} /> : null}

      {state?.message && !state.ok ? (
        <Alert tone="danger" role="alert">
          {state.message}
        </Alert>
      ) : null}
      {state?.message && state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <div>
        <Label htmlFor="signup-name" required>
          Full name
        </Label>
        <Input
          id="signup-name"
          name="name"
          autoComplete="name"
          required
          maxLength={120}
          className="mt-2"
          aria-invalid={firstError(state?.fieldErrors, 'name') ? true : undefined}
          aria-describedby={firstError(state?.fieldErrors, 'name') ? 'signup-name-error' : undefined}
        />
        <FieldError id="signup-name-error" message={firstError(state?.fieldErrors, 'name')} />
      </div>

      <div>
        <Label htmlFor="signup-email" required>
          Work email
        </Label>
        <Input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={200}
          className="mt-2"
          aria-invalid={firstError(state?.fieldErrors, 'email') ? true : undefined}
          aria-describedby={firstError(state?.fieldErrors, 'email') ? 'signup-email-error' : undefined}
        />
        <FieldError id="signup-email-error" message={firstError(state?.fieldErrors, 'email')} />
      </div>

      <div>
        <Label htmlFor="signup-password" required>
          Password
        </Label>
        <Input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2"
          aria-invalid={firstError(state?.fieldErrors, 'password') ? true : undefined}
          aria-describedby="signup-password-hint"
        />
        {password ? (
          <div className="mt-2.5">
            <div className="flex gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors',
                    strength && index < strength.strength
                      ? STRENGTH_COLORS[strength.strength - 1]
                      : 'bg-[var(--border)]',
                  )}
                />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)]" aria-live="polite">
              Password strength: {STRENGTH_LABELS[strength?.strength ?? 0]}
            </p>
          </div>
        ) : null}
        <FieldHint id="signup-password-hint">
          At least {MIN_PASSWORD_LENGTH} characters, with an uppercase letter, a lowercase letter
          and a number.
        </FieldHint>
        <FieldError message={firstError(state?.fieldErrors, 'password')} />
      </div>

      <div>
        <Label htmlFor="signup-confirm" required>
          Confirm password
        </Label>
        <Input
          id="signup-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="mt-2"
          aria-invalid={firstError(state?.fieldErrors, 'confirmPassword') ? true : undefined}
          aria-describedby={
            firstError(state?.fieldErrors, 'confirmPassword') ? 'signup-confirm-error' : undefined
          }
        />
        <FieldError
          id="signup-confirm-error"
          message={firstError(state?.fieldErrors, 'confirmPassword')}
        />
      </div>

      <div className="flex gap-3">
        <Checkbox id="signup-terms" name="acceptTerms" value="on" required />
        <Label htmlFor="signup-terms" className="text-sm font-normal leading-relaxed">
          I agree to the{' '}
          <Link href="/legal/terms" className="text-[var(--accent)] underline underline-offset-4">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/legal/privacy" className="text-[var(--accent)] underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </Label>
      </div>
      <FieldError message={firstError(state?.fieldErrors, 'acceptTerms')} />

      <SubmitButton />
    </form>
  );
}
