'use server';

import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth/guards';
import { createCheckoutSession, createPortalSession } from '@/lib/billing/checkout';
import { isProductKey } from '@/lib/plans';
import { trackEvent } from '@/lib/analytics';
import { formValue, type ActionResult } from '@/lib/validation';

/**
 * Billing actions. All entitlement changes are applied by the Stripe webhook
 * (or, in simulated billing mode, by the same fulfillment code path) — never by
 * the browser.
 */

export async function startCheckoutAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser('/dashboard/billing');

  const raw = formValue(formData, 'productKey') ?? '';
  if (!isProductKey(raw)) {
    return { ok: false, message: 'That plan is not available.' };
  }

  await trackEvent({
    name: 'checkout_started',
    userId: user.id,
    properties: { productKey: raw },
  });

  const result = await createCheckoutSession({ userId: user.id, productKey: raw });

  if (!result.ok || !result.url) {
    return {
      ok: false,
      message: result.error ?? 'We could not start checkout. Please try again.',
    };
  }

  redirect(result.url);
}

export async function openBillingPortalAction(
  _previous: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser('/dashboard/billing');
  const result = await createPortalSession(user.id);

  if (!result.ok || !result.url) {
    return {
      ok: false,
      message: result.error ?? 'The billing portal is unavailable right now.',
    };
  }

  redirect(result.url);
}
