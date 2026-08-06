import { AuditCategory } from '@prisma/client';

import type { CategoryScore, CheckResult, ScoredAudit } from '@/lib/audit/types';
import { CATEGORY_LABELS } from '@/lib/audit/types';

/**
 * Category weighting for the overall AI Visibility Score.
 *
 * Documented in AUDIT_METHODOLOGY.md. The weights sum to 1.00.
 */
export const CATEGORY_WEIGHTS: Record<AuditCategory, number> = {
  TECHNICAL_ACCESSIBILITY: 0.15,
  ENTITY_CLARITY: 0.17,
  CONTENT_AUTHORITY: 0.18,
  ANSWER_READINESS: 0.17,
  STRUCTURED_DATA: 0.13,
  TRUST_AND_EVIDENCE: 0.15,
  COMPETITIVE_VISIBILITY: 0.05,
};

export const CATEGORY_ORDER: AuditCategory[] = [
  AuditCategory.TECHNICAL_ACCESSIBILITY,
  AuditCategory.ENTITY_CLARITY,
  AuditCategory.CONTENT_AUTHORITY,
  AuditCategory.ANSWER_READINESS,
  AuditCategory.STRUCTURED_DATA,
  AuditCategory.TRUST_AND_EVIDENCE,
  AuditCategory.COMPETITIVE_VISIBILITY,
];

/**
 * Redistribute the weight of unavailable categories across the available ones,
 * in proportion to their base weights, so the overall score always sits on a
 * 0-100 scale regardless of how many categories could be measured.
 */
export function rebalanceWeights(
  availability: Record<AuditCategory, boolean>,
): Record<AuditCategory, number> {
  const availableTotal = CATEGORY_ORDER.filter((c) => availability[c]).reduce(
    (sum, c) => sum + CATEGORY_WEIGHTS[c],
    0,
  );

  const result = {} as Record<AuditCategory, number>;

  if (availableTotal <= 0) {
    for (const category of CATEGORY_ORDER) result[category] = 0;
    return result;
  }

  for (const category of CATEGORY_ORDER) {
    result[category] = availability[category] ? CATEGORY_WEIGHTS[category] / availableTotal : 0;
  }

  return result;
}

/** Compute a 0-100 score from the applicable checks in one category. */
export function scoreCategory(checks: CheckResult[]): {
  score: number;
  rawPoints: number;
  maxPoints: number;
  applicableCount: number;
} {
  const applicable = checks.filter((c) => c.applicable && c.maxPoints > 0);
  const rawPoints = applicable.reduce((sum, c) => sum + c.points, 0);
  const maxPoints = applicable.reduce((sum, c) => sum + c.maxPoints, 0);

  if (maxPoints <= 0) {
    return { score: 0, rawPoints: 0, maxPoints: 0, applicableCount: 0 };
  }

  const ratio = Math.max(0, Math.min(1, rawPoints / maxPoints));
  return {
    score: Math.round(ratio * 100),
    rawPoints: Number(rawPoints.toFixed(2)),
    maxPoints: Number(maxPoints.toFixed(2)),
    applicableCount: applicable.length,
  };
}

function summarize(category: AuditCategory, score: number, checks: CheckResult[]): string {
  const failures = checks.filter((c) => c.status === 'FAIL' && c.applicable).length;
  const warnings = checks.filter((c) => c.status === 'WARN' && c.applicable).length;
  const passes = checks.filter((c) => c.status === 'PASS' && c.applicable).length;
  const label = CATEGORY_LABELS[category];

  if (score >= 85) {
    return `${label} is strong: ${passes} checks passed with ${failures + warnings} items left to tidy up.`;
  }
  if (score >= 70) {
    return `${label} is solid but improvable — ${failures} failing and ${warnings} partial checks are holding the score back.`;
  }
  if (score >= 55) {
    return `${label} needs work. ${failures} checks failed outright and ${warnings} were only partially satisfied.`;
  }
  if (score >= 35) {
    return `${label} is weak. ${failures} of ${failures + warnings + passes} applicable checks failed.`;
  }
  return `${label} is a critical gap — ${failures} checks failed and only ${passes} passed.`;
}

/**
 * Aggregate every check into category scores and a weighted overall score.
 *
 * A category is "unavailable" when it has no applicable checks — most commonly
 * Competitive Visibility when the user supplied no competitor URLs.
 */
export function aggregateScores(checks: CheckResult[]): ScoredAudit {
  const byCategory = new Map<AuditCategory, CheckResult[]>();
  for (const category of CATEGORY_ORDER) byCategory.set(category, []);
  for (const check of checks) {
    byCategory.get(check.category)?.push(check);
  }

  const availability = {} as Record<AuditCategory, boolean>;
  const partial = new Map<AuditCategory, ReturnType<typeof scoreCategory>>();

  for (const category of CATEGORY_ORDER) {
    const result = scoreCategory(byCategory.get(category) ?? []);
    partial.set(category, result);
    availability[category] = result.applicableCount > 0;
  }

  const weights = rebalanceWeights(availability);

  const categories: CategoryScore[] = CATEGORY_ORDER.map((category) => {
    const result = partial.get(category)!;
    const available = availability[category];
    return {
      category,
      score: available ? result.score : 0,
      available,
      baseWeight: CATEGORY_WEIGHTS[category],
      effectiveWeight: Number(weights[category].toFixed(4)),
      rawPoints: result.rawPoints,
      maxPoints: result.maxPoints,
      summary: available
        ? summarize(category, result.score, byCategory.get(category) ?? [])
        : 'Not measured for this audit. Its weight was redistributed across the other categories.',
    };
  });

  const overall = categories.reduce(
    (sum, c) => (c.available ? sum + c.score * c.effectiveWeight : sum),
    0,
  );

  return {
    overallScore: Math.round(Math.max(0, Math.min(100, overall))),
    categories,
    checks,
  };
}

/** Human-readable interpretation of the overall score, used in reports. */
export function overallScoreInterpretation(score: number): string {
  if (score >= 85) {
    return 'This website presents strong, consistent signals. AI systems can reach it, identify the business clearly, and find passages worth citing.';
  }
  if (score >= 70) {
    return 'This website is in reasonable shape for AI visibility. The fundamentals are present, but specific gaps are limiting how confidently an answer engine could describe or cite the business.';
  }
  if (score >= 55) {
    return 'This website has meaningful gaps. AI systems can reach some of it, but weak entity definition or thin answer-ready content makes the brand harder to summarize accurately.';
  }
  if (score >= 35) {
    return 'This website is difficult for AI systems to work with. Several foundational signals are missing, which materially reduces the chance of the brand being described correctly or cited.';
  }
  return 'This website presents critical barriers to AI visibility. Core accessibility, identity or content signals are missing and should be addressed before anything else.';
}
