'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Alert, FieldError, FieldHint, Input, Label, Select } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import {
  completeOnboardingAction,
  skipOnboardingAction,
} from '@/app/onboarding/actions';
import { BUSINESS_TYPES, USE_CASES, firstError, type ActionResult } from '@/lib/validation';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" loading={pending} loadingText="Saving…">
      Continue
    </Button>
  );
}

function SkipButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant="ghost" loading={pending}>
      Skip for now
    </Button>
  );
}

export function OnboardingForm({
  defaults,
}: {
  defaults: { fullName: string; companyName: string; companyWebsite: string };
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    completeOnboardingAction,
    null,
  );

  return (
    <div>
      <form action={action} className="space-y-5" noValidate>
        {state?.message && !state.ok ? (
          <Alert tone="danger" role="alert">
            {state.message}
          </Alert>
        ) : null}

        <div>
          <Label htmlFor="onboarding-name" required>
            Full name
          </Label>
          <Input
            id="onboarding-name"
            name="fullName"
            defaultValue={defaults.fullName}
            required
            autoFocus
            maxLength={120}
            className="mt-2"
          />
          <FieldError message={firstError(state?.fieldErrors, 'fullName')} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="onboarding-company">Company name</Label>
            <Input
              id="onboarding-company"
              name="companyName"
              defaultValue={defaults.companyName}
              maxLength={160}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="onboarding-website">Company website</Label>
            <Input
              id="onboarding-website"
              name="companyWebsite"
              type="text"
              inputMode="url"
              placeholder="yourcompany.com"
              defaultValue={defaults.companyWebsite}
              maxLength={500}
              className="mt-2"
              aria-describedby="onboarding-website-hint"
            />
            <FieldHint id="onboarding-website-hint">
              We&apos;ll pre-fill this when you start an audit.
            </FieldHint>
            <FieldError message={firstError(state?.fieldErrors, 'companyWebsite')} />
          </div>
        </div>

        <div>
          <Label htmlFor="onboarding-use-case">What will you mainly use RankInAI for?</Label>
          <Select id="onboarding-use-case" name="primaryUseCase" className="mt-2" defaultValue="">
            <option value="">Select an option</option>
            {USE_CASES.map((useCase) => (
              <option key={useCase} value={useCase}>
                {useCase}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="onboarding-business-type">What kind of business is it?</Label>
          <Select id="onboarding-business-type" name="businessType" className="mt-2" defaultValue="">
            <option value="">Select an option</option>
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">Whose websites will you audit?</legend>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
            {[
              { value: 'own', label: 'My own website' },
              { value: 'client', label: 'Client websites' },
              { value: 'both', label: 'Both' },
            ].map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--border-strong)] px-4 py-3 text-sm transition-colors hover:bg-[var(--surface-muted)] has-[:checked]:border-violet-500 has-[:checked]:bg-violet-500/8"
              >
                <input
                  type="radio"
                  name="auditingOwnWebsite"
                  value={option.value}
                  className="size-4 accent-violet-600"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="pt-2">
          <Submit />
        </div>
      </form>

      <form action={skipOnboardingAction} className="mt-3">
        <SkipButton />
      </form>
    </div>
  );
}
