import { AuditCategory, EvidenceSource } from '@prisma/client';

import type { AuditContext, CheckResult } from '@/lib/audit/types';
import { Effort, Impact, Status, makeCheck } from '@/lib/audit/checks/helpers';

const CATEGORY = AuditCategory.COMPETITIVE_VISIBILITY;

/**
 * Competitive Visibility — how the site's observable signals compare with the
 * competitor URLs the user supplied.
 *
 * When no competitor was supplied, this module returns no checks at all. The
 * scoring layer then marks the category unavailable and redistributes its 5%
 * weight across the other six categories.
 *
 * Total available points when active: 30.
 */
export function runCompetitiveChecks(ctx: AuditContext): CheckResult[] {
  const analyzed = ctx.competitors.filter((c) => c.ok && c.quickScore != null);

  if (ctx.competitorsRequested === 0) {
    return [];
  }

  if (analyzed.length === 0) {
    // Competitors were requested but none could be analyzed. Report it as
    // informational so the user understands why, without scoring the category.
    return [
      makeCheck(CATEGORY, {
        checkId: 'competitive.unavailable',
        title: 'Competitor comparison could not be completed',
        status: Status.NOT_APPLICABLE,
        ratio: 0,
        maxPoints: 0,
        evidence: {
          competitorsRequested: ctx.competitorsRequested,
          failures: ctx.competitors.map((c) => ({ url: c.url, error: c.error })),
        },
        explanation:
          'None of the competitor URLs supplied could be fetched and analyzed, so this category was excluded from scoring and its weight was redistributed across the other categories.',
        recommendedAction:
          'Check that the competitor addresses are correct and publicly reachable, then re-run the audit.',
        effort: Effort.LOW,
        impact: Impact.LOW,
      }),
    ];
  }

  const checks: CheckResult[] = [];
  const home = ctx.homepage;

  const ourScore = home ? competitorQuickScore(home) : 0;
  const bestCompetitor = analyzed.reduce((best, c) =>
    (c.quickScore ?? 0) > (best.quickScore ?? 0) ? c : best,
  );
  const avgCompetitor = analyzed.reduce((sum, c) => sum + (c.quickScore ?? 0), 0) / analyzed.length;

  // --- Overall signal comparison --------------------------------------------
  const gap = ourScore - avgCompetitor;
  const overallRatio = Math.max(0, Math.min(1, 0.5 + gap / 100));
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'competitive.overall-signals',
      title: 'Homepage signals compared with competitors',
      status: gap >= 5 ? Status.PASS : gap >= -10 ? Status.WARN : Status.FAIL,
      ratio: overallRatio,
      maxPoints: 12,
      evidence: {
        yourHomepageSignalScore: Math.round(ourScore),
        competitorAverage: Math.round(avgCompetitor),
        strongestCompetitor: {
          url: bestCompetitor.url,
          score: Math.round(bestCompetitor.quickScore ?? 0),
        },
        competitorsAnalyzed: analyzed.length,
        note: 'Compares homepage-only signals. Competitor sites are not crawled in depth.',
      },
      explanation:
        'This compares the same homepage-level signals across your site and the competitors you supplied: schema completeness, entity clarity, answer structure and trust markers.',
      recommendedAction:
        gap >= 5
          ? 'You are ahead on observable homepage signals. Keep the advantage by extending the same rigor to your deeper pages.'
          : 'Close the gaps identified in the individual comparisons below, starting with structured data and answer-ready content.',
      effort: Effort.MEDIUM,
      impact: Impact.MEDIUM,
      source: EvidenceSource.OBSERVED,
    }),
  );

  // --- Structured data comparison --------------------------------------------
  const ourSchemaCount = home?.schemaTypes.length ?? 0;
  const compSchemaAvg =
    analyzed.reduce((sum, c) => sum + (c.signals?.schemaTypes.length ?? 0), 0) / analyzed.length;
  const schemaRatio =
    compSchemaAvg === 0
      ? ourSchemaCount > 0
        ? 1
        : 0.5
      : Math.max(0, Math.min(1, ourSchemaCount / Math.max(1, compSchemaAvg)));
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'competitive.structured-data',
      title: 'Structured data coverage versus competitors',
      status:
        ourSchemaCount >= compSchemaAvg
          ? Status.PASS
          : ourSchemaCount > 0
            ? Status.WARN
            : Status.FAIL,
      ratio: schemaRatio,
      maxPoints: 6,
      evidence: {
        yourSchemaTypes: home?.schemaTypes ?? [],
        competitorSchemaTypes: analyzed.map((c) => ({
          url: c.url,
          types: c.signals?.schemaTypes ?? [],
        })),
        competitorAverageTypeCount: Number(compSchemaAvg.toFixed(1)),
      },
      explanation:
        'Schema types your competitors declare and you do not represent categories of question where they are machine-readable and you are not.',
      recommendedAction:
        ourSchemaCount >= compSchemaAvg
          ? 'No action needed.'
          : `Add the schema types your competitors use but you do not: ${
              [...new Set(analyzed.flatMap((c) => c.signals?.schemaTypes ?? []))]
                .filter((t) => !(home?.schemaTypes ?? []).includes(t))
                .slice(0, 6)
                .join(', ') || 'none identified'
            }.`,
      effort: Effort.MEDIUM,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Content depth comparison ----------------------------------------------
  const ourWords = home?.wordCount ?? 0;
  const compWordAvg =
    analyzed.reduce((sum, c) => sum + (c.signals?.wordCount ?? 0), 0) / analyzed.length;
  const wordRatio =
    compWordAvg === 0 ? 1 : Math.max(0, Math.min(1, ourWords / Math.max(1, compWordAvg)));
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'competitive.content-depth',
      title: 'Homepage content depth versus competitors',
      status:
        ourWords >= compWordAvg * 0.9
          ? Status.PASS
          : ourWords >= compWordAvg * 0.5
            ? Status.WARN
            : Status.FAIL,
      ratio: wordRatio,
      maxPoints: 6,
      evidence: {
        yourHomepageWordCount: ourWords,
        competitorWordCounts: analyzed.map((c) => ({
          url: c.url,
          words: c.signals?.wordCount ?? 0,
        })),
        competitorAverage: Math.round(compWordAvg),
      },
      explanation:
        'A homepage with markedly less substantive text than competitors gives a retrieval system less to work with when composing an answer about your category.',
      recommendedAction:
        ourWords >= compWordAvg * 0.9
          ? 'No action needed.'
          : 'Expand your homepage copy so it covers at least as much ground as the competitors listed in the evidence.',
      effort: Effort.MEDIUM,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Answer-readiness comparison --------------------------------------------
  const ourQuestions = home?.questionHeadings.length ?? 0;
  const compQuestionAvg =
    analyzed.reduce((sum, c) => sum + (c.signals?.questionHeadings.length ?? 0), 0) /
    analyzed.length;
  const questionRatio =
    compQuestionAvg === 0
      ? ourQuestions > 0
        ? 1
        : 0.5
      : Math.max(0, Math.min(1, ourQuestions / Math.max(1, compQuestionAvg)));
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'competitive.answer-readiness',
      title: 'Answer-ready structure versus competitors',
      status:
        ourQuestions >= compQuestionAvg
          ? Status.PASS
          : ourQuestions > 0
            ? Status.WARN
            : Status.FAIL,
      ratio: questionRatio,
      maxPoints: 6,
      evidence: {
        yourQuestionHeadings: ourQuestions,
        competitorQuestionHeadings: analyzed.map((c) => ({
          url: c.url,
          count: c.signals?.questionHeadings.length ?? 0,
        })),
        competitorFaqSignals: analyzed.filter((c) => c.signals?.hasFaqSignals).length,
      },
      explanation:
        'Competitors with more question-shaped headings have more surfaces that map directly onto the questions people ask an answer engine.',
      recommendedAction:
        ourQuestions >= compQuestionAvg
          ? 'No action needed.'
          : 'Add question-led sections covering the topics your competitors already answer.',
      effort: Effort.MEDIUM,
      impact: Impact.MEDIUM,
    }),
  );

  return checks;
}

/**
 * Homepage-only comparable score, 0-100.
 *
 * Deliberately simple and fully deterministic: competitor sites are not crawled
 * in depth, so this measures only what a single homepage fetch reveals.
 */
export function competitorQuickScore(signals: {
  isHttps: boolean;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  h1: string[];
  wordCount: number;
  schemaTypes: string[];
  questionHeadings: string[];
  hasFaqSignals: boolean;
  emails: string[];
  phones: string[];
  addressSignals: string[];
  authors: string[];
  listCount: number;
  langAttr: string | null;
  viewport: string | null;
  openGraph: Record<string, string>;
}): number {
  let points = 0;
  const max = 100;

  // Technical basics — 20
  if (signals.isHttps) points += 8;
  if (signals.canonical) points += 4;
  if (signals.langAttr) points += 4;
  if (signals.viewport) points += 4;

  // Entity clarity — 22
  if (signals.title && signals.title.length >= 25) points += 8;
  else if (signals.title) points += 4;
  if (signals.metaDescription && signals.metaDescription.length >= 50) points += 7;
  else if (signals.metaDescription) points += 3;
  if (signals.h1.length === 1) points += 7;
  else if (signals.h1.length > 1) points += 3;

  // Content depth — 18
  if (signals.wordCount >= 800) points += 18;
  else if (signals.wordCount >= 500) points += 14;
  else if (signals.wordCount >= 300) points += 9;
  else if (signals.wordCount >= 150) points += 4;

  // Structured data — 20
  const orgSchema = signals.schemaTypes.some((t) =>
    ['Organization', 'LocalBusiness', 'Corporation'].includes(t),
  );
  if (orgSchema) points += 10;
  if (signals.schemaTypes.length >= 3) points += 6;
  else if (signals.schemaTypes.length >= 1) points += 3;
  if (signals.schemaTypes.includes('FAQPage')) points += 4;

  // Answer readiness — 12
  if (signals.questionHeadings.length >= 3) points += 7;
  else if (signals.questionHeadings.length >= 1) points += 4;
  if (signals.hasFaqSignals) points += 3;
  if (signals.listCount >= 2) points += 2;

  // Trust — 8
  if (signals.phones.length > 0 || signals.emails.length > 0) points += 4;
  if (signals.addressSignals.length > 0) points += 2;
  if (signals.authors.length > 0) points += 2;

  // Social metadata bonus is folded into the cap above.
  if (Object.keys(signals.openGraph).length >= 3) points = Math.min(max, points + 2);

  return Math.max(0, Math.min(max, points));
}
