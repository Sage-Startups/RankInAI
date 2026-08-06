import type Stripe from 'stripe';
import { PaymentStatus, PlanTier, SubscriptionStatus, WebhookStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { processStripeEvent } from '@/lib/billing/webhook';
import { fulfillSimulatedCheckout } from '@/lib/billing/checkout';
import { getEntitlements } from '@/lib/credits';
import {
  cleanupTestData,
  createTestUser,
  currentScope,
  disconnect,
  prisma,
  testStripeId,
  useTestScope,
} from '../helpers/db';

useTestScope('webhook');

let eventCounter = 0;

function event(type: string, object: Record<string, unknown>): Stripe.Event {
  eventCounter += 1;
  return {
    id: `evt_itest_${currentScope()}_${process.pid}_${eventCounter}_${Date.now()}`,
    object: 'event',
    api_version: '2026-07-29.dahlia',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type,
    data: { object },
  } as unknown as Stripe.Event;
}

/** Deterministic per-user Stripe subscription id used by these tests. */
const subIds = new Map<string, string>();
function subId(label: string): string {
  if (!subIds.has(label)) subIds.set(label, testStripeId('sub', label));
  return subIds.get(label)!;
}

describe('Stripe webhook processing', () => {
  beforeEach(async () => {
    await cleanupTestData();
    process.env.STRIPE_PRICE_GROWTH_MONTHLY = 'price_itest_growth';
    process.env.STRIPE_PRICE_AGENCY_MONTHLY = 'price_itest_agency';
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnect();
  });

  describe('checkout.session.completed — one-time audit', () => {
    it('grants exactly one audit credit', async () => {
      const user = await createTestUser({ credits: 0 });

      const result = await processStripeEvent(
        event('checkout.session.completed', {
          id: `cs_itest_${user.id}`,
          object: 'checkout.session',
          mode: 'payment',
          payment_status: 'paid',
          amount_total: 4900,
          currency: 'usd',
          customer: `cus_itest_${user.id}`,
          client_reference_id: user.id,
          payment_intent: `pi_itest_${user.id}`,
          metadata: { rankinaiUserId: user.id, productKey: 'ONE_TIME_AUDIT' },
        }),
      );

      expect(result.handled).toBe(true);
      expect(result.duplicate).toBe(false);

      const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(record.oneTimeCredits).toBe(1);
      expect(record.stripeCustomerId).toBe(`cus_itest_${user.id}`);

      const payment = await prisma.payment.findFirstOrThrow({ where: { userId: user.id } });
      expect(payment.status).toBe(PaymentStatus.SUCCEEDED);
      expect(payment.amountCents).toBe(4900);
      expect(payment.isDemo).toBe(false);

      const purchase = await prisma.purchase.findFirstOrThrow({ where: { userId: user.id } });
      expect(purchase.creditsGranted).toBe(1);
    });

    it('is idempotent — a replayed event never grants a second credit', async () => {
      const user = await createTestUser({ credits: 0 });
      const payload = {
        id: `cs_itest_replay_${user.id}`,
        object: 'checkout.session',
        mode: 'payment',
        payment_status: 'paid',
        amount_total: 4900,
        currency: 'usd',
        customer: `cus_itest_${user.id}`,
        client_reference_id: user.id,
        metadata: { rankinaiUserId: user.id, productKey: 'ONE_TIME_AUDIT' },
      };

      const original = event('checkout.session.completed', payload);
      const first = await processStripeEvent(original);
      // Exactly the same event id — Stripe retrying the same delivery.
      const second = await processStripeEvent(original);

      expect(first.handled).toBe(true);
      expect(second.duplicate).toBe(true);
      expect(second.handled).toBe(false);

      const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(record.oneTimeCredits).toBe(1);
      expect(await prisma.purchase.count({ where: { userId: user.id } })).toBe(1);
    });

    it('does not double-grant when a different event id carries the same session', async () => {
      const user = await createTestUser({ credits: 0 });
      const payload = {
        id: `cs_itest_samesession_${user.id}`,
        object: 'checkout.session',
        mode: 'payment',
        payment_status: 'paid',
        amount_total: 4900,
        currency: 'usd',
        client_reference_id: user.id,
        metadata: { rankinaiUserId: user.id, productKey: 'ONE_TIME_AUDIT' },
      };

      await processStripeEvent(event('checkout.session.completed', payload));
      const second = await processStripeEvent(event('checkout.session.completed', payload));

      expect(second.message).toContain('already fulfilled');

      const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(record.oneTimeCredits).toBe(1);
      expect(await prisma.purchase.count({ where: { userId: user.id } })).toBe(1);
    });

    it('grants nothing when the session is not marked paid', async () => {
      const user = await createTestUser({ credits: 0 });

      await processStripeEvent(
        event('checkout.session.completed', {
          id: `cs_itest_unpaid_${user.id}`,
          object: 'checkout.session',
          mode: 'payment',
          payment_status: 'unpaid',
          amount_total: 4900,
          client_reference_id: user.id,
          metadata: { rankinaiUserId: user.id, productKey: 'ONE_TIME_AUDIT' },
        }),
      );

      const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(record.oneTimeCredits).toBe(0);
      expect(await prisma.purchase.count({ where: { userId: user.id } })).toBe(0);
    });

    it('records the event but grants nothing for an unknown user', async () => {
      const result = await processStripeEvent(
        event('checkout.session.completed', {
          id: 'cs_itest_unknown_user',
          object: 'checkout.session',
          mode: 'payment',
          payment_status: 'paid',
          amount_total: 4900,
          client_reference_id: 'user-that-does-not-exist',
          metadata: {},
        }),
      );

      expect(result.message).toContain('No matching RankInAI user');
    });
  });

  describe('subscription lifecycle', () => {
    it('activates a subscription and applies the plan entitlement', async () => {
      const user = await createTestUser();

      await processStripeEvent(
        event('customer.subscription.updated', {
          id: subId('activate'),
          object: 'subscription',
          status: 'active',
          customer: `cus_itest_${user.id}`,
          cancel_at_period_end: false,
          metadata: { rankinaiUserId: user.id, productKey: 'GROWTH_MONTHLY' },
          items: {
            data: [
              {
                price: { id: 'price_itest_growth' },
                current_period_start: Math.floor(Date.now() / 1000),
                current_period_end: Math.floor(Date.now() / 1000) + 2_592_000,
              },
            ],
          },
        }),
      );

      const entitlements = await getEntitlements(user.id);
      expect(entitlements.plan).toBe(PlanTier.GROWTH);
      expect(entitlements.subscriptionActive).toBe(true);
      expect(entitlements.entitlements.auditsPerPeriod).toBe(15);
      expect(entitlements.auditsRemainingThisPeriod).toBe(15);
    });

    it('resets the period allowance when the plan changes', async () => {
      const user = await createTestUser();
      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeSubscriptionId: subId('change'),
          stripeCustomerId: `cus_itest_${user.id}`,
          plan: PlanTier.STARTER,
          status: SubscriptionStatus.ACTIVE,
          auditsUsedThisPeriod: 3,
        },
      });

      await processStripeEvent(
        event('customer.subscription.updated', {
          id: subId('change'),
          object: 'subscription',
          status: 'active',
          customer: `cus_itest_${user.id}`,
          metadata: { rankinaiUserId: user.id, productKey: 'AGENCY_MONTHLY' },
          items: { data: [{ price: { id: 'price_itest_agency' } }] },
        }),
      );

      const subscription = await prisma.subscription.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(subscription.plan).toBe(PlanTier.AGENCY);
      expect(subscription.auditsUsedThisPeriod).toBe(0);
    });

    it('preserves usage when the same plan is updated', async () => {
      const user = await createTestUser();
      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeSubscriptionId: subId('same'),
          stripeCustomerId: `cus_itest_${user.id}`,
          plan: PlanTier.GROWTH,
          status: SubscriptionStatus.ACTIVE,
          auditsUsedThisPeriod: 7,
        },
      });

      await processStripeEvent(
        event('customer.subscription.updated', {
          id: subId('same'),
          object: 'subscription',
          status: 'active',
          customer: `cus_itest_${user.id}`,
          cancel_at_period_end: true,
          metadata: { rankinaiUserId: user.id, productKey: 'GROWTH_MONTHLY' },
          items: { data: [{ price: { id: 'price_itest_growth' } }] },
        }),
      );

      const subscription = await prisma.subscription.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(subscription.auditsUsedThisPeriod).toBe(7);
      expect(subscription.cancelAtPeriodEnd).toBe(true);
    });

    it('removes entitlements when the subscription is deleted', async () => {
      const user = await createTestUser();
      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeSubscriptionId: subId('delete'),
          plan: PlanTier.GROWTH,
          status: SubscriptionStatus.ACTIVE,
        },
      });

      await processStripeEvent(
        event('customer.subscription.deleted', {
          id: subId('delete'),
          object: 'subscription',
          status: 'canceled',
        }),
      );

      const entitlements = await getEntitlements(user.id);
      expect(entitlements.plan).toBe(PlanTier.FREE);
      expect(entitlements.subscriptionActive).toBe(false);
      expect(entitlements.canCreateAudit).toBe(false);
    });

    it('marks the subscription past due when an invoice fails', async () => {
      const user = await createTestUser();
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: `cus_itest_fail_${user.id}` },
      });
      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeSubscriptionId: subId('fail'),
          plan: PlanTier.STARTER,
          status: SubscriptionStatus.ACTIVE,
        },
      });

      await processStripeEvent(
        event('invoice.payment_failed', {
          id: `in_itest_fail_${user.id}`,
          object: 'invoice',
          customer: `cus_itest_fail_${user.id}`,
          amount_due: 2900,
          currency: 'usd',
          subscription: subId('fail'),
          lines: { data: [] },
        }),
      );

      const subscription = await prisma.subscription.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(subscription.status).toBe(SubscriptionStatus.PAST_DUE);

      const payment = await prisma.payment.findFirstOrThrow({ where: { userId: user.id } });
      expect(payment.status).toBe(PaymentStatus.FAILED);
    });

    it('resets the allowance when a renewal invoice is paid', async () => {
      const user = await createTestUser();
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: `cus_itest_renew_${user.id}` },
      });

      const previousPeriodStart = new Date(Date.now() - 60 * 86_400_000);
      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeSubscriptionId: subId('renew'),
          plan: PlanTier.GROWTH,
          status: SubscriptionStatus.ACTIVE,
          auditsUsedThisPeriod: 12,
          currentPeriodStart: previousPeriodStart,
        },
      });

      const newPeriodStart = Math.floor(Date.now() / 1000);

      await processStripeEvent(
        event('invoice.paid', {
          id: `in_itest_renew_${user.id}`,
          object: 'invoice',
          customer: `cus_itest_renew_${user.id}`,
          amount_paid: 7900,
          currency: 'usd',
          subscription: subId('renew'),
          lines: {
            data: [{ period: { start: newPeriodStart, end: newPeriodStart + 2_592_000 } }],
          },
        }),
      );

      const subscription = await prisma.subscription.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(subscription.auditsUsedThisPeriod).toBe(0);
      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('does not reset the allowance when the period has not moved', async () => {
      const user = await createTestUser();
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: `cus_itest_norenew_${user.id}` },
      });

      const periodStart = new Date();
      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeSubscriptionId: subId('norenew'),
          plan: PlanTier.GROWTH,
          status: SubscriptionStatus.ACTIVE,
          auditsUsedThisPeriod: 6,
          currentPeriodStart: periodStart,
        },
      });

      await processStripeEvent(
        event('invoice.paid', {
          id: `in_itest_norenew_${user.id}`,
          object: 'invoice',
          customer: `cus_itest_norenew_${user.id}`,
          amount_paid: 7900,
          currency: 'usd',
          subscription: subId('norenew'),
          lines: {
            data: [
              {
                period: {
                  start: Math.floor(periodStart.getTime() / 1000) - 100,
                  end: Math.floor(periodStart.getTime() / 1000) + 2_592_000,
                },
              },
            ],
          },
        }),
      );

      const subscription = await prisma.subscription.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(subscription.auditsUsedThisPeriod).toBe(6);
    });
  });

  describe('event recording', () => {
    it('stores every received event with its outcome', async () => {
      const user = await createTestUser();
      const stripeEvent = event('checkout.session.completed', {
        id: `cs_itest_record_${user.id}`,
        object: 'checkout.session',
        mode: 'payment',
        payment_status: 'paid',
        amount_total: 4900,
        client_reference_id: user.id,
        metadata: { rankinaiUserId: user.id, productKey: 'ONE_TIME_AUDIT' },
      });

      await processStripeEvent(stripeEvent);

      const record = await prisma.stripeWebhookEvent.findUniqueOrThrow({
        where: { stripeEventId: stripeEvent.id },
      });
      expect(record.status).toBe(WebhookStatus.PROCESSED);
      expect(record.processedAt).not.toBeNull();
      expect(record.type).toBe('checkout.session.completed');
    });

    it('marks unhandled event types as ignored', async () => {
      const stripeEvent = event('customer.created', {
        id: 'cus_itest_ignored',
        object: 'customer',
      });
      const result = await processStripeEvent(stripeEvent);

      expect(result.handled).toBe(false);
      const record = await prisma.stripeWebhookEvent.findUniqueOrThrow({
        where: { stripeEventId: stripeEvent.id },
      });
      expect(record.status).toBe(WebhookStatus.IGNORED);
    });

    it('does not persist raw card or full customer payloads', async () => {
      const user = await createTestUser();
      const stripeEvent = event('checkout.session.completed', {
        id: `cs_itest_sanitize_${user.id}`,
        object: 'checkout.session',
        mode: 'payment',
        payment_status: 'paid',
        amount_total: 4900,
        client_reference_id: user.id,
        customer_details: {
          email: 'buyer@example.com',
          name: 'A Buyer',
          address: { line1: '1 Main St' },
        },
        metadata: { rankinaiUserId: user.id, productKey: 'ONE_TIME_AUDIT' },
      });

      await processStripeEvent(stripeEvent);

      const record = await prisma.stripeWebhookEvent.findUniqueOrThrow({
        where: { stripeEventId: stripeEvent.id },
      });
      const serialized = JSON.stringify(record.payload);
      expect(serialized).not.toContain('buyer@example.com');
      expect(serialized).not.toContain('1 Main St');
    });
  });
});

describe('simulated checkout (billing test mode)', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('grants a credit through the same fulfillment path as the webhook', async () => {
    const user = await createTestUser({ credits: 0 });

    await fulfillSimulatedCheckout({
      userId: user.id,
      productKey: 'ONE_TIME_AUDIT',
      sessionId: `sim_itest_${user.id}`,
    });

    const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(record.oneTimeCredits).toBe(1);

    const payment = await prisma.payment.findFirstOrThrow({ where: { userId: user.id } });
    expect(payment.status).toBe(PaymentStatus.SUCCEEDED);
    // Simulated payments are still real (non-demo) product records.
    expect(payment.isDemo).toBe(false);
    expect(payment.description).toContain('simulated');
  });

  it('is idempotent for the same simulated session', async () => {
    const user = await createTestUser({ credits: 0 });
    const sessionId = `sim_itest_idem_${user.id}`;

    await fulfillSimulatedCheckout({ userId: user.id, productKey: 'ONE_TIME_AUDIT', sessionId });
    await fulfillSimulatedCheckout({ userId: user.id, productKey: 'ONE_TIME_AUDIT', sessionId });

    const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(record.oneTimeCredits).toBe(1);
  });

  it('activates a subscription with a fresh allowance', async () => {
    const user = await createTestUser();

    await fulfillSimulatedCheckout({
      userId: user.id,
      productKey: 'GROWTH_MONTHLY',
      sessionId: `sim_itest_sub_${user.id}`,
    });

    const entitlements = await getEntitlements(user.id);
    expect(entitlements.plan).toBe(PlanTier.GROWTH);
    expect(entitlements.auditsRemainingThisPeriod).toBe(15);
    expect(entitlements.periodEnd).not.toBeNull();
  });
});
