import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { getEnv } from '@/lib/env';
import { getStripe } from '@/lib/billing/stripe';
import { processStripeEvent } from '@/lib/billing/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Stripe webhook receiver.
 *
 * Webhooks are the source of truth for entitlements. Every request must carry a
 * valid signature — an unsigned or mis-signed payload is rejected before any
 * business logic runs, and the raw body is read exactly as sent so the
 * signature check is meaningful.
 */
export async function POST(request: Request) {
  const env = getEnv();
  const stripe = getStripe();

  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'Stripe webhooks are not configured on this deployment.' },
      { status: 503 },
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  // Must be the raw body, not a parsed object.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Invalid signature';
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'warn',
        service: 'rankinai-web',
        message: 'Rejected Stripe webhook with an invalid signature',
        detail: detail.slice(0, 200),
      }),
    );
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  }

  try {
    const result = await processStripeEvent(event);
    return NextResponse.json({
      received: true,
      handled: result.handled,
      duplicate: result.duplicate,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        service: 'rankinai-web',
        message: 'Stripe webhook processing failed',
        eventId: event.id,
        eventType: event.type,
        error: error instanceof Error ? error.message : 'unknown',
      }),
    );
    // A 500 makes Stripe retry, which is the correct behavior for a transient
    // database problem. Idempotency guards prevent duplicate fulfillment.
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
