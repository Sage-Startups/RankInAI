import { AuditCategory } from '@prisma/client';

import { prisma } from '@/lib/db';
import { CATEGORY_DESCRIPTIONS, CATEGORY_LABELS } from '@/lib/audit/types';
import { CATEGORY_ORDER } from '@/lib/audit/scoring';
import { registrableDomain } from '@/lib/audit/url-safety';
import type { ReportData } from '@/lib/report/types';
import {
  DEMO_BUSINESS,
  DEMO_CATEGORY_SCORES,
  DEMO_COMPETITOR,
  DEMO_FINDINGS,
  DEMO_PAGES,
  DEMO_RECOMMENDATIONS,
  DEMO_STRENGTHS,
  DEMO_WEAKNESSES,
} from '@/lib/demo/sample-audit';

/**
 * Projection helpers that turn either a stored audit or the fictional sample
 * dataset into the single `ReportData` shape the renderers consume.
 */

export async function buildReportData(auditId: string): Promise<ReportData | null> {
  const audit = await prisma.audit.findFirst({
    where: { id: auditId, deletedAt: null },
    include: {
      scores: true,
      findings: { orderBy: { sortOrder: 'asc' } },
      recommendations: { orderBy: { priority: 'asc' } },
      pages: { orderBy: { createdAt: 'asc' } },
      competitors: true,
    },
  });

  if (!audit) return null;

  const scoreByCategory = new Map(audit.scores.map((s) => [s.category, s]));

  const categories = CATEGORY_ORDER.map((category) => {
    const stored = scoreByCategory.get(category);
    return {
      category,
      label: CATEGORY_LABELS[category],
      description: CATEGORY_DESCRIPTIONS[category],
      score: stored?.score ?? 0,
      available: stored?.available ?? false,
      baseWeight: stored?.baseWeight ?? 0,
      effectiveWeight: stored?.effectiveWeight ?? 0,
      summary: stored?.summary ?? 'Not measured for this audit.',
    };
  });

  return {
    isDemo: audit.isDemo,
    auditId: audit.id,
    businessName: audit.businessName,
    websiteUrl: audit.websiteUrl,
    displayDomain: audit.normalizedDomain,
    industry: audit.industry,
    location: audit.businessLocation,
    targetCountry: audit.targetCountry,
    targetAudience: audit.targetAudience,
    primaryServices: audit.primaryServices,

    auditDate: audit.completedAt ?? audit.createdAt,
    pagesCrawled: audit.pages.filter((p) => p.statusCode != null).length,
    pageLimit: audit.pageLimit,

    overallScore: audit.overallScore ?? 0,
    previousScore: audit.previousScore,
    executiveSummary: audit.executiveSummary ?? 'This audit has not produced a summary yet.',
    strengths: asStringArray(audit.strengths),
    weaknesses: asStringArray(audit.weaknesses),

    categories,

    findings: audit.findings.map((finding) => ({
      id: finding.id,
      category: finding.category,
      categoryLabel: CATEGORY_LABELS[finding.category],
      checkId: finding.checkId,
      title: finding.title,
      status: finding.status,
      severity: finding.severity,
      evidence: (finding.evidence ?? {}) as Record<string, unknown>,
      explanation: finding.explanation,
      recommendedAction: finding.recommendedAction,
      effort: finding.effort,
      impact: finding.impact,
      pageUrl: finding.pageUrl,
      source: finding.source,
    })),

    recommendations: audit.recommendations.map((rec) => ({
      id: rec.id,
      horizon: rec.horizon,
      priority: rec.priority,
      category: rec.category,
      categoryLabel: CATEGORY_LABELS[rec.category],
      title: rec.title,
      whyItMatters: rec.whyItMatters,
      recommendedChange: rec.recommendedChange,
      exampleImplementation: rec.exampleImplementation,
      expectedImpact: rec.expectedImpact,
      impact: rec.impact,
      effort: rec.effort,
      source: rec.source,
    })),

    pages: audit.pages.map((page) => ({
      url: page.finalUrl ?? page.url,
      role: page.role,
      title: page.title,
      statusCode: page.statusCode,
      wordCount: page.wordCount,
      schemaTypes: asStringArray(page.schemaTypes),
      questionHeadings: page.hasQuestionHeadings ? 1 : 0,
      note: page.blockedByRobots ? 'Skipped — disallowed by robots.txt for our crawler.' : null,
      error: page.error,
    })),

    competitors: audit.competitors.map((competitor) => ({
      url: competitor.url,
      name: competitor.name,
      status: competitor.status,
      overallScore: competitor.overallScore,
      categoryScores: (competitor.categoryScores ?? null) as Record<string, number> | null,
      highlights: asStringArray(competitor.highlights),
      gaps: asStringArray(competitor.gaps),
      error: competitor.error,
    })),

    searchObservations: asSearchObservations(audit.searchFindings),
    searchProvider: audit.searchProvider,

    llmEnhanced: audit.llmEnhanced,
    llmModel: audit.llmModel,
    llmGeneratedAt: audit.llmGeneratedAt,

    robotsSummary: asRobotsSummary(audit.robotsSummary),

    branding: {
      whiteLabel: audit.whiteLabel,
      companyName: audit.brandingName,
      logoUrl: audit.brandingLogoUrl,
    },
  };
}

/** The fictional Atlas Roofing sample, in the same shape as a real audit. */
export function buildSampleReportData(): ReportData {
  const categories = CATEGORY_ORDER.map((category) => {
    const demo = DEMO_CATEGORY_SCORES.find((c) => c.category === category);
    return {
      category,
      label: CATEGORY_LABELS[category],
      description: CATEGORY_DESCRIPTIONS[category],
      score: demo?.score ?? 0,
      available: demo != null,
      baseWeight: demo?.weight ?? 0,
      effectiveWeight: demo?.weight ?? 0,
      summary: demo?.summary ?? 'Not measured for this audit.',
    };
  });

  return {
    isDemo: true,
    auditId: 'demo-atlas-roofing',
    businessName: DEMO_BUSINESS.name,
    websiteUrl: DEMO_BUSINESS.websiteUrl,
    displayDomain: DEMO_BUSINESS.displayDomain,
    industry: DEMO_BUSINESS.industry,
    location: DEMO_BUSINESS.location,
    targetCountry: DEMO_BUSINESS.targetCountry,
    targetAudience: DEMO_BUSINESS.audience,
    primaryServices: DEMO_BUSINESS.services,

    // Fixed date so the sample never appears stale or ahead of itself.
    auditDate: new Date('2026-04-18T14:30:00Z'),
    pagesCrawled: DEMO_BUSINESS.pagesCrawled,
    pageLimit: 10,

    overallScore: DEMO_BUSINESS.overallScore,
    previousScore: 65,
    executiveSummary:
      'Atlas Roofing & Exteriors scores 72 out of 100 for AI visibility readiness, based on 10 pages crawled from www.atlasroofingexteriors.example. The site is technically sound and unusually strong on trust signals: complete contact details, a stated Colorado license number and a 2004 founding date all appear site-wide and match the LocalBusiness schema exactly. The limiting factor is structure rather than substance. Fourteen genuine question-and-answer pairs already exist across three pages but carry no FAQPage markup, so an answer engine has to infer them from headings. Service pages average 380 words with no pricing, process or outcome detail, and every page on the site is published anonymously. The three "Do first" actions below are all low or medium effort and address content that already exists — they make it machine-readable rather than requiring anything new to be written.',
    strengths: [...DEMO_STRENGTHS],
    weaknesses: [...DEMO_WEAKNESSES],

    categories,

    findings: DEMO_FINDINGS.map((finding, index) => ({
      id: `demo-finding-${index}`,
      category: finding.category,
      categoryLabel: finding.categoryLabel,
      checkId: finding.checkId,
      title: finding.title,
      status: finding.status,
      severity: finding.severity,
      evidence: finding.evidence,
      explanation: finding.explanation,
      recommendedAction: finding.recommendedAction,
      effort: finding.effort,
      impact: finding.impact,
      pageUrl: finding.pageUrl,
      source: finding.source,
    })),

    recommendations: DEMO_RECOMMENDATIONS.map((rec, index) => ({
      id: `demo-rec-${index}`,
      horizon: rec.horizon,
      priority: rec.priority,
      category: rec.category,
      categoryLabel: CATEGORY_LABELS[rec.category],
      title: rec.title,
      whyItMatters: rec.whyItMatters,
      recommendedChange: rec.recommendedChange,
      exampleImplementation: rec.exampleImplementation,
      expectedImpact: rec.expectedImpact,
      impact: rec.impact,
      effort: rec.effort,
      source: 'OBSERVED' as const,
    })),

    pages: DEMO_PAGES.map((page) => ({
      url: page.url,
      role: page.role,
      title: page.title,
      statusCode: page.statusCode,
      wordCount: page.wordCount,
      schemaTypes: page.schemaTypes,
      questionHeadings: page.questionHeadings,
      note: page.note,
      error: null,
    })),

    competitors: [
      {
        url: DEMO_COMPETITOR.url,
        name: DEMO_COMPETITOR.name,
        status: 'ANALYZED',
        overallScore: DEMO_COMPETITOR.overallScore,
        categoryScores: DEMO_COMPETITOR.categoryScores,
        highlights: [...DEMO_COMPETITOR.highlights],
        gaps: [...DEMO_COMPETITOR.gaps],
        error: null,
      },
    ],

    searchObservations: [],
    searchProvider: null,

    llmEnhanced: false,
    llmModel: null,
    llmGeneratedAt: null,

    robotsSummary: {
      found: true,
      blocksEverything: false,
      blockedAiAgents: [],
      sitemapFound: true,
      sitemapUrlCount: 24,
      llmsTxtFound: false,
    },

    branding: { whiteLabel: false, companyName: null, logoUrl: null },
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function asSearchObservations(value: unknown): ReportData['searchObservations'] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      query: String(item.query ?? ''),
      resultCount: Number(item.resultCount ?? 0),
      brandAppears: Boolean(item.brandAppears),
      topDomains: asStringArray(item.topDomains),
      note: String(item.note ?? ''),
    }))
    .filter((item) => item.query.length > 0);
}

function asRobotsSummary(value: unknown): ReportData['robotsSummary'] {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  return {
    found: Boolean(raw.found),
    blocksEverything: Boolean(raw.blocksEverything),
    blockedAiAgents: asStringArray(raw.blockedAiAgents),
    sitemapFound: Boolean(raw.sitemapFound),
    sitemapUrlCount: Number(raw.sitemapUrlCount ?? 0),
    llmsTxtFound: Boolean(raw.llmsTxtFound),
  };
}

export { registrableDomain, AuditCategory };
