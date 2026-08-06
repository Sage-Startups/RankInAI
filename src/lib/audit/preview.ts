import { AuditCategory, Severity } from '@prisma/client';

import { safeFetch } from '@/lib/audit/fetcher';
import { analyzeHtml } from '@/lib/audit/parse';
import { validateAuditUrl } from '@/lib/audit/url-safety';
import { FREE_PREVIEW_MAX_FINDINGS } from '@/lib/plans';
import { CATEGORY_LABELS } from '@/lib/audit/types';

/**
 * Free live preview — homepage only, no account required.
 *
 * Deliberately limited: one page, a capped number of findings, and a preview
 * score that is explicitly *not* the full audit score. Everything the visitor
 * sees is derived from a single public fetch.
 */

export interface PreviewFinding {
  category: AuditCategory;
  categoryLabel: string;
  title: string;
  severity: Severity;
  detail: string;
  passed: boolean;
}

export interface PreviewSuccess {
  ok: true;
  url: string;
  finalUrl: string;
  domain: string;
  previewScore: number;
  title: string | null;
  findings: PreviewFinding[];
  checkedCount: number;
  totalIssuesFound: number;
  durationMs: number;
}

export interface PreviewFailure {
  ok: false;
  code: string;
  message: string;
  durationMs: number;
}

export type PreviewResult = PreviewSuccess | PreviewFailure;

interface PreviewCheck {
  category: AuditCategory;
  title: string;
  passed: boolean;
  weight: number;
  severity: Severity;
  detail: string;
}

export async function runFreePreview(rawUrl: string): Promise<PreviewResult> {
  const started = Date.now();

  const validated = validateAuditUrl(rawUrl);
  if (!validated.ok) {
    return {
      ok: false,
      code: validated.code,
      message: validated.message,
      durationMs: Date.now() - started,
    };
  }

  const result = await safeFetch(validated.normalized, { timeoutMs: 12_000, maxBytes: 2_000_000 });
  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
      durationMs: Date.now() - started,
    };
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

  const checks: PreviewCheck[] = [
    {
      category: AuditCategory.TECHNICAL_ACCESSIBILITY,
      title: 'Homepage is served over HTTPS',
      passed: signals.isHttps,
      weight: 10,
      severity: Severity.HIGH,
      detail: signals.isHttps
        ? 'The homepage loads over HTTPS.'
        : 'The homepage is served over plain HTTP, which many AI crawlers down-weight or skip.',
    },
    {
      category: AuditCategory.TECHNICAL_ACCESSIBILITY,
      title: 'Homepage is indexable',
      passed: signals.isIndexable,
      weight: 10,
      severity: Severity.CRITICAL,
      detail: signals.isIndexable
        ? 'No noindex directive was found on the homepage.'
        : `The homepage carries a noindex directive (${signals.robotsMeta}), telling crawlers to discard it.`,
    },
    {
      category: AuditCategory.ENTITY_CLARITY,
      title: 'Page title is descriptive',
      passed: signals.titleLength >= 25 && signals.titleLength <= 70,
      weight: 9,
      severity: Severity.MEDIUM,
      detail: signals.title
        ? `Title is ${signals.titleLength} characters: "${signals.title.slice(0, 90)}". Aim for 25-65 characters that name both the topic and the business.`
        : 'No title tag was found. This is the strongest short summary a crawler receives.',
    },
    {
      category: AuditCategory.ENTITY_CLARITY,
      title: 'Meta description is present and useful',
      passed: signals.metaDescriptionLength >= 50,
      weight: 8,
      severity: Severity.MEDIUM,
      detail:
        signals.metaDescriptionLength >= 50
          ? `A ${signals.metaDescriptionLength} character description is present.`
          : signals.metaDescription
            ? `The meta description is only ${signals.metaDescriptionLength} characters — too short to summarize the business.`
            : 'No meta description was found. AI systems often reuse it as a short abstract.',
    },
    {
      category: AuditCategory.ENTITY_CLARITY,
      title: 'Exactly one H1 heading',
      passed: signals.h1.length === 1,
      weight: 7,
      severity: Severity.MEDIUM,
      detail:
        signals.h1.length === 1
          ? `A single H1 was found: "${signals.h1[0]?.slice(0, 80)}".`
          : signals.h1.length === 0
            ? 'No H1 heading was found, so the page has no declared main topic.'
            : `${signals.h1.length} H1 headings were found. Multiple H1s make the page's main topic ambiguous.`,
    },
    {
      category: AuditCategory.STRUCTURED_DATA,
      title: 'Organization or LocalBusiness schema declared',
      passed: signals.schemaTypes.some((t) =>
        ['Organization', 'LocalBusiness', 'Corporation'].includes(t),
      ),
      weight: 12,
      severity: Severity.HIGH,
      detail: signals.schemaTypes.length
        ? `Schema types found: ${signals.schemaTypes.slice(0, 6).join(', ')}.`
        : 'No JSON-LD structured data was found on the homepage. This is the most direct way to tell a machine which organization the site belongs to.',
    },
    {
      category: AuditCategory.STRUCTURED_DATA,
      title: 'Structured data parses correctly',
      passed: signals.jsonLd.length > 0 && signals.jsonLd.every((b) => b.valid),
      weight: 6,
      severity: Severity.HIGH,
      detail:
        signals.jsonLd.length === 0
          ? 'There is no structured data to validate.'
          : signals.jsonLd.every((b) => b.valid)
            ? `All ${signals.jsonLd.length} JSON-LD blocks parsed successfully.`
            : 'At least one JSON-LD block failed to parse and is being silently discarded by every consumer.',
    },
    {
      category: AuditCategory.CONTENT_AUTHORITY,
      title: 'Homepage carries substantive copy',
      passed: signals.wordCount >= 350,
      weight: 11,
      severity: Severity.HIGH,
      detail: `The homepage contains about ${signals.wordCount} words of body text. Below roughly 350 words there is rarely enough for an AI system to summarize the business accurately.`,
    },
    {
      category: AuditCategory.ANSWER_READINESS,
      title: 'Question-led headings present',
      passed: signals.questionHeadings.length >= 2,
      weight: 9,
      severity: Severity.MEDIUM,
      detail:
        signals.questionHeadings.length > 0
          ? `${signals.questionHeadings.length} question-shaped headings were found, for example "${signals.questionHeadings[0]?.slice(0, 80)}".`
          : 'No question-shaped headings were found. Headings phrased as customer questions are the most reliable way to produce retrievable answer passages.',
    },
    {
      category: AuditCategory.ANSWER_READINESS,
      title: 'FAQ signals present',
      passed: signals.hasFaqSignals,
      weight: 6,
      severity: Severity.MEDIUM,
      detail: signals.hasFaqSignals
        ? 'FAQ-style content was detected on the homepage.'
        : 'No FAQ content was detected. FAQ sections map closely onto how answer engines retrieve content.',
    },
    {
      category: AuditCategory.TRUST_AND_EVIDENCE,
      title: 'Contact details are published',
      passed:
        signals.phones.length > 0 || signals.emails.length > 0 || signals.addressSignals.length > 0,
      weight: 8,
      severity: Severity.MEDIUM,
      detail:
        signals.phones.length > 0 || signals.emails.length > 0 || signals.addressSignals.length > 0
          ? 'Contact details were found on the homepage.'
          : 'No phone number, email address or postal address was found on the homepage — a core trust signal for a real operating business.',
    },
    {
      category: AuditCategory.ENTITY_CLARITY,
      title: 'Canonical URL declared',
      passed: signals.canonical != null,
      weight: 5,
      severity: Severity.LOW,
      detail: signals.canonical
        ? 'A canonical URL is declared.'
        : 'No canonical link was found, so duplicate URLs of this page may compete with each other.',
    },
  ];

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earned = checks.filter((c) => c.passed).reduce((sum, c) => sum + c.weight, 0);
  const previewScore = Math.round((earned / totalWeight) * 100);

  const failed = checks.filter((c) => !c.passed);
  const severityRank: Record<Severity, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
    INFORMATIONAL: 4,
    PASSED: 5,
  };

  const ordered = [...failed].sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity] || b.weight - a.weight,
  );

  // Show at most five findings; if the site is in good shape, fill with passes
  // so the visitor always sees something useful.
  const selected: PreviewCheck[] =
    ordered.length >= FREE_PREVIEW_MAX_FINDINGS
      ? ordered.slice(0, FREE_PREVIEW_MAX_FINDINGS)
      : [
          ...ordered,
          ...checks
            .filter((c) => c.passed)
            .sort((a, b) => b.weight - a.weight)
            .slice(0, FREE_PREVIEW_MAX_FINDINGS - ordered.length),
        ];

  return {
    ok: true,
    url: validated.normalized,
    finalUrl: result.finalUrl,
    domain: validated.domain,
    previewScore,
    title: signals.title,
    findings: selected.map((c) => ({
      category: c.category,
      categoryLabel: CATEGORY_LABELS[c.category],
      title: c.title,
      severity: c.passed ? Severity.PASSED : c.severity,
      detail: c.detail,
      passed: c.passed,
    })),
    checkedCount: checks.length,
    totalIssuesFound: failed.length,
    durationMs: Date.now() - started,
  };
}

export const PREVIEW_DISCLAIMER =
  'This free preview analyzes your homepage only and reports a limited number of findings. It is not the full paid audit, which crawls up to 50 pages, scores all seven categories, compares competitors and produces a prioritized action plan.';
