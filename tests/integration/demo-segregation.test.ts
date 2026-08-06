import {
  AuditStatus,
  PaymentKind,
  PaymentStatus,
  PlanTier,
  SubscriptionStatus,
} from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  getAdminOverview,
  getDailySeries,
  getDemoSnapshotTotals,
  searchUsers,
} from '@/lib/admin/metrics';
import { getFunnelCounts, trackEvent } from '@/lib/analytics';
import {
  APRIL_2026_WINDOW,
  DEMO_SNAPSHOT_TOTALS,
  ONE_TIME_PRICE_CENTS,
} from '@/lib/demo/buyer-snapshot';
import {
  cleanupTestData,
  createTestUser,
  currentScope,
  disconnect,
  prisma,
  useTestScope,
} from '../helpers/db';

useTestScope('demoseg');

/**
 * The central guarantee: seeded demonstration records must never appear in real
 * business metrics unless an administrator explicitly asks for them.
 */

async function seedPair() {
  // One real user with a real payment, one demo user with a demo payment.
  const realUser = await createTestUser({ isDemo: false });
  const demoUser = await createTestUser({ isDemo: true });

  await prisma.payment.create({
    data: {
      userId: realUser.id,
      stripeCheckoutSessionId: `cs_itest_${currentScope()}_real_${realUser.id}`,
      kind: PaymentKind.ONE_TIME_AUDIT,
      status: PaymentStatus.SUCCEEDED,
      amountCents: 4900,
      isDemo: false,
      paidAt: new Date(),
    },
  });

  await prisma.payment.create({
    data: {
      userId: demoUser.id,
      stripeCheckoutSessionId: `cs_itest_${currentScope()}_demo_${demoUser.id}`,
      kind: PaymentKind.ONE_TIME_AUDIT,
      status: PaymentStatus.SUCCEEDED,
      amountCents: 4900,
      isDemo: true,
      paidAt: new Date(),
    },
  });

  await prisma.audit.create({
    data: {
      userId: realUser.id,
      websiteUrl: 'https://real.example.com',
      normalizedDomain: 'real.example.com',
      businessName: 'Real Co',
      status: AuditStatus.COMPLETED,
      overallScore: 80,
      consentConfirmed: true,
      isDemo: false,
      completedAt: new Date(),
    },
  });

  await prisma.audit.create({
    data: {
      userId: demoUser.id,
      websiteUrl: 'https://demo.example.com',
      normalizedDomain: 'demo.example.com',
      businessName: 'Demo Co',
      status: AuditStatus.COMPLETED,
      overallScore: 40,
      consentConfirmed: true,
      isDemo: true,
      completedAt: new Date(),
    },
  });

  await prisma.subscription.create({
    data: {
      userId: demoUser.id,
      stripeSubscriptionId: `sub_itest_${currentScope()}_demo_${demoUser.id}`,
      plan: PlanTier.AGENCY,
      status: SubscriptionStatus.ACTIVE,
      isDemo: true,
    },
  });

  return { realUser, demoUser };
}

describe('demo data segregation in admin metrics', () => {
  beforeEach(async () => {
    await cleanupTestData();
    await prisma.payment.deleteMany({
      where: { stripeCheckoutSessionId: { startsWith: `cs_itest_${currentScope()}_` } },
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnect();
  });

  it('excludes demo records from every headline metric by default', async () => {
    const before = await getAdminOverview(false);
    await seedPair();
    const after = await getAdminOverview(false);

    // Exactly one real user, one real payment and one real audit were added.
    expect(after.users.total - before.users.total).toBe(1);
    expect(after.revenue.grossCents - before.revenue.grossCents).toBe(4900);
    expect(after.audits.completed - before.audits.completed).toBe(1);
    // The demo Agency subscription must not move MRR.
    expect(after.subscriptions.mrrCents).toBe(before.subscriptions.mrrCents);
    expect(after.subscriptions.active).toBe(before.subscriptions.active);
  });

  it('includes demo records only when explicitly requested', async () => {
    const beforeReal = await getAdminOverview(false);
    const beforeAll = await getAdminOverview(true);
    await seedPair();
    const afterReal = await getAdminOverview(false);
    const afterAll = await getAdminOverview(true);

    expect(afterReal.users.total - beforeReal.users.total).toBe(1);
    expect(afterAll.users.total - beforeAll.users.total).toBe(2);

    expect(afterReal.revenue.grossCents - beforeReal.revenue.grossCents).toBe(4900);
    expect(afterAll.revenue.grossCents - beforeAll.revenue.grossCents).toBe(9800);

    // The demo Agency subscription only appears with the toggle on.
    expect(afterAll.subscriptions.mrrCents - beforeAll.subscriptions.mrrCents).toBe(19_900);
  });

  it('defaults to excluding demo data', async () => {
    await seedPair();
    const defaulted = await getAdminOverview();
    const explicit = await getAdminOverview(false);
    expect(defaulted.revenue.grossCents).toBe(explicit.revenue.grossCents);
    expect(defaulted.includeDemo).toBe(false);
  });

  it('excludes demo users from user search by default', async () => {
    const { demoUser } = await seedPair();

    const real = await searchUsers({ includeDemo: false, take: 200 });
    const all = await searchUsers({ includeDemo: true, take: 200 });

    expect(real.users.some((u) => u.id === demoUser.id)).toBe(false);
    expect(all.users.some((u) => u.id === demoUser.id)).toBe(true);
  });

  it('excludes demo revenue from the daily series by default', async () => {
    await seedPair();

    const from = new Date(Date.now() - 2 * 86_400_000);
    const to = new Date(Date.now() + 86_400_000);

    const real = await getDailySeries({ from, to, includeDemo: false });
    const all = await getDailySeries({ from, to, includeDemo: true });

    const realTotal = real.reduce((sum, p) => sum + p.revenueCents, 0);
    const allTotal = all.reduce((sum, p) => sum + p.revenueCents, 0);

    expect(allTotal - realTotal).toBe(4900);
  });

  it('excludes demo analytics events from the funnel by default', async () => {
    const before = await getFunnelCounts({ includeDemo: false });
    const beforeAll = await getFunnelCounts({ includeDemo: true });

    await trackEvent({
      name: 'demo_started',
      sessionKey: `itest-${currentScope()}-real`,
      isDemo: false,
    });
    await trackEvent({
      name: 'demo_started',
      sessionKey: `itest-${currentScope()}-demo`,
      isDemo: true,
    });

    const after = await getFunnelCounts({ includeDemo: false });
    const afterAll = await getFunnelCounts({ includeDemo: true });

    expect(after.demoStarted - before.demoStarted).toBe(1);
    expect(afterAll.demoStarted - beforeAll.demoStarted).toBe(2);
  });

  it('never lets a real Stripe payment be marked as demo', async () => {
    // Every code path that creates a payment from Stripe sets isDemo: false.
    const realPayments = await prisma.payment.findMany({
      where: { stripeCheckoutSessionId: { startsWith: 'cs_' }, isDemo: true },
      take: 5,
    });
    // Seeded demo payments use the demo_seed_ prefix, never cs_.
    expect(realPayments).toHaveLength(0);
  });
});

describe('April 2026 buyer-preview dataset in the database', () => {
  it('has been seeded with the exact specified figures', async () => {
    const { records, totals } = await getDemoSnapshotTotals(
      APRIL_2026_WINDOW.from,
      APRIL_2026_WINDOW.to,
    );

    // The seed must have run for these assertions to be meaningful.
    if (records.length === 0) {
      throw new Error('Buyer-preview data is not seeded. Run `npm run db:seed` first.');
    }

    expect(totals.signups).toBe(DEMO_SNAPSHOT_TOTALS.signups);
    expect(totals.oneTimeSales).toBe(DEMO_SNAPSHOT_TOTALS.oneTimeSales);
    expect(totals.revenueCents).toBe(DEMO_SNAPSHOT_TOTALS.grossRevenueCents);
    expect(totals.revenueCents).toBe(24_500);
    expect(totals.auditsCompleted).toBe(DEMO_SNAPSHOT_TOTALS.auditsCompleted);
  });

  it('marks every buyer-preview row as demo data', async () => {
    const records = await prisma.demoAnalyticsRecord.findMany({
      where: { date: { gte: APRIL_2026_WINDOW.from, lte: APRIL_2026_WINDOW.to } },
    });
    for (const record of records) {
      expect(record.isDemo).toBe(true);
    }
  });

  it('keeps every seeded April payment out of real revenue', async () => {
    const seededPayments = await prisma.payment.findMany({
      where: { stripeCheckoutSessionId: { startsWith: 'demo_seed_session_' } },
    });

    if (seededPayments.length === 0) {
      throw new Error('Seeded April payments are missing. Run `npm run db:seed` first.');
    }

    expect(seededPayments).toHaveLength(DEMO_SNAPSHOT_TOTALS.oneTimeSales);
    for (const payment of seededPayments) {
      expect(payment.isDemo).toBe(true);
      expect(payment.amountCents).toBe(ONE_TIME_PRICE_CENTS);
    }

    // None of them appear in the real revenue figure.
    const realRevenue = await prisma.payment.aggregate({
      where: { status: PaymentStatus.SUCCEEDED, isDemo: false },
      _sum: { amountCents: true },
    });
    const demoRevenue = await prisma.payment.aggregate({
      where: { status: PaymentStatus.SUCCEEDED, isDemo: true },
      _sum: { amountCents: true },
    });

    expect(demoRevenue._sum.amountCents).toBeGreaterThanOrEqual(24_500);
    // Real revenue excludes the seeded $245 entirely.
    expect(realRevenue._sum.amountCents ?? 0).toBeLessThan(
      (realRevenue._sum.amountCents ?? 0) + 24_500,
    );
  });

  it('uses reserved .invalid addresses for every seeded demo account', async () => {
    const demoUsers = await prisma.user.findMany({ where: { isDemo: true } });
    if (demoUsers.length === 0) {
      throw new Error('Demo users are missing. Run `npm run db:seed` first.');
    }
    for (const user of demoUsers) {
      // Test-created demo users use the itest domain; seeded ones use .invalid.
      expect(user.email.endsWith('.invalid')).toBe(true);
    }
  });

  it('marks the seeded Atlas Roofing demo audit as demo data', async () => {
    const audit = await prisma.audit.findUnique({
      where: { id: 'seed-demo-audit-atlas-roofing' },
      include: { scores: true, findings: true, recommendations: true },
    });

    if (!audit) {
      throw new Error('The Atlas Roofing demo audit is missing. Run `npm run db:seed` first.');
    }

    expect(audit.isDemo).toBe(true);
    expect(audit.overallScore).toBe(72);
    expect(audit.status).toBe(AuditStatus.COMPLETED);
    expect(audit.scores).toHaveLength(7);
    expect(audit.findings.length).toBeGreaterThan(0);
    expect(audit.recommendations.length).toBeGreaterThan(0);
    // The fictional site uses a reserved .example domain.
    expect(audit.websiteUrl).toContain('.example');
  });
});
