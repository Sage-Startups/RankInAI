'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { ExternalLink } from 'lucide-react';

import { Alert } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import {
  openBillingPortalAction,
  startCheckoutAction,
} from '@/app/(app)/dashboard/billing/actions';
import { track } from '@/components/site/analytics-provider';
import type { ActionResult } from '@/lib/validation';
import type { ProductKey } from '@/lib/plans';

function PendingButton({
  children,
  variant = 'primary',
  className,
  onClick,
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  className?: string;
  onClick?: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      className={className}
      loading={pending}
      loadingText="Opening checkout…"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function CheckoutButton({
  productKey,
  label,
  variant = 'primary',
  className,
}: {
  productKey: ProductKey;
  label: string;
  variant?: 'primary' | 'secondary' | 'outline';
  className?: string;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    startCheckoutAction,
    null,
  );

  return (
    <form action={formAction} className={className}>
      <input type="hidden" name="productKey" value={productKey} />
      {state?.message && !state.ok ? (
        <Alert tone="danger" className="mb-3" role="alert">
          {state.message}
        </Alert>
      ) : null}
      <PendingButton
        variant={variant}
        className="w-full"
        onClick={() => track('plan_selected', { productKey })}
      >
        {label}
      </PendingButton>
    </form>
  );
}

export function BillingPortalButton({ disabled, reason }: { disabled: boolean; reason?: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    openBillingPortalAction,
    null,
  );

  if (disabled) {
    return (
      <div>
        <Button variant="secondary" disabled>
          <ExternalLink aria-hidden="true" />
          Open billing portal
        </Button>
        {reason ? <p className="mt-2 text-xs text-[var(--muted-foreground)]">{reason}</p> : null}
      </div>
    );
  }

  return (
    <form action={formAction}>
      {state?.message && !state.ok ? (
        <Alert tone="warning" className="mb-3" role="alert">
          {state.message}
        </Alert>
      ) : null}
      <Button type="submit" variant="secondary">
        <ExternalLink aria-hidden="true" />
        Open billing portal
      </Button>
    </form>
  );
}
