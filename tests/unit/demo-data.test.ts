import { describe, expect, it } from 'vitest';

import {
  APRIL_2026_WINDOW,
  BUYER_PREVIEW_BANNER,
  DEMO_DAYS,
  DEMO_PURCHASES,
  DEMO_SNAPSHOT_TOTALS,
  ONE_TIME_PRICE_CENTS,
} from '@/lib/demo/buyer-snapshot';
import {
  DEMO_BUSINESS,
  DEMO_CATEGORY_SCORES,
  DEMO_DISCLAIMER,
  DEMO_FINDINGS,
  DEMO_LABEL,
  DEMO_PAGES,
  DEMO_RECOMMENDATIONS,
  DEMO_SEQUENCE,
} from '@/lib/demo/sample-audit';
import { buildSampleReportData } from '@/lib/report/build';
import { CATEGORY_ORDER } from '@/lib/audit/scoring';

describe('April 2026 buyer-preview dataset', () => {
  it('matches the specified totals exactly', () => {
    expect(DEMO_SNAPSHOT_TOTALS.signups).toBe(3);
    expect(DEMO_SNAPSHOT_TOTALS.oneTimeSales).toBe(5);
    expect(DEMO_SNAPSHOT_TOTALS.grossRevenueCents).toBe(24_500); // $245.00
    expect(DEMO_SNAPSHOT_TOTALS.subscriptionRevenueCents).toBe(0);
    expect(DEMO_SNAPSHOT_TOTALS.creditsPurchased).toBe(5);
    expect(DEMO_SNAPSHOT_TOTALS.auditsCompleted).toBe(5);
  });

  it('prices the one-time audit at $49', () => {
    expect(ONE_TIME_PRICE_CENTS).toBe(4900);
  });

  it('has daily rows that sum to the headline totals', () => {
    const signups = DEMO_DAYS.reduce((sum, day) => sum + day.signups, 0);
    const sales = DEMO_DAYS.reduce((sum, day) => sum + day.oneTimeSales, 0);
    const completed = DEMO_DAYS.reduce((sum, day) => sum + day.auditsCompleted, 0);
    const revenue = DEMO_DAYS.reduce(
      (sum, day) => sum + day.oneTimeSales * ONE_TIME_PRICE_CENTS,
      0,
    );

    expect(signups).toBe(DEMO_SNAPSHOT_TOTALS.signups);
    expect(sales).toBe(DEMO_SNAPSHOT_TOTALS.oneTimeSales);
    expect(completed).toBe(DEMO_SNAPSHOT_TOTALS.auditsCompleted);
    expect(revenue).toBe(DEMO_SNAPSHOT_TOTALS.grossRevenueCents);
  });

  it('keeps every day inside April 2026', () => {
    for (const day of DEMO_DAYS) {
      const date = new Date(`${day.date}T00:00:00Z`);
      expect(date.getTime()).toBeGreaterThanOrEqual(APRIL_2026_WINDOW.from.getTime());
      expect(date.getTime()).toBeLessThanOrEqual(APRIL_2026_WINDOW.to.getTime());
      expect(day.date.startsWith('2026-04')).toBe(true);
    }
  });

  it('has no duplicate dates', () => {
    const dates = DEMO_DAYS.map((day) => day.date);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('lists exactly five purchases totalling $245', () => {
    expect(DEMO_PURCHASES).toHaveLength(5);
    const total = DEMO_PURCHASES.reduce((sum, purchase) => sum + purchase.amountCents, 0);
    expect(total).toBe(DEMO_SNAPSHOT_TOTALS.grossRevenueCents);
  });

  it('grants exactly one credit per purchase', () => {
    const credits = DEMO_PURCHASES.reduce((sum, p) => sum + p.creditsGranted, 0);
    expect(credits).toBe(DEMO_SNAPSHOT_TOTALS.creditsPurchased);
  });

  it('uses only reserved .invalid email addresses so no real inbox is implied', () => {
    for (const purchase of DEMO_PURCHASES) {
      expect(purchase.email.endsWith('.invalid')).toBe(true);
    }
  });

  it('references only reserved .example domains for audited sites', () => {
    for (const purchase of DEMO_PURCHASES) {
      expect(purchase.auditDomain.endsWith('.example')).toBe(true);
    }
  });

  it('uses exactly three distinct demonstration customers', () => {
    const emails = new Set(DEMO_PURCHASES.map((p) => p.email));
    expect(emails.size).toBe(DEMO_SNAPSHOT_TOTALS.signups);
  });

  it('states the required banner text verbatim', () => {
    expect(BUYER_PREVIEW_BANNER).toBe(
      'DEMO BUSINESS DATA — FOR PRODUCT PRESENTATION ONLY. THIS IS NOT VERIFIED REVENUE OR ACTUAL HISTORICAL PERFORMANCE.',
    );
  });
});

describe('Atlas Roofing demonstration audit', () => {
  it('scores 72 out of 100 as specified', () => {
    expect(DEMO_BUSINESS.overallScore).toBe(72);
  });

  it('uses a reserved .example domain for the fictional business', () => {
    expect(DEMO_BUSINESS.websiteUrl).toContain('.example');
    expect(DEMO_BUSINESS.displayDomain.endsWith('.example')).toBe(true);
  });

  it('provides a score for all seven categories', () => {
    expect(DEMO_CATEGORY_SCORES).toHaveLength(CATEGORY_ORDER.length);
    for (const category of CATEGORY_ORDER) {
      expect(DEMO_CATEGORY_SCORES.some((c) => c.category === category)).toBe(true);
    }
  });

  it('keeps every category score inside 0-100', () => {
    for (const category of DEMO_CATEGORY_SCORES) {
      expect(category.score).toBeGreaterThanOrEqual(0);
      expect(category.score).toBeLessThanOrEqual(100);
    }
  });

  it('runs the demo sequence in roughly five seconds', () => {
    const total = DEMO_SEQUENCE.reduce((sum, step) => sum + step.durationMs, 0);
    expect(total).toBeGreaterThan(4000);
    expect(total).toBeLessThan(6500);
  });

  it('covers the specified demo sequence steps', () => {
    const labels = DEMO_SEQUENCE.map((step) => step.label.toLowerCase());
    expect(labels.some((l) => l.includes('crawl access'))).toBe(true);
    expect(labels.some((l) => l.includes('structured data'))).toBe(true);
    expect(labels.some((l) => l.includes('entity'))).toBe(true);
    expect(labels.some((l) => l.includes('answer-ready'))).toBe(true);
    expect(labels.some((l) => l.includes('competitor'))).toBe(true);
    expect(labels.some((l) => l.includes('recommendations'))).toBe(true);
  });

  it('labels the dataset as demo data and disclaims it', () => {
    expect(DEMO_LABEL).toBe('Demo data');
    expect(DEMO_DISCLAIMER.toLowerCase()).toContain('fictional');
    expect(DEMO_DISCLAIMER.toLowerCase()).toContain('not a real company');
  });

  it('has findings, recommendations and pages', () => {
    expect(DEMO_FINDINGS.length).toBeGreaterThanOrEqual(6);
    expect(DEMO_RECOMMENDATIONS.length).toBeGreaterThanOrEqual(6);
    expect(DEMO_PAGES).toHaveLength(DEMO_BUSINESS.pagesCrawled);
  });

  it('orders recommendations by priority with Do first at the top', () => {
    DEMO_RECOMMENDATIONS.forEach((rec, index) => {
      expect(rec.priority).toBe(index + 1);
    });
    expect(DEMO_RECOMMENDATIONS[0]?.horizon).toBe('DO_FIRST');
  });
});

describe('sample report projection', () => {
  const data = buildSampleReportData();

  it('is always flagged as demo data', () => {
    expect(data.isDemo).toBe(true);
  });

  it('projects all seven categories', () => {
    expect(data.categories).toHaveLength(CATEGORY_ORDER.length);
  });

  it('carries the demonstration score', () => {
    expect(data.overallScore).toBe(72);
  });

  it('includes a competitor comparison', () => {
    expect(data.competitors.length).toBeGreaterThan(0);
    expect(data.competitors[0]?.overallScore).toBeGreaterThan(0);
  });

  it('never claims a guaranteed AI mention', () => {
    const text = JSON.stringify(data).toLowerCase();
    expect(text).not.toContain('guarantee');
    expect(text).not.toContain('will be recommended by chatgpt');
  });

  it('uses a fixed audit date so the sample never drifts', () => {
    const again = buildSampleReportData();
    expect(data.auditDate.toISOString()).toBe(again.auditDate.toISOString());
  });
});
