import { AuditCategory } from '@prisma/client';

import { safeFetch } from '@/lib/audit/fetcher';
import { analyzeHtml } from '@/lib/audit/parse';
import { validateAuditUrl } from '@/lib/audit/url-safety';
import { competitorQuickScore } from '@/lib/audit/checks';
import type { CompetitorSnapshot } from '@/lib/audit/types';

/**
 * Competitor analysis is deliberately homepage-only.
 *
 * Crawling a competitor's whole site would be a far more intrusive act than a
 * customer has authorized, so we fetch one public page and compare like for
 * like against the audited site's homepage.
 */
export async function analyzeCompetitors(
  urls: string[],
  limit: number,
): Promise<CompetitorSnapshot[]> {
  const snapshots: CompetitorSnapshot[] = [];

  for (const raw of urls.slice(0, limit)) {
    const validated = validateAuditUrl(raw);
    if (!validated.ok) {
      snapshots.push({
        url: raw,
        name: null,
        ok: false,
        error: validated.message,
        signals: null,
        quickScore: null,
        categoryScores: null,
        highlights: [],
        gaps: [],
      });
      continue;
    }

    const result = await safeFetch(validated.normalized);
    if (!result.ok) {
      snapshots.push({
        url: validated.normalized,
        name: null,
        ok: false,
        error: result.message,
        signals: null,
        quickScore: null,
        categoryScores: null,
        highlights: [],
        gaps: [],
      });
      continue;
    }

    const signals = analyzeHtml({
      url: validated.normalized,
      finalUrl: result.finalUrl,
      html: result.body,
      statusCode: result.statusCode,
      contentType: result.contentType,
      bytes: result.bytes,
      fetchMs: result.durationMs,
      isHttps: result.isHttps,
      redirectChain: result.redirectChain,
      siteOrigin: validated.url.origin,
    });

    const quickScore = competitorQuickScore(signals);

    snapshots.push({
      url: validated.normalized,
      name: deriveCompetitorName(signals.title, validated.domain),
      ok: true,
      error: null,
      signals,
      quickScore,
      categoryScores: competitorCategoryScores(signals),
      highlights: buildHighlights(signals),
      gaps: buildGaps(signals),
    });
  }

  return snapshots;
}

function deriveCompetitorName(title: string | null, domain: string): string {
  if (!title) return domain;
  // Titles are usually "Topic | Brand" or "Brand — Topic".
  const parts = title.split(/[|—–\-·]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return domain;
  const last = parts[parts.length - 1] ?? '';
  const first = parts[0] ?? '';
  const candidate = last.length <= 40 && last.length >= 3 ? last : first;
  return candidate.slice(0, 60) || domain;
}

/** Per-category comparable scores derived from homepage-only signals. */
function competitorCategoryScores(
  signals: ReturnType<typeof analyzeHtml>,
): Partial<Record<AuditCategory, number>> {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  const technical =
    (signals.isHttps ? 35 : 0) +
    (signals.canonical ? 20 : 0) +
    (signals.langAttr ? 15 : 0) +
    (signals.viewport ? 15 : 0) +
    (signals.isIndexable ? 15 : 0);

  const entity =
    (signals.title ? (signals.titleLength >= 25 ? 30 : 15) : 0) +
    (signals.metaDescription ? (signals.metaDescriptionLength >= 50 ? 25 : 12) : 0) +
    (signals.h1.length === 1 ? 25 : signals.h1.length > 1 ? 12 : 0) +
    (Object.keys(signals.openGraph).length >= 3 ? 20 : 0);

  const content =
    (signals.wordCount >= 800 ? 45 : signals.wordCount >= 500 ? 35 : signals.wordCount >= 300 ? 22 : 8) +
    (signals.paragraphCount >= 6 ? 25 : signals.paragraphCount >= 3 ? 15 : 5) +
    (signals.factualDataPoints >= 3 ? 20 : signals.factualDataPoints >= 1 ? 10 : 0) +
    (signals.vaguePhrases.length === 0 ? 10 : 0);

  const answer =
    (signals.questionHeadings.length >= 3 ? 35 : signals.questionHeadings.length >= 1 ? 20 : 0) +
    (signals.hasFaqSignals ? 25 : 0) +
    (signals.listCount >= 2 ? 20 : signals.listCount >= 1 ? 10 : 0) +
    (signals.tableCount >= 1 ? 10 : 0) +
    (signals.headings.length >= 5 ? 10 : 0);

  const structured =
    (signals.schemaTypes.some((t) => ['Organization', 'LocalBusiness', 'Corporation'].includes(t)) ? 40 : 0) +
    (signals.schemaTypes.length >= 3 ? 25 : signals.schemaTypes.length >= 1 ? 12 : 0) +
    (signals.schemaTypes.includes('FAQPage') ? 20 : 0) +
    (signals.jsonLd.every((b) => b.valid) && signals.jsonLd.length > 0 ? 15 : 0);

  const trust =
    (signals.phones.length > 0 ? 25 : 0) +
    (signals.emails.length > 0 ? 20 : 0) +
    (signals.addressSignals.length > 0 ? 25 : 0) +
    (signals.authors.length > 0 ? 15 : 0) +
    (signals.outboundCitationLinks > 0 ? 15 : 0);

  return {
    [AuditCategory.TECHNICAL_ACCESSIBILITY]: clamp(technical),
    [AuditCategory.ENTITY_CLARITY]: clamp(entity),
    [AuditCategory.CONTENT_AUTHORITY]: clamp(content),
    [AuditCategory.ANSWER_READINESS]: clamp(answer),
    [AuditCategory.STRUCTURED_DATA]: clamp(structured),
    [AuditCategory.TRUST_AND_EVIDENCE]: clamp(trust),
  };
}

function buildHighlights(signals: ReturnType<typeof analyzeHtml>): string[] {
  const highlights: string[] = [];
  if (signals.schemaTypes.length >= 3) {
    highlights.push(`Declares ${signals.schemaTypes.length} schema types: ${signals.schemaTypes.slice(0, 5).join(', ')}`);
  }
  if (signals.wordCount >= 600) {
    highlights.push(`Substantial homepage copy (${signals.wordCount} words)`);
  }
  if (signals.questionHeadings.length >= 3) {
    highlights.push(`${signals.questionHeadings.length} question-led headings on the homepage`);
  }
  if (signals.hasFaqSignals) highlights.push('FAQ content present on the homepage');
  if (signals.addressSignals.length > 0 && signals.phones.length > 0) {
    highlights.push('Full contact details published on the homepage');
  }
  if (signals.factualDataPoints >= 3) {
    highlights.push(`${signals.factualDataPoints} concrete facts and figures in the copy`);
  }
  return highlights.slice(0, 5);
}

function buildGaps(signals: ReturnType<typeof analyzeHtml>): string[] {
  const gaps: string[] = [];
  if (signals.schemaTypes.length === 0) gaps.push('No structured data on the homepage');
  if (signals.wordCount < 300) gaps.push(`Thin homepage copy (${signals.wordCount} words)`);
  if (signals.questionHeadings.length === 0) gaps.push('No question-led headings');
  if (!signals.metaDescription) gaps.push('No meta description');
  if (signals.phones.length === 0 && signals.emails.length === 0) {
    gaps.push('No contact details on the homepage');
  }
  if (signals.vaguePhrases.length > 2) {
    gaps.push(`Heavy marketing filler (${signals.vaguePhrases.length} vague phrases)`);
  }
  return gaps.slice(0, 5);
}
