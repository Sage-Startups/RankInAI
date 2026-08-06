import {
  AuditCategory,
  EffortLevel,
  EvidenceSource,
  FindingStatus,
  ImpactLevel,
  Severity,
} from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  CATEGORY_ORDER,
  CATEGORY_WEIGHTS,
  aggregateScores,
  overallScoreInterpretation,
  rebalanceWeights,
  scoreCategory,
} from '@/lib/audit/scoring';
import type { CheckResult } from '@/lib/audit/types';

function check(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    checkId: overrides.checkId ?? 'test.check',
    category: overrides.category ?? AuditCategory.TECHNICAL_ACCESSIBILITY,
    title: 'Test check',
    status: overrides.status ?? FindingStatus.PASS,
    severity: overrides.severity ?? Severity.PASSED,
    evidence: {},
    explanation: 'Explanation',
    recommendedAction: 'Action',
    effort: EffortLevel.LOW,
    impact: ImpactLevel.MEDIUM,
    pageUrl: null,
    source: EvidenceSource.OBSERVED,
    points: overrides.points ?? 10,
    maxPoints: overrides.maxPoints ?? 10,
    applicable: overrides.applicable ?? true,
    ...overrides,
  };
}

describe('CATEGORY_WEIGHTS', () => {
  it('sums to exactly 1.00', () => {
    const total = CATEGORY_ORDER.reduce((sum, category) => sum + CATEGORY_WEIGHTS[category], 0);
    expect(Number(total.toFixed(6))).toBe(1);
  });

  it('matches the documented weighting', () => {
    expect(CATEGORY_WEIGHTS.TECHNICAL_ACCESSIBILITY).toBe(0.15);
    expect(CATEGORY_WEIGHTS.ENTITY_CLARITY).toBe(0.17);
    expect(CATEGORY_WEIGHTS.CONTENT_AUTHORITY).toBe(0.18);
    expect(CATEGORY_WEIGHTS.ANSWER_READINESS).toBe(0.17);
    expect(CATEGORY_WEIGHTS.STRUCTURED_DATA).toBe(0.13);
    expect(CATEGORY_WEIGHTS.TRUST_AND_EVIDENCE).toBe(0.15);
    expect(CATEGORY_WEIGHTS.COMPETITIVE_VISIBILITY).toBe(0.05);
  });
});

describe('scoreCategory', () => {
  it('returns 100 when every applicable check is fully awarded', () => {
    const result = scoreCategory([
      check({ points: 10, maxPoints: 10 }),
      check({ points: 5, maxPoints: 5 }),
    ]);
    expect(result.score).toBe(100);
    expect(result.rawPoints).toBe(15);
    expect(result.maxPoints).toBe(15);
  });

  it('returns 0 when nothing is awarded', () => {
    const result = scoreCategory([check({ points: 0, maxPoints: 10 })]);
    expect(result.score).toBe(0);
  });

  it('rounds proportionally', () => {
    const result = scoreCategory([check({ points: 7, maxPoints: 10 })]);
    expect(result.score).toBe(70);
  });

  it('excludes non-applicable checks from both numerator and denominator', () => {
    const result = scoreCategory([
      check({ points: 10, maxPoints: 10 }),
      check({ points: 0, maxPoints: 0, applicable: false }),
    ]);
    expect(result.score).toBe(100);
    expect(result.applicableCount).toBe(1);
  });

  it('returns zero when there are no applicable checks', () => {
    const result = scoreCategory([check({ applicable: false, maxPoints: 0 })]);
    expect(result).toEqual({ score: 0, rawPoints: 0, maxPoints: 0, applicableCount: 0 });
  });
});

describe('rebalanceWeights', () => {
  it('leaves weights unchanged when every category is available', () => {
    const availability = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, true])) as Record<
      AuditCategory,
      boolean
    >;

    const weights = rebalanceWeights(availability);
    for (const category of CATEGORY_ORDER) {
      expect(weights[category]).toBeCloseTo(CATEGORY_WEIGHTS[category], 6);
    }
  });

  it('redistributes Competitive Visibility proportionally when it is unavailable', () => {
    const availability = Object.fromEntries(
      CATEGORY_ORDER.map((c) => [c, c !== AuditCategory.COMPETITIVE_VISIBILITY]),
    ) as Record<AuditCategory, boolean>;

    const weights = rebalanceWeights(availability);

    expect(weights.COMPETITIVE_VISIBILITY).toBe(0);

    // Remaining weights still sum to 1.
    const total = CATEGORY_ORDER.reduce((sum, c) => sum + weights[c], 0);
    expect(total).toBeCloseTo(1, 6);

    // Each remaining weight is its base weight divided by 0.95.
    expect(weights.CONTENT_AUTHORITY).toBeCloseTo(0.18 / 0.95, 6);
    expect(weights.TECHNICAL_ACCESSIBILITY).toBeCloseTo(0.15 / 0.95, 6);

    // Relative proportions are preserved.
    expect(weights.CONTENT_AUTHORITY / weights.TECHNICAL_ACCESSIBILITY).toBeCloseTo(0.18 / 0.15, 6);
  });

  it('handles several unavailable categories', () => {
    const availability = Object.fromEntries(
      CATEGORY_ORDER.map((c) => [
        c,
        c === AuditCategory.TECHNICAL_ACCESSIBILITY || c === AuditCategory.ENTITY_CLARITY,
      ]),
    ) as Record<AuditCategory, boolean>;

    const weights = rebalanceWeights(availability);
    expect(weights.TECHNICAL_ACCESSIBILITY).toBeCloseTo(0.15 / 0.32, 6);
    expect(weights.ENTITY_CLARITY).toBeCloseTo(0.17 / 0.32, 6);
    expect(CATEGORY_ORDER.reduce((sum, c) => sum + weights[c], 0)).toBeCloseTo(1, 6);
  });

  it('returns all-zero weights when nothing is available', () => {
    const availability = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, false])) as Record<
      AuditCategory,
      boolean
    >;

    const weights = rebalanceWeights(availability);
    for (const category of CATEGORY_ORDER) expect(weights[category]).toBe(0);
  });
});

describe('aggregateScores', () => {
  const perfectChecks = CATEGORY_ORDER.map((category) =>
    check({ category, checkId: `${category}.perfect`, points: 10, maxPoints: 10 }),
  );

  it('produces 100 when every category is perfect', () => {
    const result = aggregateScores(perfectChecks);
    expect(result.overallScore).toBe(100);
  });

  it('produces 0 when every category scores nothing', () => {
    const result = aggregateScores(
      CATEGORY_ORDER.map((category) =>
        check({
          category,
          checkId: `${category}.zero`,
          points: 0,
          maxPoints: 10,
          status: FindingStatus.FAIL,
        }),
      ),
    );
    expect(result.overallScore).toBe(0);
  });

  it('marks a category unavailable when it has no applicable checks', () => {
    const withoutCompetitive = perfectChecks.filter(
      (c) => c.category !== AuditCategory.COMPETITIVE_VISIBILITY,
    );
    const result = aggregateScores(withoutCompetitive);

    const competitive = result.categories.find(
      (c) => c.category === AuditCategory.COMPETITIVE_VISIBILITY,
    );
    expect(competitive?.available).toBe(false);
    expect(competitive?.effectiveWeight).toBe(0);
    // The other six still total 100.
    expect(result.overallScore).toBe(100);
  });

  it('is deterministic — identical input always produces an identical result', () => {
    const input = [
      check({
        category: AuditCategory.TECHNICAL_ACCESSIBILITY,
        checkId: 'a',
        points: 7,
        maxPoints: 10,
      }),
      check({ category: AuditCategory.ENTITY_CLARITY, checkId: 'b', points: 3, maxPoints: 10 }),
      check({ category: AuditCategory.CONTENT_AUTHORITY, checkId: 'c', points: 9, maxPoints: 10 }),
      check({ category: AuditCategory.ANSWER_READINESS, checkId: 'd', points: 5, maxPoints: 10 }),
      check({ category: AuditCategory.STRUCTURED_DATA, checkId: 'e', points: 8, maxPoints: 10 }),
      check({ category: AuditCategory.TRUST_AND_EVIDENCE, checkId: 'f', points: 6, maxPoints: 10 }),
    ];

    const first = aggregateScores(input);
    const second = aggregateScores(input);
    const third = aggregateScores([...input].reverse());

    expect(first.overallScore).toBe(second.overallScore);
    expect(first.overallScore).toBe(third.overallScore);
  });

  it('computes the documented weighted example correctly', () => {
    // 100 in Technical (15%), 0 everywhere else that is available.
    const input = [
      check({
        category: AuditCategory.TECHNICAL_ACCESSIBILITY,
        checkId: 'a',
        points: 10,
        maxPoints: 10,
      }),
      check({ category: AuditCategory.ENTITY_CLARITY, checkId: 'b', points: 0, maxPoints: 10 }),
      check({ category: AuditCategory.CONTENT_AUTHORITY, checkId: 'c', points: 0, maxPoints: 10 }),
      check({ category: AuditCategory.ANSWER_READINESS, checkId: 'd', points: 0, maxPoints: 10 }),
      check({ category: AuditCategory.STRUCTURED_DATA, checkId: 'e', points: 0, maxPoints: 10 }),
      check({ category: AuditCategory.TRUST_AND_EVIDENCE, checkId: 'f', points: 0, maxPoints: 10 }),
      check({
        category: AuditCategory.COMPETITIVE_VISIBILITY,
        checkId: 'g',
        points: 0,
        maxPoints: 10,
      }),
    ];

    const result = aggregateScores(input);
    expect(result.overallScore).toBe(15);
  });

  it('never produces a score outside 0-100', () => {
    const result = aggregateScores([
      // Points above maxPoints would be a bug; the ratio is clamped anyway.
      check({
        category: AuditCategory.TECHNICAL_ACCESSIBILITY,
        checkId: 'a',
        points: 999,
        maxPoints: 10,
      }),
    ]);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });
});

describe('overallScoreInterpretation', () => {
  it.each([
    [95, 'strong'],
    [75, 'reasonable shape'],
    [60, 'meaningful gaps'],
    [40, 'difficult'],
    [10, 'critical barriers'],
  ])('describes a score of %d with %j', (score, fragment) => {
    expect(overallScoreInterpretation(score).toLowerCase()).toContain(fragment);
  });

  it('never promises a mention in a specific AI assistant', () => {
    for (const score of [0, 25, 50, 75, 100]) {
      const text = overallScoreInterpretation(score).toLowerCase();
      expect(text).not.toContain('guarantee');
      expect(text).not.toContain('will be recommended');
    }
  });
});
