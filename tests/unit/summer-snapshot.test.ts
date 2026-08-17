import { describe, expect, it } from 'vitest';

import { PRODUCTS } from '@/lib/plans';
import {
  GROWTH_PRICE_CENTS,
  ONE_TIME_PRICE_CENTS,
  STARTER_PRICE_CENTS,
  SUMMER_2026_WINDOW,
  SUMMER_DAYS,
  SUMMER_MONTHS,
  SUMMER_SERIES,
  SUMMER_SUBSCRIPTIONS,
  SUMMER_TOTALS,
  SUMMER_TRANSACTIONS,
} from '@/lib/demo/summer-snapshot';

/**
 * The demonstration snapshot is fabricated, which makes internal consistency
 * the only thing that can be checked — and the only thing that keeps the
 * headline figures honest against the table printed underneath them. A page
 * whose total disagrees with its own rows is worse than no page.
 */
describe('June–July 2026 demonstration snapshot', () => {
  it('is exactly three one-time audits, one Starter and one Growth subscription', () => {
    const oneTime = SUMMER_TRANSACTIONS.filter((t) => t.kind === 'ONE_TIME');
    const recurring = SUMMER_TRANSACTIONS.filter((t) => t.kind === 'SUBSCRIPTION');

    expect(oneTime).toHaveLength(3);
    expect(SUMMER_SUBSCRIPTIONS).toHaveLength(2);
    expect(SUMMER_TOTALS.activeSubscriptions).toBe(2);
    expect(SUMMER_SUBSCRIPTIONS.map((s) => s.planName).sort()).toEqual(['Growth', 'Starter']);

    // Starter billed in June and July, Growth billed once in July: 3 invoices.
    expect(recurring).toHaveLength(3);
    expect(new Set(recurring.map((t) => t.email)).size).toBe(2);
  });

  it('starts the Growth subscription in July, not June', () => {
    const growth = SUMMER_SUBSCRIPTIONS.find((s) => s.planName === 'Growth');
    expect(growth).toBeDefined();
    expect(growth?.startedOn.startsWith('2026-07')).toBe(true);
    expect(growth?.periodsBilled).toBe(1);
    expect(growth?.renewedOn).toBeNull();
  });

  it('prices every charge from the product catalog, not from a copied number', () => {
    expect(ONE_TIME_PRICE_CENTS).toBe(PRODUCTS.ONE_TIME_AUDIT.priceCents);
    expect(STARTER_PRICE_CENTS).toBe(PRODUCTS.STARTER_MONTHLY.priceCents);
    expect(GROWTH_PRICE_CENTS).toBe(PRODUCTS.GROWTH_MONTHLY.priceCents);

    for (const transaction of SUMMER_TRANSACTIONS) {
      expect([ONE_TIME_PRICE_CENTS, STARTER_PRICE_CENTS, GROWTH_PRICE_CENTS]).toContain(
        transaction.amountCents,
      );
      if (transaction.kind === 'ONE_TIME') {
        expect(transaction.amountCents).toBe(ONE_TIME_PRICE_CENTS);
      }
    }

    for (const subscription of SUMMER_SUBSCRIPTIONS) {
      expect(subscription.priceCents).toBe(
        subscription.planName === 'Starter' ? STARTER_PRICE_CENTS : GROWTH_PRICE_CENTS,
      );
    }
  });

  it('totals the charges the table actually lists', () => {
    const charged = SUMMER_TRANSACTIONS.reduce((sum, t) => sum + t.amountCents, 0);

    expect(SUMMER_TOTALS.grossRevenueCents).toBe(charged);
    expect(SUMMER_TOTALS.oneTimeRevenueCents).toBe(3 * ONE_TIME_PRICE_CENTS);
    expect(SUMMER_TOTALS.subscriptionRevenueCents).toBe(
      2 * STARTER_PRICE_CENTS + GROWTH_PRICE_CENTS,
    );
    expect(SUMMER_TOTALS.oneTimeRevenueCents + SUMMER_TOTALS.subscriptionRevenueCents).toBe(
      SUMMER_TOTALS.grossRevenueCents,
    );
  });

  it('lists every charge date as an activity day', () => {
    const activityDates = new Set(SUMMER_DAYS.map((d) => d.date));
    for (const transaction of SUMMER_TRANSACTIONS) {
      expect(activityDates.has(transaction.date)).toBe(true);
    }
    expect(SUMMER_TOTALS.oneTimeSales).toBe(3);
    expect(SUMMER_TOTALS.subscriptionInvoices).toBe(3);
  });

  it('splits across June and July, and the months sum to the totals', () => {
    expect(SUMMER_MONTHS.map((m) => m.key)).toEqual(['2026-06', '2026-07']);
    expect(SUMMER_MONTHS.every((m) => m.days.length > 0)).toBe(true);

    const sum = (pick: (m: (typeof SUMMER_MONTHS)[number]) => number) =>
      SUMMER_MONTHS.reduce((total, month) => total + pick(month), 0);

    expect(sum((m) => m.grossRevenueCents)).toBe(SUMMER_TOTALS.grossRevenueCents);
    expect(sum((m) => m.oneTimeSales)).toBe(SUMMER_TOTALS.oneTimeSales);
    expect(sum((m) => m.subscriptionInvoices)).toBe(SUMMER_TOTALS.subscriptionInvoices);
    expect(sum((m) => m.signups)).toBe(SUMMER_TOTALS.signups);
    expect(sum((m) => m.auditsCompleted)).toBe(SUMMER_TOTALS.auditsCompleted);
  });

  it('bills the Starter in both months and the Growth only in July', () => {
    const june = SUMMER_MONTHS[0];
    const july = SUMMER_MONTHS[1];

    expect(june.subscriptionInvoices).toBe(1);
    expect(june.subscriptionRevenueCents).toBe(STARTER_PRICE_CENTS);
    expect(july.subscriptionInvoices).toBe(2);
    expect(july.subscriptionRevenueCents).toBe(STARTER_PRICE_CENTS + GROWTH_PRICE_CENTS);
    // The recurring layer compounds: July grosses more than June.
    expect(july.grossRevenueCents).toBeGreaterThan(june.grossRevenueCents);
  });

  it('never shows a subscriber using more audits than the plan includes', () => {
    for (const subscription of SUMMER_SUBSCRIPTIONS) {
      const product =
        subscription.planName === 'Starter' ? PRODUCTS.STARTER_MONTHLY : PRODUCTS.GROWTH_MONTHLY;
      expect(subscription.auditsIncludedPerPeriod).toBe(product.entitlements.auditsPerPeriod);
      expect(subscription.auditsUsedByPeriod).toHaveLength(subscription.periodsBilled);
      for (const used of subscription.auditsUsedByPeriod) {
        expect(used).toBeLessThanOrEqual(subscription.auditsIncludedPerPeriod);
      }
    }
  });

  it('accounts for every completed audit', () => {
    // One per one-time credit, plus each subscriber's usage across their periods.
    const subscriptionAudits = SUMMER_SUBSCRIPTIONS.reduce(
      (total, s) => total + s.auditsUsedByPeriod.reduce((a, b) => a + b, 0),
      0,
    );
    expect(SUMMER_TOTALS.auditsCompleted).toBe(SUMMER_TOTALS.oneTimeSales + subscriptionAudits);
    expect(SUMMER_TOTALS.auditsCreated).toBe(SUMMER_TOTALS.auditsCompleted);
  });

  it('reports recurring revenue at window end as the sum of both plans', () => {
    expect(SUMMER_TOTALS.recurringAtWindowEndCents).toBe(STARTER_PRICE_CENTS + GROWTH_PRICE_CENTS);
  });

  it('stays inside the stated window and uses only reserved email addresses', () => {
    for (const day of SUMMER_DAYS) {
      const at = new Date(`${day.date}T12:00:00.000Z`);
      expect(at.getTime()).toBeGreaterThanOrEqual(SUMMER_2026_WINDOW.from.getTime());
      expect(at.getTime()).toBeLessThanOrEqual(SUMMER_2026_WINDOW.to.getTime());
    }

    for (const transaction of SUMMER_TRANSACTIONS) {
      expect(transaction.email.endsWith('@example.invalid')).toBe(true);
    }
    for (const subscription of SUMMER_SUBSCRIPTIONS) {
      expect(subscription.email.endsWith('@example.invalid')).toBe(true);
    }
  });

  it('exposes a chart series whose revenue matches the charges it came from', () => {
    expect(SUMMER_SERIES).toHaveLength(SUMMER_DAYS.length);

    const seriesTotal = SUMMER_SERIES.reduce((sum, point) => sum + point.revenueCents, 0);
    expect(seriesTotal).toBe(SUMMER_TOTALS.grossRevenueCents);
  });
});
