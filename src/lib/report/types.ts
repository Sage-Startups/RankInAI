import type {
  AuditCategory,
  EffortLevel,
  EvidenceSource,
  FindingStatus,
  ImpactLevel,
  RecommendationHorizon,
  Severity,
} from '@prisma/client';

/**
 * Normalized report shape.
 *
 * Both the fictional sample report and a real completed audit are projected
 * into this shape, so the HTML renderer and the PDF generator have exactly one
 * input contract to satisfy.
 */

export interface ReportCategory {
  category: AuditCategory;
  label: string;
  description: string;
  score: number;
  available: boolean;
  baseWeight: number;
  effectiveWeight: number;
  summary: string;
}

export interface ReportFinding {
  id: string;
  category: AuditCategory;
  categoryLabel: string;
  checkId: string;
  title: string;
  status: FindingStatus;
  severity: Severity;
  evidence: Record<string, unknown>;
  explanation: string;
  recommendedAction: string;
  effort: EffortLevel;
  impact: ImpactLevel;
  pageUrl: string | null;
  source: EvidenceSource;
}

export interface ReportRecommendation {
  id: string;
  horizon: RecommendationHorizon;
  priority: number;
  category: AuditCategory;
  categoryLabel: string;
  title: string;
  whyItMatters: string;
  recommendedChange: string;
  exampleImplementation: string | null;
  expectedImpact: string;
  impact: ImpactLevel;
  effort: EffortLevel;
  source: EvidenceSource;
}

export interface ReportPage {
  url: string;
  role: string;
  title: string | null;
  statusCode: number | null;
  wordCount: number;
  schemaTypes: string[];
  questionHeadings: number;
  note: string | null;
  error: string | null;
}

export interface ReportCompetitor {
  url: string;
  name: string | null;
  status: string;
  overallScore: number | null;
  categoryScores: Record<string, number> | null;
  highlights: string[];
  gaps: string[];
  error: string | null;
}

export interface ReportSearchObservation {
  query: string;
  resultCount: number;
  brandAppears: boolean;
  topDomains: string[];
  note: string;
}

export interface ReportData {
  /** Identifies whether this is a real audit or the fictional sample. */
  isDemo: boolean;
  auditId: string;

  businessName: string;
  websiteUrl: string;
  displayDomain: string;
  industry: string | null;
  location: string | null;
  targetCountry: string;
  targetAudience: string | null;
  primaryServices: string | null;

  auditDate: Date;
  pagesCrawled: number;
  pageLimit: number;

  overallScore: number;
  previousScore: number | null;
  executiveSummary: string;
  strengths: string[];
  weaknesses: string[];

  categories: ReportCategory[];
  findings: ReportFinding[];
  recommendations: ReportRecommendation[];
  pages: ReportPage[];
  competitors: ReportCompetitor[];
  searchObservations: ReportSearchObservation[];
  searchProvider: string | null;

  llmEnhanced: boolean;
  llmModel: string | null;
  llmGeneratedAt: Date | null;

  robotsSummary: {
    found: boolean;
    blocksEverything: boolean;
    blockedAiAgents: string[];
    sitemapFound: boolean;
    sitemapUrlCount: number;
    llmsTxtFound: boolean;
  } | null;

  branding: {
    whiteLabel: boolean;
    companyName: string | null;
    logoUrl: string | null;
  };
}

export const REPORT_LIMITATIONS = [
  'RankInAI measures signals that are publicly visible on your website at the time of the audit. It cannot see inside any AI system’s training data, retrieval index or ranking logic.',
  'No tool — including this one — can guarantee that ChatGPT, Perplexity, Gemini, Copilot or any other assistant will mention, cite or recommend a business.',
  'Scores describe AI visibility readiness: how well the site is set up to be discovered, understood, retrieved and attributed. They are not a prediction of traffic, referrals or revenue.',
  'The crawl is bounded by your plan and by what is publicly reachable. Content behind a login, a paywall, a form, or rendered only by client-side JavaScript after user interaction is not analyzed.',
  'Competitor analysis is based on a single public homepage fetch per competitor, not a full crawl. It compares homepage-level signals only.',
  'Public-web search observations, when present, describe publicly visible search results at the time of the audit. They are not evidence of behavior inside any particular AI product.',
  'Content and websites change. Re-run the audit after making changes to see the effect.',
];

export const METHODOLOGY_SUMMARY = [
  {
    heading: 'Evidence collection',
    body: 'A crawler identifying itself as RankInAI-Auditor fetches robots.txt, the XML sitemap and llms.txt, then requests up to your plan’s page limit of public HTML pages. It honors robots.txt rules for its own agent, follows a bounded number of redirects, enforces a response size cap and a request timeout, and never submits forms, signs in or executes downloaded files.',
  },
  {
    heading: 'Deterministic checks',
    body: 'Roughly seventy checks run against the collected evidence. Each awards a fraction of its available points based on what was observed, and records the specific values it saw. Checks that cannot apply to a site are excluded from both the numerator and the denominator of its category score.',
  },
  {
    heading: 'Category scoring',
    body: 'Each category score is round(100 × points awarded / points possible) across its applicable checks. Because the checks are pure functions of the collected evidence, the same website content always produces the same scores.',
  },
  {
    heading: 'Overall score',
    body: 'The overall score is the weighted sum of the available category scores. Base weights are Technical Accessibility 15%, Entity Clarity 17%, Content Authority 18%, Answer Readiness 17%, Structured Data 13%, Trust and Evidence 15%, Competitive Visibility 5%. When a category is unavailable, its weight is redistributed proportionally across the rest.',
  },
  {
    heading: 'Prioritization',
    body: 'Every failing or partial check becomes a recommendation, ordered by severity, then expected impact, then effort, then category. Recommendations are grouped into Do first, Next 30 days and Longer-term improvements.',
  },
  {
    heading: 'Optional AI enhancement',
    body: 'When configured, a language model may rewrite summaries and explanations for clarity. It receives only already-computed scores and check outcomes, never raw page content, and can never change a score, a status or a recorded piece of evidence. Enhanced passages are labeled in the report.',
  },
];
