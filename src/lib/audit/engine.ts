import {
  AuditStatus,
  CompetitorStatus,
  EvidenceSource,
  Prisma,
  type Audit,
} from '@prisma/client';

import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { crawlSite } from '@/lib/audit/crawler';
import { analyzeCompetitors } from '@/lib/audit/competitors';
import { runAllChecks } from '@/lib/audit/checks';
import { aggregateScores } from '@/lib/audit/scoring';
import {
  deriveStrengths,
  deriveWeaknesses,
  generateRecommendations,
} from '@/lib/audit/recommendations';
import { buildDeterministicSummary, enhanceWithLlm } from '@/lib/audit/llm';
import { collectSearchObservations } from '@/lib/audit/search';
import { registrableDomain } from '@/lib/audit/url-safety';
import { CATEGORY_LABELS, type AuditContext } from '@/lib/audit/types';

/**
 * End-to-end audit execution.
 *
 * Called by the worker, never directly from a request handler — a full crawl
 * far exceeds any sane HTTP timeout.
 */

export interface RunAuditResult {
  ok: boolean;
  overallScore: number | null;
  pagesCrawled: number;
  findingCount: number;
  recommendationCount: number;
  failureCode: string | null;
  failureMessage: string | null;
  /** True when the failure happened before any useful work — credit is refundable. */
  refundable: boolean;
}

export type ProgressReporter = (progress: number, message: string, step?: string) => Promise<void>;

export async function runAudit(
  audit: Audit & { competitors: Array<{ id: string; url: string }> },
  reportProgress: ProgressReporter,
): Promise<RunAuditResult> {
  const env = getEnv();

  await reportProgress(4, 'Preparing the audit', 'prepare');

  // --- Crawl ---------------------------------------------------------------
  const crawl = await crawlSite(audit.websiteUrl, {
    pageLimit: audit.pageLimit,
    onProgress: async (progress, message) => {
      await reportProgress(progress, message, 'crawl');
    },
  });

  if (crawl.fatalError) {
    return {
      ok: false,
      overallScore: null,
      pagesCrawled: 0,
      findingCount: 0,
      recommendationCount: 0,
      failureCode: crawl.fatalError.code,
      failureMessage: crawl.fatalError.message,
      // Nothing was analyzed, so the audit credit should go back.
      refundable: true,
    };
  }

  // --- Competitors ---------------------------------------------------------
  await reportProgress(62, 'Comparing competitor signals', 'competitors');
  const competitorUrls = audit.competitors.map((c) => c.url);
  const competitorSnapshots =
    competitorUrls.length > 0
      ? await analyzeCompetitors(competitorUrls, audit.competitorLimit)
      : [];

  // --- Optional public-web search observations ------------------------------
  await reportProgress(68, 'Checking public-web signals', 'search');
  const search = await collectSearchObservations({
    businessName: audit.businessName,
    domain: registrableDomain(new URL(crawl.siteOrigin).hostname),
    primaryServices: audit.primaryServices,
    businessLocation: audit.businessLocation,
  });

  // --- Deterministic scoring -------------------------------------------------
  await reportProgress(72, 'Scoring AI visibility categories', 'score');

  const context: AuditContext = {
    auditId: audit.id,
    siteOrigin: crawl.siteOrigin,
    requestedUrl: audit.websiteUrl,
    businessName: audit.businessName,
    industry: audit.industry,
    targetCountry: audit.targetCountry,
    targetAudience: audit.targetAudience,
    primaryServices: audit.primaryServices,
    businessLocation: audit.businessLocation,
    homepage: crawl.homepage,
    pages: crawl.pages,
    failedPages: crawl.failedPages,
    robots: crawl.robots,
    sitemap: crawl.sitemap,
    llmsTxt: crawl.llmsTxt,
    competitors: competitorSnapshots,
    competitorsRequested: competitorUrls.length,
    searchObservations: search.observations,
    searchEnabled: search.provider != null,
    pageLimit: audit.pageLimit,
    brokenInternalLinks: crawl.brokenInternalLinks,
  };

  const checks = runAllChecks(context);
  const scored = aggregateScores(checks);
  const recommendations = generateRecommendations(checks);
  const strengths = deriveStrengths(checks);
  const weaknesses = deriveWeaknesses(checks);

  // --- Optional LLM narrative -------------------------------------------------
  await reportProgress(82, 'Writing recommendations', 'narrative');

  const criticalCount = checks.filter((c) => c.severity === 'CRITICAL').length;
  const highCount = checks.filter((c) => c.severity === 'HIGH').length;

  let executiveSummary = buildDeterministicSummary({
    businessName: audit.businessName,
    websiteUrl: audit.websiteUrl,
    overallScore: scored.overallScore,
    categories: scored.categories,
    strengths,
    weaknesses,
    pagesCrawled: crawl.pages.length,
    criticalCount,
    highCount,
  });

  let llmModel: string | null = null;
  let llmGeneratedAt: Date | null = null;
  const categoryNarratives = new Map<string, string>();
  const recommendationNarratives = new Map<string, string>();

  if (env.llmEnabled) {
    const enhancement = await enhanceWithLlm({
      businessName: audit.businessName,
      websiteUrl: audit.websiteUrl,
      industry: audit.industry,
      overallScore: scored.overallScore,
      categories: scored.categories,
      topFailures: checks
        .filter((c) => c.applicable && (c.status === 'FAIL' || c.status === 'WARN'))
        .slice(0, 15),
      topPasses: checks.filter((c) => c.status === 'PASS').slice(0, 8),
      pagesCrawled: crawl.pages.length,
    });

    if (enhancement.ok && enhancement.enhancement) {
      executiveSummary = enhancement.enhancement.executiveSummary;
      llmModel = enhancement.model;
      llmGeneratedAt = enhancement.generatedAt;
      for (const item of enhancement.enhancement.categoryNarratives) {
        categoryNarratives.set(item.category, item.narrative);
      }
      for (const item of enhancement.enhancement.recommendationNarratives) {
        recommendationNarratives.set(item.checkId, item.whyItMatters);
      }
    }
  }

  // --- Persist -----------------------------------------------------------------
  await reportProgress(90, 'Saving audit results', 'persist');

  const previousScore = await prisma.audit.findFirst({
    where: {
      userId: audit.userId,
      normalizedDomain: audit.normalizedDomain,
      status: AuditStatus.COMPLETED,
      id: { not: audit.id },
      deletedAt: null,
    },
    orderBy: { completedAt: 'desc' },
    select: { overallScore: true },
  });

  await prisma.$transaction(async (tx) => {
    // Clear any prior results so a re-run is idempotent.
    await tx.auditPage.deleteMany({ where: { auditId: audit.id } });
    await tx.auditFinding.deleteMany({ where: { auditId: audit.id } });
    await tx.auditRecommendation.deleteMany({ where: { auditId: audit.id } });
    await tx.auditScore.deleteMany({ where: { auditId: audit.id } });

    if (crawl.pages.length > 0) {
      await tx.auditPage.createMany({
        data: crawl.pages.map((page, index) => ({
          auditId: audit.id,
          url: page.url,
          finalUrl: page.finalUrl,
          role: page.role,
          depth: index === 0 ? 0 : 1,
          statusCode: page.statusCode,
          redirectChain: page.redirectChain as unknown as Prisma.InputJsonValue,
          contentType: page.contentType,
          title: page.title,
          metaDescription: page.metaDescription,
          canonical: page.canonical,
          robotsMeta: page.robotsMeta,
          langAttr: page.langAttr,
          viewport: page.viewport,
          h1: page.h1 as unknown as Prisma.InputJsonValue,
          headings: page.headings.slice(0, 60) as unknown as Prisma.InputJsonValue,
          wordCount: page.wordCount,
          imageCount: page.imageCount,
          imagesWithAlt: page.imagesWithAlt,
          internalLinks: page.internalLinks,
          externalLinks: page.externalLinks,
          schemaTypes: page.schemaTypes as unknown as Prisma.InputJsonValue,
          jsonLdSummary: page.jsonLd.map((b) => ({
            types: b.types,
            valid: b.valid,
            parseError: b.parseError,
            properties: b.properties.slice(0, 40),
          })) as unknown as Prisma.InputJsonValue,
          openGraph: page.openGraph as unknown as Prisma.InputJsonValue,
          twitterCard: page.twitterCard as unknown as Prisma.InputJsonValue,
          hasFaqSignals: page.hasFaqSignals,
          hasQuestionHeadings: page.questionHeadings.length > 0,
          listCount: page.listCount,
          tableCount: page.tableCount,
          publishedDate: page.publishedDate,
          modifiedDate: page.modifiedDate,
          authors: page.authors as unknown as Prisma.InputJsonValue,
          isHttps: page.isHttps,
          fetchMs: page.fetchMs,
          bytes: page.bytes,
        })),
        skipDuplicates: true,
      });
    }

    // Record pages that could not be fetched so the report can explain them.
    if (crawl.failedPages.length > 0) {
      await tx.auditPage.createMany({
        data: crawl.failedPages.slice(0, 20).map((failure) => ({
          auditId: audit.id,
          url: failure.url,
          statusCode: null,
          error: `${failure.code}: ${failure.message}`.slice(0, 400),
          blockedByRobots: failure.code === 'ROBOTS_DISALLOWED',
        })),
        skipDuplicates: true,
      });
    }

    await tx.auditFinding.createMany({
      data: checks.map((check, index) => ({
        auditId: audit.id,
        category: check.category,
        checkId: check.checkId,
        title: check.title,
        status: check.status,
        severity: check.severity,
        evidence: check.evidence as unknown as Prisma.InputJsonValue,
        explanation: check.explanation,
        recommendedAction: check.recommendedAction,
        effort: check.effort,
        impact: check.impact,
        pageUrl: check.pageUrl,
        source: check.source,
        pointsAwarded: check.points,
        pointsPossible: check.maxPoints,
        sortOrder: index,
      })),
      skipDuplicates: true,
    });

    await tx.auditRecommendation.createMany({
      data: recommendations.map((rec) => {
        const enhanced = rec.relatedCheckIds
          .map((id) => recommendationNarratives.get(id))
          .find(Boolean);
        return {
          auditId: audit.id,
          horizon: rec.horizon,
          priority: rec.priority,
          category: rec.category,
          title: rec.title,
          whyItMatters: enhanced ?? rec.whyItMatters,
          recommendedChange: rec.recommendedChange,
          exampleImplementation: rec.exampleImplementation,
          expectedImpact: rec.expectedImpact,
          impact: rec.impact,
          effort: rec.effort,
          relatedCheckIds: rec.relatedCheckIds as unknown as Prisma.InputJsonValue,
          source: enhanced ? EvidenceSource.AI_ENHANCED : EvidenceSource.OBSERVED,
        };
      }),
    });

    await tx.auditScore.createMany({
      data: scored.categories.map((category) => ({
        auditId: audit.id,
        category: category.category,
        score: category.score,
        available: category.available,
        baseWeight: category.baseWeight,
        effectiveWeight: category.effectiveWeight,
        rawPoints: category.rawPoints,
        maxPoints: category.maxPoints,
        summary:
          categoryNarratives.get(CATEGORY_LABELS[category.category]) ?? category.summary,
      })),
    });

    // Competitor rows were created up front; fill in the analysis.
    for (const snapshot of competitorSnapshots) {
      const existing = audit.competitors.find(
        (c) => normalizeCompetitorUrl(c.url) === normalizeCompetitorUrl(snapshot.url),
      );
      if (!existing) continue;
      await tx.auditCompetitor.update({
        where: { id: existing.id },
        data: {
          name: snapshot.name,
          status: snapshot.ok ? CompetitorStatus.ANALYZED : CompetitorStatus.FAILED,
          overallScore: snapshot.quickScore == null ? null : Math.round(snapshot.quickScore),
          categoryScores: (snapshot.categoryScores ?? {}) as unknown as Prisma.InputJsonValue,
          highlights: snapshot.highlights as unknown as Prisma.InputJsonValue,
          gaps: snapshot.gaps as unknown as Prisma.InputJsonValue,
          error: snapshot.error,
        },
      });
    }

    await tx.audit.update({
      where: { id: audit.id },
      data: {
        status: AuditStatus.COMPLETED,
        overallScore: scored.overallScore,
        previousScore: previousScore?.overallScore ?? null,
        executiveSummary,
        strengths: strengths as unknown as Prisma.InputJsonValue,
        weaknesses: weaknesses as unknown as Prisma.InputJsonValue,
        llmEnhanced: llmModel != null,
        llmModel,
        llmGeneratedAt,
        searchObserved: search.observations.length > 0,
        searchProvider: search.provider,
        searchFindings: search.observations as unknown as Prisma.InputJsonValue,
        robotsSummary: {
          found: crawl.robots.found,
          blocksEverything: crawl.robots.blocksEverything,
          blockedAiAgents: crawl.robots.blockedAiAgents,
          sitemaps: crawl.robots.sitemaps.slice(0, 5),
          sitemapFound: crawl.sitemap.found,
          sitemapUrlCount: crawl.sitemap.urlCount,
          llmsTxtFound: crawl.llmsTxt.found,
        } as unknown as Prisma.InputJsonValue,
        failureMessage: null,
        failureCode: null,
        completedAt: new Date(),
      },
    });
  });

  await reportProgress(100, 'Audit complete', 'done');

  return {
    ok: true,
    overallScore: scored.overallScore,
    pagesCrawled: crawl.pages.length,
    findingCount: checks.length,
    recommendationCount: recommendations.length,
    failureCode: null,
    failureMessage: null,
    refundable: false,
  };
}

function normalizeCompetitorUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
