'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  Alert,
  Checkbox,
  FieldError,
  FieldHint,
  Input,
  Label,
  Select,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import {
  changePasswordAction,
  requestAccountDeletionAction,
  sendVerificationEmailAction,
  updateBrandingAction,
  updateEmailPreferencesAction,
  updateProfileAction,
} from '@/app/(app)/dashboard/settings/actions';
import { BUSINESS_TYPES, firstError, type ActionResult } from '@/lib/validation';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password';

function Save({ label = 'Save changes' }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} loadingText="Saving…">
      {label}
    </Button>
  );
}

function Feedback({ state }: { state: ActionResult | null }) {
  if (!state?.message) return null;
  return (
    <Alert tone={state.ok ? 'success' : 'danger'} className="mb-5" role="status">
      {state.message}
    </Alert>
  );
}

export function ProfileForm({
  defaults,
}: {
  defaults: {
    name: string;
    companyName: string;
    companyWebsite: string;
    businessType: string;
  };
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(updateProfileAction, null);

  return (
    <form action={action} noValidate>
      <Feedback state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="settings-name" required>
            Full name
          </Label>
          <Input
            id="settings-name"
            name="name"
            defaultValue={defaults.name}
            required
            maxLength={120}
            className="mt-2"
          />
          <FieldError message={firstError(state?.fieldErrors, 'name')} />
        </div>

        <div>
          <Label htmlFor="settings-company">Company name</Label>
          <Input
            id="settings-company"
            name="companyName"
            defaultValue={defaults.companyName}
            maxLength={160}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="settings-website">Company website</Label>
          <Input
            id="settings-website"
            name="companyWebsite"
            type="text"
            inputMode="url"
            defaultValue={defaults.companyWebsite}
            maxLength={500}
            className="mt-2"
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="settings-business-type">Business type</Label>
          <Select
            id="settings-business-type"
            name="businessType"
            defaultValue={defaults.businessType}
            className="mt-2"
          >
            <option value="">Not specified</option>
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="mt-5">
        <Save />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(changePasswordAction, null);

  return (
    <form action={action} noValidate>
      <Feedback state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="current-password" required>
            Current password
          </Label>
          <Input
            id="current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className="mt-2"
          />
          <FieldError message={firstError(state?.fieldErrors, 'currentPassword')} />
        </div>

        <div>
          <Label htmlFor="new-password" required>
            New password
          </Label>
          <Input
            id="new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            className="mt-2"
            aria-describedby="new-password-hint"
          />
          <FieldHint id="new-password-hint">
            At least {MIN_PASSWORD_LENGTH} characters with upper case, lower case and a number.
          </FieldHint>
          <FieldError message={firstError(state?.fieldErrors, 'newPassword')} />
        </div>

        <div>
          <Label htmlFor="confirm-password" required>
            Confirm new password
          </Label>
          <Input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            className="mt-2"
          />
          <FieldError message={firstError(state?.fieldErrors, 'confirmPassword')} />
        </div>
      </div>
      <div className="mt-5">
        <Save label="Update password" />
      </div>
    </form>
  );
}

export function EmailPreferencesForm({
  defaults,
}: {
  defaults: {
    emailProductUpdates: boolean;
    emailAuditComplete: boolean;
    emailMarketing: boolean;
  };
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    updateEmailPreferencesAction,
    null,
  );

  const options = [
    {
      name: 'emailAuditComplete',
      label: 'Audit completion',
      description: 'Email me when an audit finishes, with the score and a link to the report.',
      defaultChecked: defaults.emailAuditComplete,
    },
    {
      name: 'emailProductUpdates',
      label: 'Product updates',
      description: 'New checks, methodology changes and meaningful platform improvements.',
      defaultChecked: defaults.emailProductUpdates,
    },
    {
      name: 'emailMarketing',
      label: 'Marketing',
      description: 'Occasional emails about pricing, offers and RankInAI news.',
      defaultChecked: defaults.emailMarketing,
    },
  ];

  return (
    <form action={action}>
      <Feedback state={state} />
      <fieldset className="space-y-4">
        <legend className="sr-only">Email preferences</legend>
        {options.map((option) => (
          <div key={option.name} className="flex gap-3">
            <Checkbox id={option.name} name={option.name} defaultChecked={option.defaultChecked} />
            <div>
              <Label htmlFor={option.name} className="font-medium">
                {option.label}
              </Label>
              <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{option.description}</p>
            </div>
          </div>
        ))}
      </fieldset>
      <p className="mt-4 text-xs text-[var(--muted-foreground)]">
        Security and billing emails are always sent — they cannot be switched off.
      </p>
      <div className="mt-5">
        <Save label="Save preferences" />
      </div>
    </form>
  );
}

export function BrandingForm({
  defaults,
  allowed,
}: {
  defaults: { brandingCompanyName: string; brandingLogoUrl: string; brandingAccentColor: string };
  allowed: boolean;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(updateBrandingAction, null);

  return (
    <form action={action} noValidate>
      <Feedback state={state} />
      {!allowed ? (
        <Alert tone="info" className="mb-5">
          White-label reports are an Agency plan feature. You can still save defaults here — they
          will apply automatically once you upgrade.
        </Alert>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="branding-name">Company name on report covers</Label>
          <Input
            id="branding-name"
            name="brandingCompanyName"
            defaultValue={defaults.brandingCompanyName}
            maxLength={120}
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="branding-accent">Accent color</Label>
          <Input
            id="branding-accent"
            name="brandingAccentColor"
            placeholder="#6D5EF0"
            defaultValue={defaults.brandingAccentColor}
            maxLength={7}
            className="mt-2"
          />
          <FieldError message={firstError(state?.fieldErrors, 'brandingAccentColor')} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="branding-logo">Logo URL</Label>
          <Input
            id="branding-logo"
            name="brandingLogoUrl"
            type="url"
            placeholder="https://youragency.com/logo.png"
            defaultValue={defaults.brandingLogoUrl}
            maxLength={1000}
            className="mt-2"
            aria-describedby="branding-logo-hint"
          />
          <FieldHint id="branding-logo-hint">Must be an https:// address.</FieldHint>
          <FieldError message={firstError(state?.fieldErrors, 'brandingLogoUrl')} />
        </div>
      </div>
      <div className="mt-5">
        <Save label="Save branding" />
      </div>
    </form>
  );
}

export function VerifyEmailButton({ verified }: { verified: boolean }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    sendVerificationEmailAction,
    null,
  );

  if (verified) {
    return (
      <Alert tone="success">Your email address is verified.</Alert>
    );
  }

  return (
    <form action={action}>
      <Feedback state={state} />
      <p className="mb-4 text-sm text-[var(--muted-foreground)]">
        Verifying your email address strengthens account recovery. It is not required to run audits.
      </p>
      <Save label="Send confirmation email" />
    </form>
  );
}

export function DeleteAccountForm({ alreadyRequested }: { alreadyRequested: boolean }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    requestAccountDeletionAction,
    null,
  );

  if (alreadyRequested) {
    return (
      <Alert tone="warning" title="Deletion requested">
        Your account is scheduled for deletion. Personal data will be removed within 30 days.
        Contact support if you want to cancel the request.
      </Alert>
    );
  }

  return (
    <form action={action} noValidate>
      <Feedback state={state} />
      <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
        Requesting deletion removes your personal data and audit history within 30 days. Financial
        records are retained where the law requires it. This cannot be undone from here.
      </p>
      <div className="mt-4 max-w-xs">
        <Label htmlFor="delete-confirm" required>
          Type DELETE to confirm
        </Label>
        <Input
          id="delete-confirm"
          name="confirm"
          placeholder="DELETE"
          autoComplete="off"
          className="mt-2"
        />
        <FieldError message={firstError(state?.fieldErrors, 'confirm')} />
      </div>
      <div className="mt-5">
        <Button type="submit" variant="danger">
          Request account deletion
        </Button>
      </div>
    </form>
  );
}
