import { describe, expect, it } from 'vitest';

import { PREVIEW_DISCLAIMER } from '@/lib/audit/preview';
import { FREE_PREVIEW_MAX_FINDINGS } from '@/lib/plans';
import { buildDeterministicSummary } from '@/lib/audit/llm';
import { CATEGORY_ORDER, CATEGORY_WEIGHTS } from '@/lib/audit/scoring';
import type { CategoryScore } from '@/lib/audit/types';

describe('free preview constraints', () => {
  it('caps findings at five', () => {
    expect(FREE_PREVIEW_MAX_FINDINGS).toBe(5);
  });

  it('states clearly that it is not the full paid audit', () => {
    expect(PREVIEW_DISCLAIMER.toLowerCase()).toContain('homepage only');
    expect(PREVIEW_DISCLAIMER.toLowerCase()).toContain('not the full paid audit');
  });
});

describe('deterministic summary (no LLM configured)', () => {
  const categories: CategoryScore[] = CATEGORY_ORDER.map((category, index) => ({
    category,
    score: 50 + index * 5,
    available: true,
    baseWeight: CATEGORY_WEIGHTS[category],
    effectiveWeight: CATEGORY_WEIGHTS[category],
    rawPoints: 30,
    maxPoints: 60,
    summary: 'Category summary.',
  }));

  const summary = buildDeterministicSummary({
    businessName: 'Northbridge Plumbing Co.',
    websiteUrl: 'https://example.com',
    overallScore: 64,
    categories,
    strengths: ['Complete contact details published', 'Every page served over HTTPS'],
    weaknesses: ['No FAQPage structured data', 'Service pages are thin'],
    pagesCrawled: 9,
    criticalCount: 1,
    highCount: 4,
  });

  it('produces a usable summary without any model call', () => {
    expect(summary.length).toBeGreaterThan(200);
    expect(summary).toContain('Northbridge Plumbing Co.');
    expect(summary).toContain('64 out of 100');
    expect(summary).toContain('9 pages');
  });

  it('names the strongest and weakest categories', () => {
    expect(summary).toContain('Competitive Visibility');
    expect(summary).toContain('Technical Accessibility');
  });

  it('reports the critical and high-severity counts', () => {
    expect(summary).toContain('1 critical');
    expect(summary).toContain('4 high-severity');
  });

  it('lists the supplied strengths and weaknesses', () => {
    expect(summary).toContain('Complete contact details published');
    expect(summary).toContain('No FAQPage structured data');
  });

  it('uses honest wording and never guarantees an AI mention', () => {
    const lower = summary.toLowerCase();
    expect(lower).toContain('may improve');
    expect(lower).toContain('no tool can guarantee');
    expect(lower).not.toContain('will be recommended');
    expect(lower).not.toContain('guaranteed');
  });

  it('is deterministic', () => {
    const again = buildDeterministicSummary({
      businessName: 'Northbridge Plumbing Co.',
      websiteUrl: 'https://example.com',
      overallScore: 64,
      categories,
      strengths: ['Complete contact details published', 'Every page served over HTTPS'],
      weaknesses: ['No FAQPage structured data', 'Service pages are thin'],
      pagesCrawled: 9,
      criticalCount: 1,
      highCount: 4,
    });
    expect(again).toBe(summary);
  });

  it('handles a clean audit with no critical or high findings', () => {
    const clean = buildDeterministicSummary({
      businessName: 'Clean Co.',
      websiteUrl: 'https://clean.example',
      overallScore: 94,
      categories,
      strengths: ['Everything passed'],
      weaknesses: [],
      pagesCrawled: 12,
      criticalCount: 0,
      highCount: 0,
    });
    expect(clean).toContain('No critical or high-severity blockers');
  });

  it('handles high-severity findings with no critical ones', () => {
    const result = buildDeterministicSummary({
      businessName: 'Mixed Co.',
      websiteUrl: 'https://mixed.example',
      overallScore: 70,
      categories,
      strengths: [],
      weaknesses: ['Thin service pages'],
      pagesCrawled: 6,
      criticalCount: 0,
      highCount: 2,
    });
    expect(result).toContain('No critical blockers were found');
    expect(result).toContain('2 high-severity');
  });
});
