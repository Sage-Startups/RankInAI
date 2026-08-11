import { describe, expect, it } from 'vitest';

import { PRODUCTS } from '@/lib/plans';
import {
  ONE_TIME_PRICE_CENTS,
  STARTER_PRICE_CENTS,
  SUMMER_2026_WINDOW,
  SUMMER_DAYS,
  SUMMER_MONTHS,
  SUMMER_SERIES,
  SUMMER_SUBSCRIPTION,
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
  it('is exactly three one-time audits and one Starter subscription', () => {
    const oneTime = SUMMER_TRANSACTIONS.filter((t) => t.kind === 'ONE_TIME');
    const recurring = SUMMER_TRANSACTIONS.filter((t) => t.kind === 'SUBSCRIPTION');

    expect(oneTime).toHaveLength(3);
    expect(SUMMER_TOTALS.activeSubscriptions).toBe(1);
    // One subscription, billed once in June and once in July.
    expect(recurring).toHaveLength(2);
    expect(new Set(recurring.map((t) => t.email)).size).toBe(1);
  });

  it('prices every charge from the product catalog, not from a copied number', () => {
    expect(ONE_TIME_PRICE_CENTS).toBe(PRODUCTS.ONE_TIME_AUDIT.priceCents);
    expect(STARTER_PRICE_CENTS).toBe(PRODUCTS.STARTER_MONTHLY.priceCents);

    for (const transaction of SUMMER_TRANSACTIONS) {
      expect(transaction.amountCents).toBe(
        transaction.kind === 'ONE_TIME' ? ONE_TIME_PRICE_CENTS : STARTER_PRICE_CENTS,
      );
    }
  });

  it('totals the charges the table actually lists', () => {
    const charged = SUMMER_TRANSACTIONS.reduce((sum, t) => sum + t.amountCents, 0);

    expect(SUMMER_TOTALS.grossRevenueCents).toBe(charged);
    expect(SUMMER_TOTALS.oneTimeRevenueCents).toBe(3 * ONE_TIME_PRICE_CENTS);
    expect(SUMMER_TOTALS.subscriptionRevenueCents).toBe(2 * STARTER_PRICE_CENTS);
    expect(SUMMER_TOTALS.oneTimeRevenueCents + SUMMER_TOTALS.subscriptionRevenueCents).toBe(
      SUMMER_TOTALS.grossRevenueCents,
    );
  });

  it('keeps the daily series in step with the charge list', () => {
    const paidDays = SUMMER_DAYS.filter((d) => d.oneTimeSales + d.subscriptionInvoices > 0);
    const chargeDates = SUMMER_TRANSACTIONS.map((t) => t.date).sort();

    expect(paidDays.map((d) => d.date).sort()).toEqual(chargeDates);
    expect(SUMMER_TOTALS.oneTimeSales).toBe(3);
    expect(SUMMER_TOTALS.subscriptionInvoices).toBe(2);
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

  it('bills the subscription in both months, not twice in one', () => {
    const june = SUMMER_MONTHS[0];
    const july = SUMMER_MONTHS[1];

    expect(june.subscriptionInvoices).toBe(1);
    expect(july.subscriptionInvoices).toBe(1);
    expect(SUMMER_SUBSCRIPTION.startedOn.startsWith('2026-06')).toBe(true);
    expect(SUMMER_SUBSCRIPTION.renewedOn.startsWith('2026-07')).toBe(true);
    expect(SUMMER_SUBSCRIPTION.periodsBilled).toBe(2);
  });

  it('never shows the subscriber using more audits than the plan includes', () => {
    const included = PRODUCTS.STARTER_MONTHLY.entitlements.auditsPerPeriod;

    expect(SUMMER_SUBSCRIPTION.auditsIncludedPerPeriod).toBe(included);
    expect(SUMMER_SUBSCRIPTION.auditsUsedFirstPeriod).toBeLessThanOrEqual(included);
    expect(SUMMER_SUBSCRIPTION.auditsUsedSecondPeriod).toBeLessThanOrEqual(included);
  });

  it('accounts for every completed audit', () => {
    // One per one-time credit, plus the subscriber's usage across both periods.
    const expected =
      SUMMER_TOTALS.oneTimeSales +
      SUMMER_SUBSCRIPTION.auditsUsedFirstPeriod +
      SUMMER_SUBSCRIPTION.auditsUsedSecondPeriod;

    expect(SUMMER_TOTALS.auditsCompleted).toBe(expected);
    expect(SUMMER_TOTALS.auditsCreated).toBe(SUMMER_TOTALS.auditsCompleted);
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
    expect(SUMMER_SUBSCRIPTION.email.endsWith('@example.invalid')).toBe(true);
  });

  it('exposes a chart series whose revenue matches the day it came from', () => {
    expect(SUMMER_SERIES).toHaveLength(SUMMER_DAYS.length);

    const seriesTotal = SUMMER_SERIES.reduce((sum, point) => sum + point.revenueCents, 0);
    expect(seriesTotal).toBe(SUMMER_TOTALS.grossRevenueCents);
  });
});
