import type {
  AuditCategory,
  EffortLevel,
  EvidenceSource,
  FindingStatus,
  ImpactLevel,
  Severity,
} from '@prisma/client';

import type { PageSignals } from '@/lib/audit/parse';
import type { RobotsTxt } from '@/lib/audit/robots';

/**
 * Result of one deterministic audit check.
 *
 * `points` / `maxPoints` feed category scoring; `applicable: false` removes the
 * check from both numerator and denominator so a site is never penalized for
 * something that cannot apply to it.
 */
export interface CheckResult {
  checkId: string;
  category: AuditCategory;
  title: string;
  status: FindingStatus;
  severity: Severity;
  evidence: Record<string, unknown>;
  explanation: string;
  recommendedAction: string;
  effort: EffortLevel;
  impact: ImpactLevel;
  pageUrl?: string | null;
  source: EvidenceSource;
  points: number;
  maxPoints: number;
  applicable: boolean;
}

export interface SitemapInfo {
  found: boolean;
  url: string | null;
  urlCount: number;
  isIndex: boolean;
  error: string | null;
}

export interface LlmsTxtInfo {
  found: boolean;
  url: string | null;
  bytes: number;
  mentionsSections: boolean;
}

export interface CompetitorSnapshot {
  url: string;
  name: string | null;
  ok: boolean;
  error: string | null;
  signals: PageSignals | null;
  /** Quick comparable score computed from homepage-only signals. */
  quickScore: number | null;
  categoryScores: Partial<Record<AuditCategory, number>> | null;
  highlights: string[];
  gaps: string[];
}

export interface SearchObservation {
  query: string;
  resultCount: number;
  brandAppears: boolean;
  topDomains: string[];
  note: string;
}

/**
 * Everything the check modules read. Assembled once by the crawler so checks
 * stay pure functions of observed evidence.
 */
export interface AuditContext {
  auditId: string;
  siteOrigin: string;
  requestedUrl: string;
  businessName: string;
  industry: string | null;
  targetCountry: string;
  targetAudience: string | null;
  primaryServices: string | null;
  businessLocation: string | null;

  homepage: PageSignals | null;
  pages: PageSignals[];
  failedPages: Array<{ url: string; code: string; message: string }>;

  robots: RobotsTxt;
  sitemap: SitemapInfo;
  llmsTxt: LlmsTxtInfo;

  competitors: CompetitorSnapshot[];
  competitorsRequested: number;

  searchObservations: SearchObservation[];
  searchEnabled: boolean;

  pageLimit: number;
  brokenInternalLinks: Array<{ from: string; to: string; status: number | null }>;
}

export interface CategoryScore {
  category: AuditCategory;
  score: number;
  available: boolean;
  baseWeight: number;
  effectiveWeight: number;
  rawPoints: number;
  maxPoints: number;
  summary: string;
}

export interface ScoredAudit {
  overallScore: number;
  categories: CategoryScore[];
  checks: CheckResult[];
}

/** Ordering used everywhere findings are listed. */
export const SEVERITY_ORDER: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFORMATIONAL: 4,
  PASSED: 5,
};

export const CATEGORY_LABELS: Record<AuditCategory, string> = {
  TECHNICAL_ACCESSIBILITY: 'Technical Accessibility',
  ENTITY_CLARITY: 'Entity Clarity',
  CONTENT_AUTHORITY: 'Content Authority',
  ANSWER_READINESS: 'Answer Readiness',
  STRUCTURED_DATA: 'Structured Data',
  TRUST_AND_EVIDENCE: 'Trust and Evidence',
  COMPETITIVE_VISIBILITY: 'Competitive Visibility',
};

export const CATEGORY_DESCRIPTIONS: Record<AuditCategory, string> = {
  TECHNICAL_ACCESSIBILITY:
    'Whether AI crawlers and answer engines can reach, load and index your pages at all.',
  ENTITY_CLARITY:
    'How unambiguously your site states who the business is, what it does and who it serves.',
  CONTENT_AUTHORITY:
    'Depth, originality and expertise signals in the content a model would draw on.',
  ANSWER_READINESS:
    'How easily individual passages can be extracted as direct answers to real questions.',
  STRUCTURED_DATA:
    'Machine-readable schema markup describing your organization, content and offerings.',
  TRUST_AND_EVIDENCE:
    'Authorship, contact details, citations and proof that support what the site claims.',
  COMPETITIVE_VISIBILITY:
    'How your observable signals compare with the competitors you supplied.',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  PASSED: 'Passed',
  INFORMATIONAL: 'Informational',
};
