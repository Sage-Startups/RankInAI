import {
  type AuditCategory,
  EffortLevel,
  EvidenceSource,
  FindingStatus,
  ImpactLevel,
  Severity,
} from '@prisma/client';

import type { CheckResult } from '@/lib/audit/types';

/**
 * Builder used by every check module.
 *
 * Severity is derived from status + weight rather than being set by hand, so
 * "how bad is this" stays consistent across the whole engine.
 */

export interface CheckInput {
  checkId: string;
  title: string;
  status: FindingStatus;
  /** Fraction of maxPoints awarded, 0-1. Ignored when status is NOT_APPLICABLE. */
  ratio: number;
  maxPoints: number;
  evidence: Record<string, unknown>;
  explanation: string;
  recommendedAction: string;
  effort?: EffortLevel;
  impact?: ImpactLevel;
  pageUrl?: string | null;
  source?: EvidenceSource;
}

function deriveSeverity(status: FindingStatus, maxPoints: number, ratio: number): Severity {
  if (status === FindingStatus.PASS) return Severity.PASSED;
  if (status === FindingStatus.INFO) return Severity.INFORMATIONAL;
  if (status === FindingStatus.NOT_APPLICABLE) return Severity.INFORMATIONAL;

  // Weight the shortfall by how much of the category the check controls.
  const shortfall = maxPoints * (1 - Math.max(0, Math.min(1, ratio)));

  if (status === FindingStatus.FAIL) {
    if (shortfall >= 8) return Severity.CRITICAL;
    if (shortfall >= 5) return Severity.HIGH;
    if (shortfall >= 2.5) return Severity.MEDIUM;
    return Severity.LOW;
  }

  // WARN
  if (shortfall >= 6) return Severity.HIGH;
  if (shortfall >= 3) return Severity.MEDIUM;
  return Severity.LOW;
}

export function makeCheck(category: AuditCategory, input: CheckInput): CheckResult {
  const applicable = input.status !== FindingStatus.NOT_APPLICABLE;
  const ratio = Math.max(0, Math.min(1, input.ratio));

  return {
    checkId: input.checkId,
    category,
    title: input.title,
    status: input.status,
    severity: deriveSeverity(input.status, input.maxPoints, ratio),
    evidence: input.evidence,
    explanation: input.explanation,
    recommendedAction: input.recommendedAction,
    effort: input.effort ?? EffortLevel.MEDIUM,
    impact: input.impact ?? ImpactLevel.MEDIUM,
    pageUrl: input.pageUrl ?? null,
    source: input.source ?? EvidenceSource.OBSERVED,
    points: applicable ? Number((ratio * input.maxPoints).toFixed(3)) : 0,
    maxPoints: applicable ? input.maxPoints : 0,
    applicable,
  };
}

/** Convenience: choose a status from a 0-1 ratio using standard thresholds. */
export function statusFromRatio(
  ratio: number,
  opts: { passAt?: number; warnAt?: number } = {},
): FindingStatus {
  const passAt = opts.passAt ?? 0.85;
  const warnAt = opts.warnAt ?? 0.4;
  if (ratio >= passAt) return FindingStatus.PASS;
  if (ratio >= warnAt) return FindingStatus.WARN;
  return FindingStatus.FAIL;
}

/** Ratio helper: proportion of items satisfying a predicate. */
export function proportion<T>(items: T[], predicate: (item: T) => boolean): number {
  if (items.length === 0) return 0;
  return items.filter(predicate).length / items.length;
}

/** Clamp a raw count onto a 0-1 scale with a target value. */
export function scaleToTarget(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(1, value / target));
}

export const Status = FindingStatus;
export const Effort = EffortLevel;
export const Impact = ImpactLevel;
export const Source = EvidenceSource;
