import { PlanTier } from '@prisma/client';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ALL_PRODUCTS,
  COMPARISON_ROWS,
  FREE_PREVIEW_MAX_FINDINGS,
  FREE_PREVIEW_PAGE_LIMIT,
  PRODUCTS,
  entitlementsForPlan,
  isProductKey,
  planLabel,
  productForStripePriceId,
  stripePriceIdFor,
} from '@/lib/plans';
import { effectiveAuditLimits, type EntitlementSnapshot } from '@/lib/credits';

describe('pricing catalog', () => {
  it('prices every product in US dollars as specified', () => {
    expect(PRODUCTS.ONE_TIME_AUDIT.priceCents).toBe(4900);
    expect(PRODUCTS.STARTER_MONTHLY.priceCents).toBe(2900);
    expect(PRODUCTS.GROWTH_MONTHLY.priceCents).toBe(7900);
    expect(PRODUCTS.AGENCY_MONTHLY.priceCents).toBe(19900);
  });

  it('marks only Growth as most popular', () => {
    const popular = ALL_PRODUCTS.filter((p) => p.mostPopular);
    expect(popular).toHaveLength(1);
    expect(popular[0]?.key).toBe('GROWTH_MONTHLY');
  });

  it('uses monthly billing for all subscription products', () => {
    expect(PRODUCTS.STARTER_MONTHLY.interval).toBe('month');
    expect(PRODUCTS.GROWTH_MONTHLY.interval).toBe('month');
    expect(PRODUCTS.AGENCY_MONTHLY.interval).toBe('month');
    expect(PRODUCTS.ONE_TIME_AUDIT.interval).toBe('one_time');
  });
});

describe('plan entitlements', () => {
  it('matches the specified audit allowances', () => {
    expect(entitlementsForPlan(PlanTier.STARTER).auditsPerPeriod).toBe(3);
    expect(entitlementsForPlan(PlanTier.GROWTH).auditsPerPeriod).toBe(15);
    expect(entitlementsForPlan(PlanTier.AGENCY).auditsPerPeriod).toBe(60);
    expect(entitlementsForPlan(PlanTier.FREE).auditsPerPeriod).toBe(0);
  });

  it('matches the specified page limits', () => {
    expect(entitlementsForPlan(PlanTier.STARTER).pageLimit).toBe(10);
    expect(entitlementsForPlan(PlanTier.GROWTH).pageLimit).toBe(25);
    expect(entitlementsForPlan(PlanTier.AGENCY).pageLimit).toBe(50);
    expect(PRODUCTS.ONE_TIME_AUDIT.entitlements.pageLimit).toBe(10);
  });

  it('matches the specified competitor limits', () => {
    expect(entitlementsForPlan(PlanTier.STARTER).competitorLimit).toBe(1);
    expect(entitlementsForPlan(PlanTier.GROWTH).competitorLimit).toBe(3);
    expect(entitlementsForPlan(PlanTier.AGENCY).competitorLimit).toBe(5);
    expect(PRODUCTS.ONE_TIME_AUDIT.entitlements.competitorLimit).toBe(1);
  });

  it('reserves white-label reports for Agency only', () => {
    expect(entitlementsForPlan(PlanTier.FREE).whiteLabelReports).toBe(false);
    expect(entitlementsForPlan(PlanTier.STARTER).whiteLabelReports).toBe(false);
    expect(entitlementsForPlan(PlanTier.GROWTH).whiteLabelReports).toBe(false);
    expect(entitlementsForPlan(PlanTier.AGENCY).whiteLabelReports).toBe(true);
  });

  it('reserves the priority queue for Agency only', () => {
    expect(entitlementsForPlan(PlanTier.GROWTH).priorityQueue).toBe(false);
    expect(entitlementsForPlan(PlanTier.AGENCY).priorityQueue).toBe(true);
  });

  it('limits the free preview to a single page and five findings', () => {
    expect(FREE_PREVIEW_PAGE_LIMIT).toBe(1);
    expect(FREE_PREVIEW_MAX_FINDINGS).toBe(5);
    expect(entitlementsForPlan(PlanTier.FREE).pageLimit).toBe(1);
  });

  it('labels plans in US English', () => {
    expect(planLabel(PlanTier.FREE)).toBe('Free');
    expect(planLabel(PlanTier.STARTER)).toBe('Starter');
    expect(planLabel(PlanTier.GROWTH)).toBe('Growth');
    expect(planLabel(PlanTier.AGENCY)).toBe('Agency');
  });
});

describe('effectiveAuditLimits', () => {
  function snapshot(overrides: Partial<EntitlementSnapshot> = {}): EntitlementSnapshot {
    const plan = overrides.plan ?? PlanTier.FREE;
    return {
      plan,
      entitlements: entitlementsForPlan(plan),
      subscriptionActive: overrides.subscriptionActive ?? false,
      subscriptionId: null,
      periodEnd: null,
      cancelAtPeriodEnd: false,
      auditsUsedThisPeriod: overrides.auditsUsedThisPeriod ?? 0,
      auditsRemainingThisPeriod: overrides.auditsRemainingThisPeriod ?? 0,
      oneTimeCredits: overrides.oneTimeCredits ?? 0,
      totalAuditsAvailable:
        (overrides.auditsRemainingThisPeriod ?? 0) + (overrides.oneTimeCredits ?? 0),
      canCreateAudit:
        (overrides.auditsRemainingThisPeriod ?? 0) + (overrides.oneTimeCredits ?? 0) > 0,
      ...overrides,
    };
  }

  it('uses plan limits when subscription allowance remains', () => {
    const limits = effectiveAuditLimits(
      snapshot({ plan: PlanTier.GROWTH, subscriptionActive: true, auditsRemainingThisPeriod: 5 }),
    );
    expect(limits.pageLimit).toBe(25);
    expect(limits.competitorLimit).toBe(3);
    expect(limits.whiteLabel).toBe(false);
  });

  it('falls back to one-time limits for a user with no subscription', () => {
    const limits = effectiveAuditLimits(snapshot({ oneTimeCredits: 2 }));
    expect(limits.pageLimit).toBe(10);
    expect(limits.competitorLimit).toBe(1);
  });

  it('does not downgrade a subscriber who spends a one-time credit', () => {
    const limits = effectiveAuditLimits(
      snapshot({
        plan: PlanTier.AGENCY,
        subscriptionActive: true,
        auditsRemainingThisPeriod: 0,
        oneTimeCredits: 1,
      }),
    );
    expect(limits.pageLimit).toBe(50);
    expect(limits.competitorLimit).toBe(5);
    expect(limits.whiteLabel).toBe(true);
  });
});

describe('Stripe price resolution', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns null when no price ID is configured', () => {
    delete process.env.STRIPE_PRICE_GROWTH_MONTHLY;
    expect(stripePriceIdFor('GROWTH_MONTHLY')).toBeNull();
  });

  it('reads the price ID from the environment rather than a hardcoded value', () => {
    process.env.STRIPE_PRICE_GROWTH_MONTHLY = 'price_test_growth_123';
    expect(stripePriceIdFor('GROWTH_MONTHLY')).toBe('price_test_growth_123');
  });

  it('trims whitespace and treats an empty value as unset', () => {
    process.env.STRIPE_PRICE_STARTER_MONTHLY = '  price_padded  ';
    expect(stripePriceIdFor('STARTER_MONTHLY')).toBe('price_padded');

    process.env.STRIPE_PRICE_STARTER_MONTHLY = '   ';
    expect(stripePriceIdFor('STARTER_MONTHLY')).toBeNull();
  });

  it('maps a Stripe price ID back to its product', () => {
    process.env.STRIPE_PRICE_AGENCY_MONTHLY = 'price_agency_abc';
    const product = productForStripePriceId('price_agency_abc');
    expect(product?.key).toBe('AGENCY_MONTHLY');
    expect(product?.plan).toBe(PlanTier.AGENCY);
  });

  it('returns null for an unknown price ID', () => {
    expect(productForStripePriceId('price_that_does_not_exist')).toBeNull();
  });

  it('never hardcodes a live-looking Stripe price ID in the catalog', () => {
    const serialized = JSON.stringify(PRODUCTS);
    expect(serialized).not.toMatch(/price_[A-Za-z0-9]{10,}/);
  });
});

describe('isProductKey', () => {
  it('accepts known keys', () => {
    expect(isProductKey('ONE_TIME_AUDIT')).toBe(true);
    expect(isProductKey('GROWTH_MONTHLY')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isProductKey('FREE')).toBe(false);
    expect(isProductKey('')).toBe(false);
    expect(isProductKey('__proto__')).toBe(false);
  });
});

describe('comparison table', () => {
  it('lists a value for every plan in every row', () => {
    for (const row of COMPARISON_ROWS) {
      expect(row.label.length).toBeGreaterThan(0);
      expect(row.oneTime).toBeDefined();
      expect(row.starter).toBeDefined();
      expect(row.growth).toBeDefined();
      expect(row.agency).toBeDefined();
    }
  });

  it('quotes prices in US dollars', () => {
    const priceRow = COMPARISON_ROWS.find((row) => row.label === 'Price');
    expect(priceRow?.oneTime).toBe('$49 once');
    expect(priceRow?.starter).toBe('$29/mo');
    expect(priceRow?.growth).toBe('$79/mo');
    expect(priceRow?.agency).toBe('$199/mo');
  });
});
