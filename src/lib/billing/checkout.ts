import { PaymentKind, PaymentStatus, type PlanTier, SubscriptionStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { PRODUCTS, stripePriceIdFor, type ProductKey } from '@/lib/plans';
import { getStripe, isBillingSimulated } from '@/lib/billing/stripe';
import { grantCredits } from '@/lib/credits';
import { CreditReason } from '@prisma/client';

/**
 * Checkout session creation for both one-time and subscription products.
 *
 * In simulated billing mode the Stripe call is skipped entirely and the local
 * fulfillment path runs immediately, so the full purchase journey is testable
 * without network access or Stripe keys.
 */

export interface CheckoutResult {
  ok: boolean;
  url: string | null;
  simulated: boolean;
  error: string | null;
}

/** Ensure the user has a Stripe customer, creating one on first purchase. */
export async function ensureStripeCustomer(userId: string): Promise<string | null> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, name: true, stripeCustomerId: true },
  });

  if (user.stripeCustomerId) return user.stripeCustomerId;

  const stripe = getStripe();
  if (!stripe) return null;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { rankinaiUserId: user.id },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createCheckoutSession(params: {
  userId: string;
  productKey: ProductKey;
}): Promise<CheckoutResult> {
  const env = getEnv();
  const product = PRODUCTS[params.productKey];
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');

  if (isBillingSimulated()) {
    const sessionId = `sim_${params.productKey.toLowerCase()}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    await fulfillSimulatedCheckout({
      userId: params.userId,
      productKey: params.productKey,
      sessionId,
    });
    // Relative on purpose: the simulated flow never leaves the application, so
    // it must not depend on NEXT_PUBLIC_APP_URL matching the host the browser
    // is actually using (it often will not on a preview or local port).
    return {
      ok: true,
      simulated: true,
      url: `/checkout/success?session_id=${sessionId}&simulated=1&product=${params.productKey}`,
      error: null,
    };
  }

  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, url: null, simulated: false, error: 'Stripe is not configured.' };
  }

  const priceId = stripePriceIdFor(params.productKey);
  if (!priceId) {
    return {
      ok: false,
      url: null,
      simulated: false,
      error: `No Stripe price configured for ${product.name}. Set ${product.envVar} and redeploy.`,
    };
  }

  const customerId = await ensureStripeCustomer(params.userId);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: product.interval === 'one_time' ? 'payment' : 'subscription',
      customer: customerId ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout/cancelled?product=${params.productKey}`,
      client_reference_id: params.userId,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: {
        rankinaiUserId: params.userId,
        productKey: params.productKey,
      },
      ...(product.interval === 'month'
        ? {
            subscription_data: {
              metadata: { rankinaiUserId: params.userId, productKey: params.productKey },
            },
          }
        : {
            payment_intent_data: {
              metadata: { rankinaiUserId: params.userId, productKey: params.productKey },
            },
          }),
    });

    // Record the pending payment so the webhook has something to reconcile to.
    await prisma.payment.upsert({
      where: { stripeCheckoutSessionId: session.id },
      create: {
        userId: params.userId,
        stripeCheckoutSessionId: session.id,
        stripeCustomerId: customerId,
        kind:
          product.interval === 'one_time' ? PaymentKind.ONE_TIME_AUDIT : PaymentKind.SUBSCRIPTION,
        status: PaymentStatus.PENDING,
        amountCents: product.priceCents,
        currency: 'usd',
        description: product.name,
        productKey: params.productKey,
        isDemo: false,
      },
      update: {},
    });

    return { ok: true, url: session.url, simulated: false, error: null };
  } catch (error) {
    return {
      ok: false,
      url: null,
      simulated: false,
      error: error instanceof Error ? error.message : 'Could not start checkout.',
    };
  }
}

/**
 * Local fulfillment used when billing test mode is on.
 *
 * Mirrors exactly what the Stripe webhook does, so the same entitlement code
 * path is exercised by the test suite.
 */
export async function fulfillSimulatedCheckout(params: {
  userId: string;
  productKey: ProductKey;
  sessionId: string;
}): Promise<void> {
  const product = PRODUCTS[params.productKey];

  const existing = await prisma.payment.findUnique({
    where: { stripeCheckoutSessionId: params.sessionId },
  });
  if (existing?.status === PaymentStatus.SUCCEEDED) return;

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.upsert({
      where: { stripeCheckoutSessionId: params.sessionId },
      create: {
        userId: params.userId,
        stripeCheckoutSessionId: params.sessionId,
        kind:
          product.interval === 'one_time' ? PaymentKind.ONE_TIME_AUDIT : PaymentKind.SUBSCRIPTION,
        status: PaymentStatus.SUCCEEDED,
        amountCents: product.priceCents,
        currency: 'usd',
        description: `${product.name} (simulated test-mode payment)`,
        productKey: params.productKey,
        isDemo: false,
        paidAt: new Date(),
      },
      update: { status: PaymentStatus.SUCCEEDED, paidAt: new Date() },
    });

    if (product.interval === 'one_time') {
      await tx.purchase.create({
        data: {
          userId: params.userId,
          paymentId: payment.id,
          productKey: params.productKey,
          creditsGranted: 1,
          amountCents: product.priceCents,
          isDemo: false,
        },
      });
      await grantCredits({
        userId: params.userId,
        amount: 1,
        reason: CreditReason.ONE_TIME_PURCHASE,
        note: 'One-Time Full Audit (simulated test-mode payment)',
        tx,
      });
      return;
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const existingSubscription = await tx.subscription.findFirst({
      where: { userId: params.userId },
      orderBy: { createdAt: 'desc' },
    });

    if (existingSubscription) {
      await tx.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          plan: product.plan,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          // A plan change resets the period allowance.
          auditsUsedThisPeriod:
            existingSubscription.plan === product.plan
              ? existingSubscription.auditsUsedThisPeriod
              : 0,
        },
      });
    } else {
      await tx.subscription.create({
        data: {
          userId: params.userId,
          stripeSubscriptionId: `sim_sub_${params.userId.slice(0, 8)}_${Date.now()}`,
          plan: product.plan,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          auditsUsedThisPeriod: 0,
          isDemo: false,
        },
      });
    }
  });
}

/** Create a Stripe Customer Portal session for self-service management. */
export async function createPortalSession(userId: string): Promise<CheckoutResult> {
  const env = getEnv();
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const stripe = getStripe();

  if (!stripe) {
    return {
      ok: false,
      url: null,
      simulated: true,
      error:
        'The Stripe Customer Portal is unavailable while billing test mode is active. Configure STRIPE_SECRET_KEY to enable it.',
    };
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (!user.stripeCustomerId) {
    return {
      ok: false,
      url: null,
      simulated: false,
      error: 'No billing account exists yet. Make a purchase first.',
    };
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl}/dashboard/billing`,
    });
    return { ok: true, url: session.url, simulated: false, error: null };
  } catch (error) {
    return {
      ok: false,
      url: null,
      simulated: false,
      error: error instanceof Error ? error.message : 'Could not open the billing portal.',
    };
  }
}

export function planForProductKey(key: ProductKey): PlanTier {
  return PRODUCTS[key].plan;
}
