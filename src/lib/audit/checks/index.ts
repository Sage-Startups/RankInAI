import type { AuditContext, CheckResult } from '@/lib/audit/types';
import { runAnswerChecks } from '@/lib/audit/checks/answer';
import { runCompetitiveChecks } from '@/lib/audit/checks/competitive';
import { runContentChecks } from '@/lib/audit/checks/content';
import { runEntityChecks } from '@/lib/audit/checks/entity';
import { runStructuredDataChecks } from '@/lib/audit/checks/structured-data';
import { runTechnicalChecks } from '@/lib/audit/checks/technical';
import { runTrustChecks } from '@/lib/audit/checks/trust';

export { competitorQuickScore } from '@/lib/audit/checks/competitive';

/**
 * Run every deterministic check against the collected evidence.
 *
 * Purely a function of `ctx` — no clocks, no randomness, no network. The same
 * context always produces the same checks, which is what makes audits
 * reproducible and unit-testable.
 */
export function runAllChecks(ctx: AuditContext): CheckResult[] {
  return [
    ...runTechnicalChecks(ctx),
    ...runEntityChecks(ctx),
    ...runContentChecks(ctx),
    ...runAnswerChecks(ctx),
    ...runStructuredDataChecks(ctx),
    ...runTrustChecks(ctx),
    ...runCompetitiveChecks(ctx),
  ].map((check, index) => ({ ...check, sortOrder: index }) as CheckResult & { sortOrder: number });
}
