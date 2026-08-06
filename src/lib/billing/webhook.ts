import type Stripe from 'stripe';
import {
  CreditReason,
  PaymentKind,
  PaymentStatus,
  PlanTier,
  SubscriptionStatus,
  WebhookStatus,
  Prisma,
} from '@prisma/client';

import { prisma } from '@/lib/db';
import { grantCredits } from '@/lib/credits';
import { PRODUCTS, isProductKey, productForStripePriceId, type ProductKey } from '@/lib/plans';

/**
 * Stripe webhook processing.
 *
 * Webhooks are the source of truth for entitlements — the browser never grants
 * anything. Idempotency is enforced by `StripeWebhookEvent.stripeEventId`
 * (unique): a duplicate delivery hits the unique constraint and returns early,
 * so a credit can never be granted twice.
 */

export const HANDLED_EVENT_TYPES = [
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
] as const;

export interface WebhookProcessResult {
  handled: boolean;
  duplicate: boolean;
  message: string;
}

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  incomplete: SubscriptionStatus.INCOMPLETE,
  incomplete_expired: SubscriptionStatus.CANCELED,
  trialing: SubscriptionStatus.TRIALING,
  active: SubscriptionStatus.ACTIVE,
  past_due: SubscriptionStatus.PAST_DUE,
  canceled: SubscriptionStatus.CANCELED,
  unpaid: SubscriptionStatus.UNPAID,
  paused: SubscriptionStatus.PAUSED,
};

/**
 * Record the event and process it exactly once.
 */
export async function processStripeEvent(event: Stripe.Event): Promise<WebhookProcessResult> {
  // Claim the event. A unique-constraint violation means another delivery of
  // the same event already claimed it.
  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        stripeEventId: event.id,
        type: event.type,
        status: WebhookStatus.RECEIVED,
        payload: sanitizePayload(event) as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { handled: false, duplicate: true, message: 'Event already processed.' };
    }
    throw error;
  }

  try {
    let message = 'Ignored — event type not handled.';
    let handled = false;

    switch (event.type) {
      case 'checkout.session.completed':
        message = await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        handled = true;
        break;
      case 'invoice.paid':
        message = await handleInvoicePaid(event.data.object as Stripe.Invoice);
        handled = true;
        break;
      case 'invoice.payment_failed':
        message = await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        handled = true;
        break;
      case 'customer.subscription.updated':
        message = await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        handled = true;
        break;
      case 'customer.subscription.deleted':
        message = await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        handled = true;
        break;
      default:
        break;
    }

    await prisma.stripeWebhookEvent.update({
      where: { stripeEventId: event.id },
      data: {
        status: handled ? WebhookStatus.PROCESSED : WebhookStatus.IGNORED,
        processedAt: new Date(),
        error: null,
      },
    });

    return { handled, duplicate: false, message };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown processing error';
    await prisma.stripeWebhookEvent.update({
      where: { stripeEventId: event.id },
      data: { status: WebhookStatus.FAILED, error: detail.slice(0, 1000), processedAt: new Date() },
    });
    throw error;
  }
}

async function resolveUserId(params: {
  metadataUserId?: string | null;
  clientReferenceId?: string | null;
  customerId?: string | null;
}): Promise<string | null> {
  if (params.metadataUserId) {
    const user = await prisma.user.findUnique({
      where: { id: params.metadataUserId },
      select: { id: true },
    });
    if (user) return user.id;
  }
  if (params.clientReferenceId) {
    const user = await prisma.user.findUnique({
      where: { id: params.clientReferenceId },
      select: { id: true },
    });
    if (user) return user.id;
  }
  if (params.customerId) {
    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: params.customerId },
      select: { id: true },
    });
    if (user) return user.id;
  }
  return null;
}

function resolveProductKey(value: unknown): ProductKey | null {
  return typeof value === 'string' && isProductKey(value) ? value : null;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<string> {
  const customerId =
    typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null);

  const userId = await resolveUserId({
    metadataUserId: session.metadata?.rankinaiUserId,
    clientReferenceId: session.client_reference_id,
    customerId,
  });

  if (!userId) {
    return 'No matching RankInAI user for this checkout session.';
  }

  // Backfill the customer link if this was the user's first purchase.
  if (customerId) {
    await prisma.user.updateMany({
      where: { id: userId, stripeCustomerId: null },
      data: { stripeCustomerId: customerId },
    });
  }

  const productKey = resolveProductKey(session.metadata?.productKey);
  const amountCents = session.amount_total ?? 0;
  const isSubscription = session.mode === 'subscription';

  const payment = await prisma.payment.upsert({
    where: { stripeCheckoutSessionId: session.id },
    create: {
      userId,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id,
      stripeCustomerId: customerId,
      kind: isSubscription ? PaymentKind.SUBSCRIPTION : PaymentKind.ONE_TIME_AUDIT,
      status: session.payment_status === 'paid' ? PaymentStatus.SUCCEEDED : PaymentStatus.PENDING,
      amountCents,
      currency: session.currency ?? 'usd',
      description: productKey ? PRODUCTS[productKey].name : 'RankInAI purchase',
      productKey,
      isDemo: false,
      paidAt: session.payment_status === 'paid' ? new Date() : null,
    },
    update: {
      status: session.payment_status === 'paid' ? PaymentStatus.SUCCEEDED : PaymentStatus.PENDING,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id,
      stripeCustomerId: customerId,
      amountCents,
      paidAt: session.payment_status === 'paid' ? new Date() : null,
    },
  });

  if (isSubscription) {
    return `Subscription checkout recorded for user ${userId}. Entitlement is applied by the subscription event.`;
  }

  if (session.payment_status !== 'paid') {
    return 'One-time checkout completed but payment is not yet marked paid; no credit granted.';
  }

  // Credit grant is guarded by the purchase row so a replay cannot double-grant
  // even if the webhook-event guard were bypassed.
  const alreadyFulfilled = await prisma.purchase.findFirst({
    where: { paymentId: payment.id },
    select: { id: true },
  });
  if (alreadyFulfilled) {
    return 'One-time purchase already fulfilled; no additional credit granted.';
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchase.create({
      data: {
        userId,
        paymentId: payment.id,
        productKey: productKey ?? 'ONE_TIME_AUDIT',
        creditsGranted: 1,
        amountCents,
        currency: session.currency ?? 'usd',
        isDemo: false,
      },
    });
    await grantCredits({
      userId,
      amount: 1,
      reason: CreditReason.ONE_TIME_PURCHASE,
      note: `Stripe checkout ${session.id}`,
      tx,
    });
  });

  return `Granted 1 audit credit to user ${userId}.`;
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<string> {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer?.id ?? null);
  const userId = await resolveUserId({ customerId });
  if (!userId) return 'No matching RankInAI user for this invoice.';

  if (invoice.id) {
    await prisma.payment.upsert({
      where: { stripeInvoiceId: invoice.id },
      create: {
        userId,
        stripeInvoiceId: invoice.id,
        stripeCustomerId: customerId,
        kind: PaymentKind.SUBSCRIPTION,
        status: PaymentStatus.SUCCEEDED,
        amountCents: invoice.amount_paid ?? 0,
        currency: invoice.currency ?? 'usd',
        description: 'Subscription renewal',
        isDemo: false,
        paidAt: new Date(),
      },
      update: {
        status: PaymentStatus.SUCCEEDED,
        amountCents: invoice.amount_paid ?? 0,
        paidAt: new Date(),
      },
    });
  }

  // A paid renewal invoice resets the period allowance.
  const subscriptionId = extractSubscriptionId(invoice);
  if (subscriptionId) {
    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
      select: { id: true, currentPeriodStart: true },
    });

    if (subscription) {
      const linePeriod = invoice.lines?.data?.[0]?.period;
      const periodStart = linePeriod?.start ? new Date(linePeriod.start * 1000) : new Date();
      const periodEnd = linePeriod?.end ? new Date(linePeriod.end * 1000) : null;

      // Only reset when the period genuinely moved forward.
      const moved =
        !subscription.currentPeriodStart ||
        periodStart.getTime() > subscription.currentPeriodStart.getTime();

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          ...(moved ? { auditsUsedThisPeriod: 0 } : {}),
        },
      });

      return moved
        ? `Invoice paid; audit allowance reset for user ${userId}.`
        : `Invoice paid; period unchanged for user ${userId}.`;
    }
  }

  return `Invoice paid recorded for user ${userId}.`;
}

async function handleInvoiceFailed(invoice: Stripe.Invoice): Promise<string> {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer?.id ?? null);
  const userId = await resolveUserId({ customerId });
  if (!userId) return 'No matching RankInAI user for this invoice.';

  if (invoice.id) {
    await prisma.payment.upsert({
      where: { stripeInvoiceId: invoice.id },
      create: {
        userId,
        stripeInvoiceId: invoice.id,
        stripeCustomerId: customerId,
        kind: PaymentKind.SUBSCRIPTION,
        status: PaymentStatus.FAILED,
        amountCents: invoice.amount_due ?? 0,
        currency: invoice.currency ?? 'usd',
        description: 'Subscription payment failed',
        isDemo: false,
      },
      update: { status: PaymentStatus.FAILED },
    });
  }

  const subscriptionId = extractSubscriptionId(invoice);
  if (subscriptionId) {
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscriptionId },
      data: { status: SubscriptionStatus.PAST_DUE },
    });
  }

  return `Marked subscription past due for user ${userId}.`;
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<string> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : (subscription.customer?.id ?? null);

  const userId = await resolveUserId({
    metadataUserId: subscription.metadata?.rankinaiUserId,
    customerId,
  });
  if (!userId) return 'No matching RankInAI user for this subscription.';

  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const product = priceId ? productForStripePriceId(priceId) : null;
  const metadataProduct = resolveProductKey(subscription.metadata?.productKey);
  const plan =
    product?.plan ?? (metadataProduct ? PRODUCTS[metadataProduct].plan : PlanTier.STARTER);

  const status = STATUS_MAP[subscription.status] ?? SubscriptionStatus.INCOMPLETE;
  const item = subscription.items?.data?.[0];
  const periodStart = item?.current_period_start
    ? new Date(item.current_period_start * 1000)
    : null;
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000) : null;

  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (existing) {
    // A plan change resets the allowance so the new tier starts clean.
    const planChanged = existing.plan !== plan;
    await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        plan,
        status,
        stripePriceId: priceId,
        stripeCustomerId: customerId,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        ...(planChanged ? { auditsUsedThisPeriod: 0 } : {}),
      },
    });
    return `Subscription updated to ${plan} (${status}) for user ${userId}.`;
  }

  await prisma.subscription.create({
    data: {
      userId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      stripePriceId: priceId,
      plan,
      status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      auditsUsedThisPeriod: 0,
      isDemo: false,
    },
  });

  return `Subscription created as ${plan} (${status}) for user ${userId}.`;
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<string> {
  const updated = await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: SubscriptionStatus.CANCELED,
      canceledAt: new Date(),
      cancelAtPeriodEnd: false,
    },
  });

  return updated.count > 0
    ? 'Subscription canceled; plan entitlements removed.'
    : 'No matching local subscription to cancel.';
}

function extractSubscriptionId(invoice: Stripe.Invoice): string | null {
  const raw = (invoice as unknown as { subscription?: string | { id?: string } }).subscription;
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof raw.id === 'string') return raw.id;
  const lineSub = invoice.lines?.data?.[0]?.subscription;
  if (typeof lineSub === 'string') return lineSub;
  if (lineSub && typeof lineSub === 'object' && 'id' in lineSub) {
    return (lineSub as { id?: string }).id ?? null;
  }
  return null;
}

/**
 * Keep only the fields needed for admin debugging. Full Stripe payloads can
 * contain more customer detail than we need to retain.
 */
function sanitizePayload(event: Stripe.Event): Record<string, unknown> {
  const object = event.data.object as unknown as Record<string, unknown>;
  return {
    id: event.id,
    type: event.type,
    created: event.created,
    livemode: event.livemode,
    object: {
      id: object.id,
      object: object.object,
      status: object.status,
      mode: object.mode,
      amount_total: object.amount_total,
      amount_paid: object.amount_paid,
      amount_due: object.amount_due,
      currency: object.currency,
      customer: typeof object.customer === 'string' ? object.customer : undefined,
      payment_status: object.payment_status,
      cancel_at_period_end: object.cancel_at_period_end,
      metadata: object.metadata,
    },
  };
}
