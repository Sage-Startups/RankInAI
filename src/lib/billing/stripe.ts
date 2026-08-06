import Stripe from 'stripe';

import { getEnv } from '@/lib/env';

/**
 * Stripe client factory.
 *
 * Returns null when no secret key is configured, which is a supported state:
 * the app then runs in simulated billing test mode.
 */

let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  const env = getEnv();
  if (!env.STRIPE_SECRET_KEY) return null;
  if (!cached) {
    cached = new Stripe(env.STRIPE_SECRET_KEY, {
      // Pinning the version keeps webhook payload shapes stable across deploys.
      apiVersion: '2026-07-29.dahlia',
      appInfo: { name: 'RankInAI', version: '1.0.0' },
      maxNetworkRetries: 2,
      timeout: 20_000,
    });
  }
  return cached;
}

export function requireStripe(): Stripe {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error(
      'Stripe is not configured. Set STRIPE_SECRET_KEY, or enable BILLING_TEST_MODE for simulated checkout.',
    );
  }
  return stripe;
}

/** True when checkout is simulated rather than sent to Stripe. */
export function isBillingSimulated(): boolean {
  const env = getEnv();
  return env.billingTestMode || !env.stripeConfigured;
}

/** Human-readable explanation of the current billing mode, for the UI banner. */
export function billingModeLabel(): string {
  const env = getEnv();
  if (!env.stripeConfigured) {
    return 'Billing test mode — Stripe is not configured, so checkout is simulated and no payment is taken.';
  }
  if (env.billingTestMode) {
    return 'Billing test mode — checkout is simulated locally and no payment is taken.';
  }
  return 'Live billing';
}
