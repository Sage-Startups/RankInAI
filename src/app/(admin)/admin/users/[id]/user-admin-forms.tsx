'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Alert, FieldError, Input, Label, Select } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import {
  adjustCreditsAction,
  changeRoleAction,
  setSuspensionAction,
} from '@/app/(admin)/admin/actions';
import { firstError, type ActionResult } from '@/lib/validation';

function Submit({
  label,
  variant = 'primary',
}: {
  label: string;
  variant?: 'primary' | 'danger' | 'secondary';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} loading={pending} loadingText="Working…">
      {label}
    </Button>
  );
}

function Feedback({ state }: { state: ActionResult | null }) {
  if (!state?.message) return null;
  return (
    <Alert tone={state.ok ? 'success' : 'danger'} className="mb-4" role="status">
      {state.message}
    </Alert>
  );
}

export function CreditAdjustForm({ userId }: { userId: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(adjustCreditsAction, null);

  return (
    <form action={action} noValidate>
      <Feedback state={state} />
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <div>
          <Label htmlFor="credit-amount" required>
            Amount
          </Label>
          <Input
            id="credit-amount"
            name="amount"
            type="number"
            step={1}
            min={-100}
            max={100}
            defaultValue={1}
            required
            className="mt-2"
          />
          <FieldError message={firstError(state?.fieldErrors, 'amount')} />
        </div>
        <div>
          <Label htmlFor="credit-reason" required>
            Reason (recorded in the audit trail)
          </Label>
          <Input
            id="credit-reason"
            name="reason"
            required
            minLength={3}
            maxLength={300}
            placeholder="Goodwill credit after a support issue"
            className="mt-2"
          />
          <FieldError message={firstError(state?.fieldErrors, 'reason')} />
        </div>
      </div>
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        Use a negative number to revoke credits. The balance never drops below zero.
      </p>
      <div className="mt-4">
        <Submit label="Apply credit adjustment" />
      </div>
    </form>
  );
}

export function SuspensionForm({ userId, suspended }: { userId: string; suspended: boolean }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(setSuspensionAction, null);

  return (
    <form action={action} noValidate>
      <Feedback state={state} />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="suspend" value={suspended ? 'false' : 'true'} />

      {!suspended ? (
        <div className="mb-4">
          <Label htmlFor="suspend-reason">Reason (optional)</Label>
          <Input
            id="suspend-reason"
            name="reason"
            maxLength={300}
            placeholder="Repeated terms violations"
            className="mt-2"
          />
        </div>
      ) : null}

      <p className="mb-4 text-sm text-[var(--muted-foreground)]">
        {suspended
          ? 'Reactivating restores sign-in access immediately. Existing audits and credits are unaffected.'
          : 'Suspending blocks sign-in immediately. Audits and credits are preserved and restored if the account is reactivated.'}
      </p>

      <Submit
        label={suspended ? 'Reactivate account' : 'Suspend account'}
        variant={suspended ? 'primary' : 'danger'}
      />
    </form>
  );
}

export function RoleForm({ userId, currentRole }: { userId: string; currentRole: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(changeRoleAction, null);

  return (
    <form action={action} noValidate>
      <Feedback state={state} />
      <input type="hidden" name="userId" value={userId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="role-select" required>
            Role
          </Label>
          <Select id="role-select" name="role" defaultValue={currentRole} className="mt-2">
            <option value="USER">User</option>
            <option value="SUPER_ADMIN">Super admin</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="role-confirm" required>
            Type CONFIRM
          </Label>
          <Input
            id="role-confirm"
            name="confirm"
            placeholder="CONFIRM"
            autoComplete="off"
            required
            className="mt-2"
          />
          <FieldError message={firstError(state?.fieldErrors, 'confirm')} />
        </div>
      </div>

      <p className="mt-3 text-xs text-[var(--muted-foreground)]">
        Super admins can see every account, audit and payment on the platform, and can grant
        credits. Grant this role deliberately.
      </p>

      <div className="mt-4">
        <Submit label="Change role" variant="secondary" />
      </div>
    </form>
  );
}
