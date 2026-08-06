import { AuditStatus, CreditReason, CreditSource, JobStatus, PlanTier, SubscriptionStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  InsufficientCreditsError,
  getEntitlements,
  grantCredits,
  reserveAuditCredit,
  restoreAuditCredit,
  revokeCredits,
} from '@/lib/credits';
import {
  cleanupTestData,
  createTestUser,
  disconnect,
  prisma,
  testStripeId,
  useTestScope,
} from '../helpers/db';

useTestScope('credits');

async function createAudit(userId: string, creditSource: CreditSource) {
  return prisma.audit.create({
    data: {
      userId,
      websiteUrl: 'https://example.com',
      normalizedDomain: 'example.com',
      businessName: 'Example Co',
      status: AuditStatus.QUEUED,
      creditSource,
      consentConfirmed: true,
      job: { create: { status: JobStatus.QUEUED } },
    },
  });
}

describe('audit credit ledger', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnect();
  });

  it('grants credits and records a ledger entry with the running balance', async () => {
    const user = await createTestUser();

    const balance = await grantCredits({
      userId: user.id,
      amount: 3,
      reason: CreditReason.ONE_TIME_PURCHASE,
      note: 'Test grant',
    });

    expect(balance).toBe(3);

    const entries = await prisma.auditCreditLedger.findMany({ where: { userId: user.id } });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.delta).toBe(3);
    expect(entries[0]?.balanceAfter).toBe(3);
    expect(entries[0]?.reason).toBe(CreditReason.ONE_TIME_PURCHASE);
  });

  it('keeps the ledger balance in step with the user record', async () => {
    const user = await createTestUser();
    await grantCredits({ userId: user.id, amount: 2, reason: CreditReason.ONE_TIME_PURCHASE });
    await grantCredits({ userId: user.id, amount: 1, reason: CreditReason.ADMIN_GRANT });

    const [record, latest] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { oneTimeCredits: true } }),
      prisma.auditCreditLedger.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    expect(record.oneTimeCredits).toBe(3);
    expect(latest?.balanceAfter).toBe(3);
  });

  it('never lets a revocation push the balance below zero', async () => {
    const user = await createTestUser({ credits: 2 });
    const admin = await createTestUser({ role: 'SUPER_ADMIN' });

    const balance = await revokeCredits({
      userId: user.id,
      amount: 10,
      note: 'Test revocation',
      adminUserId: admin.id,
    });

    expect(balance).toBe(0);
    const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(record.oneTimeCredits).toBe(0);
  });

  it('consumes a one-time credit when there is no subscription', async () => {
    const user = await createTestUser({ credits: 1 });
    const audit = await createAudit(user.id, CreditSource.ONE_TIME_CREDIT);

    const source = await reserveAuditCredit(user.id, audit.id);
    expect(source).toBe('ONE_TIME_CREDIT');

    const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(record.oneTimeCredits).toBe(0);

    const entry = await prisma.auditCreditLedger.findFirst({
      where: { userId: user.id, reason: CreditReason.AUDIT_RESERVED },
    });
    expect(entry?.delta).toBe(-1);
    expect(entry?.auditId).toBe(audit.id);
  });

  it('throws when no credits remain', async () => {
    const user = await createTestUser({ credits: 0 });
    const audit = await createAudit(user.id, CreditSource.ONE_TIME_CREDIT);

    await expect(reserveAuditCredit(user.id, audit.id)).rejects.toBeInstanceOf(
      InsufficientCreditsError,
    );
  });

  it('prefers the subscription allowance over one-time credits', async () => {
    const user = await createTestUser({ credits: 5 });
    await prisma.subscription.create({
      data: {
        userId: user.id,
        stripeSubscriptionId: testStripeId('sub', 'x'),
        plan: PlanTier.GROWTH,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
        auditsUsedThisPeriod: 0,
      },
    });

    const audit = await createAudit(user.id, CreditSource.SUBSCRIPTION_ALLOWANCE);
    const source = await reserveAuditCredit(user.id, audit.id);

    expect(source).toBe('SUBSCRIPTION_ALLOWANCE');

    const [record, subscription] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
      prisma.subscription.findFirstOrThrow({ where: { userId: user.id } }),
    ]);

    // The one-time credits are untouched.
    expect(record.oneTimeCredits).toBe(5);
    expect(subscription.auditsUsedThisPeriod).toBe(1);
  });

  it('falls back to a one-time credit once the plan allowance is exhausted', async () => {
    const user = await createTestUser({ credits: 2 });
    await prisma.subscription.create({
      data: {
        userId: user.id,
        stripeSubscriptionId: testStripeId('sub', 'exhausted_'),
        plan: PlanTier.STARTER,
        status: SubscriptionStatus.ACTIVE,
        auditsUsedThisPeriod: 3, // Starter allowance is 3
      },
    });

    const audit = await createAudit(user.id, CreditSource.ONE_TIME_CREDIT);
    const source = await reserveAuditCredit(user.id, audit.id);

    expect(source).toBe('ONE_TIME_CREDIT');
    const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(record.oneTimeCredits).toBe(1);
  });

  it('never double-spends the last credit under concurrent reservations', async () => {
    const user = await createTestUser({ credits: 1 });
    const [auditA, auditB] = await Promise.all([
      createAudit(user.id, CreditSource.ONE_TIME_CREDIT),
      createAudit(user.id, CreditSource.ONE_TIME_CREDIT),
    ]);

    const results = await Promise.allSettled([
      reserveAuditCredit(user.id, auditA.id),
      reserveAuditCredit(user.id, auditB.id),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(record.oneTimeCredits).toBe(0);
  });

  it('never over-spends a subscription allowance under concurrency', async () => {
    const user = await createTestUser({ credits: 0 });
    await prisma.subscription.create({
      data: {
        userId: user.id,
        stripeSubscriptionId: testStripeId('sub', 'race_'),
        plan: PlanTier.STARTER, // allowance 3
        status: SubscriptionStatus.ACTIVE,
        auditsUsedThisPeriod: 2,
      },
    });

    const audits = await Promise.all([
      createAudit(user.id, CreditSource.SUBSCRIPTION_ALLOWANCE),
      createAudit(user.id, CreditSource.SUBSCRIPTION_ALLOWANCE),
      createAudit(user.id, CreditSource.SUBSCRIPTION_ALLOWANCE),
    ]);

    const results = await Promise.allSettled(
      audits.map((audit) => reserveAuditCredit(user.id, audit.id)),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);

    const subscription = await prisma.subscription.findFirstOrThrow({ where: { userId: user.id } });
    expect(subscription.auditsUsedThisPeriod).toBe(3);
  });

  it('restores a one-time credit when an audit fails', async () => {
    const user = await createTestUser({ credits: 1 });
    const audit = await createAudit(user.id, CreditSource.ONE_TIME_CREDIT);
    await reserveAuditCredit(user.id, audit.id);

    const restored = await restoreAuditCredit(audit.id, 'Website unreachable');
    expect(restored).toBe(true);

    const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(record.oneTimeCredits).toBe(1);

    const refund = await prisma.auditCreditLedger.findFirst({
      where: { auditId: audit.id, reason: CreditReason.AUDIT_REFUNDED },
    });
    expect(refund?.delta).toBe(1);
    expect(refund?.note).toContain('unreachable');
  });

  it('restores a subscription allowance slot when an audit fails', async () => {
    const user = await createTestUser();
    await prisma.subscription.create({
      data: {
        userId: user.id,
        stripeSubscriptionId: testStripeId('sub', 'restore_'),
        plan: PlanTier.GROWTH,
        status: SubscriptionStatus.ACTIVE,
        auditsUsedThisPeriod: 0,
      },
    });

    const audit = await createAudit(user.id, CreditSource.SUBSCRIPTION_ALLOWANCE);
    await reserveAuditCredit(user.id, audit.id);

    let subscription = await prisma.subscription.findFirstOrThrow({ where: { userId: user.id } });
    expect(subscription.auditsUsedThisPeriod).toBe(1);

    await restoreAuditCredit(audit.id);

    subscription = await prisma.subscription.findFirstOrThrow({ where: { userId: user.id } });
    expect(subscription.auditsUsedThisPeriod).toBe(0);
  });

  it('is idempotent — a second restore does not grant a second credit', async () => {
    const user = await createTestUser({ credits: 1 });
    const audit = await createAudit(user.id, CreditSource.ONE_TIME_CREDIT);
    await reserveAuditCredit(user.id, audit.id);

    const first = await restoreAuditCredit(audit.id);
    const second = await restoreAuditCredit(audit.id);
    const third = await restoreAuditCredit(audit.id);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(third).toBe(false);

    const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(record.oneTimeCredits).toBe(1);
  });
});

describe('getEntitlements', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('reports the free plan for a user with no subscription', async () => {
    const user = await createTestUser({ credits: 2 });
    const entitlements = await getEntitlements(user.id);

    expect(entitlements.plan).toBe(PlanTier.FREE);
    expect(entitlements.subscriptionActive).toBe(false);
    expect(entitlements.auditsRemainingThisPeriod).toBe(0);
    expect(entitlements.oneTimeCredits).toBe(2);
    expect(entitlements.totalAuditsAvailable).toBe(2);
    expect(entitlements.canCreateAudit).toBe(true);
  });

  it('reports remaining plan audits accurately', async () => {
    const user = await createTestUser();
    await prisma.subscription.create({
      data: {
        userId: user.id,
        stripeSubscriptionId: testStripeId('sub', 'ent_'),
        plan: PlanTier.GROWTH,
        status: SubscriptionStatus.ACTIVE,
        auditsUsedThisPeriod: 4,
      },
    });

    const entitlements = await getEntitlements(user.id);
    expect(entitlements.plan).toBe(PlanTier.GROWTH);
    expect(entitlements.entitlements.auditsPerPeriod).toBe(15);
    expect(entitlements.auditsRemainingThisPeriod).toBe(11);
    expect(entitlements.canCreateAudit).toBe(true);
  });

  it('grants nothing for a canceled subscription', async () => {
    const user = await createTestUser();
    await prisma.subscription.create({
      data: {
        userId: user.id,
        stripeSubscriptionId: testStripeId('sub', 'cancelled_'),
        plan: PlanTier.AGENCY,
        status: SubscriptionStatus.CANCELED,
        auditsUsedThisPeriod: 0,
      },
    });

    const entitlements = await getEntitlements(user.id);
    expect(entitlements.plan).toBe(PlanTier.FREE);
    expect(entitlements.subscriptionActive).toBe(false);
    expect(entitlements.canCreateAudit).toBe(false);
  });

  it('keeps access while a subscription is past due', async () => {
    const user = await createTestUser();
    await prisma.subscription.create({
      data: {
        userId: user.id,
        stripeSubscriptionId: testStripeId('sub', 'pastdue_'),
        plan: PlanTier.STARTER,
        status: SubscriptionStatus.PAST_DUE,
        auditsUsedThisPeriod: 0,
      },
    });

    const entitlements = await getEntitlements(user.id);
    expect(entitlements.subscriptionActive).toBe(true);
    expect(entitlements.auditsRemainingThisPeriod).toBe(3);
  });
});
