import {
  AuditCategory,
  EffortLevel,
  EvidenceSource,
  ImpactLevel,
  RecommendationHorizon,
  Severity,
} from '@prisma/client';

import type { CheckResult } from '@/lib/audit/types';
import { CATEGORY_LABELS } from '@/lib/audit/types';

/**
 * Turn failing and partial checks into a prioritized, grouped action plan.
 *
 * Ordering is fully deterministic: severity, then impact, then effort (cheaper
 * wins first at equal impact), then category weight, then check id. Two audits
 * with identical findings always produce an identically ordered plan.
 */

export interface GeneratedRecommendation {
  horizon: RecommendationHorizon;
  priority: number;
  category: AuditCategory;
  title: string;
  whyItMatters: string;
  recommendedChange: string;
  exampleImplementation: string | null;
  expectedImpact: string;
  impact: ImpactLevel;
  effort: EffortLevel;
  relatedCheckIds: string[];
  source: EvidenceSource;
}

const SEVERITY_RANK: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFORMATIONAL: 4,
  PASSED: 5,
};

const IMPACT_RANK: Record<ImpactLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const EFFORT_RANK: Record<EffortLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

const CATEGORY_RANK: Record<AuditCategory, number> = {
  CONTENT_AUTHORITY: 0,
  ENTITY_CLARITY: 1,
  ANSWER_READINESS: 2,
  TECHNICAL_ACCESSIBILITY: 3,
  TRUST_AND_EVIDENCE: 4,
  STRUCTURED_DATA: 5,
  COMPETITIVE_VISIBILITY: 6,
};

/** Concrete example snippets keyed by check id. */
const EXAMPLES: Record<string, string> = {
  'tech.https':
    'Add a permanent redirect in your server configuration:\n\n  # nginx\n  server {\n    listen 80;\n    server_name example.com www.example.com;\n    return 301 https://example.com$request_uri;\n  }',
  'tech.robots-txt':
    'A workable robots.txt for most business sites:\n\n  User-agent: *\n  Allow: /\n  Disallow: /cart\n  Disallow: /checkout\n  Disallow: /my-account\n\n  Sitemap: https://example.com/sitemap.xml',
  'tech.ai-crawler-access':
    'To allow the major AI crawlers explicitly:\n\n  User-agent: GPTBot\n  Allow: /\n\n  User-agent: PerplexityBot\n  Allow: /\n\n  User-agent: ClaudeBot\n  Allow: /\n\n  User-agent: Google-Extended\n  Allow: /',
  'tech.sitemap':
    'Publish /sitemap.xml and reference it from robots.txt:\n\n  <?xml version="1.0" encoding="UTF-8"?>\n  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n    <url>\n      <loc>https://example.com/</loc>\n      <lastmod>2026-01-15</lastmod>\n    </url>\n  </urlset>',
  'tech.llms-txt':
    'A minimal /llms.txt:\n\n  # Atlas Roofing & Exteriors\n  > Residential and commercial roofing contractor serving the Denver metro area since 2004.\n\n  ## Key pages\n  - [Services](https://example.com/services): Roof replacement, repair and inspection\n  - [Service area](https://example.com/service-area): Cities and counties covered\n  - [FAQ](https://example.com/faq): Common questions about cost, timing and warranties',
  'tech.canonical':
    'Add a self-referencing canonical to every indexable page:\n\n  <link rel="canonical" href="https://example.com/services/roof-repair" />',
  'tech.viewport': '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
  'tech.lang': '  <html lang="en-US">',
  'entity.what-we-do':
    'Open the homepage with one complete sentence:\n\n  "Atlas Roofing & Exteriors is a licensed residential and commercial roofing contractor\n   serving homeowners and property managers across the Denver metro area, specializing in\n   storm-damage repair, full roof replacement and annual inspection programs."',
  'entity.audience-definition':
    'State the audience explicitly rather than implying it:\n\n  "We work with three groups: homeowners after storm damage, property managers\n   maintaining multi-unit buildings, and general contractors who need a roofing\n   subcontractor on commercial builds."',
  'entity.geographic-clarity':
    'Publish the service area as a list, and mirror it in schema:\n\n  {\n    "@context": "https://schema.org",\n    "@type": "LocalBusiness",\n    "name": "Atlas Roofing & Exteriors",\n    "address": {\n      "@type": "PostalAddress",\n      "streetAddress": "4820 Kalamath St",\n      "addressLocality": "Denver",\n      "addressRegion": "CO",\n      "postalCode": "80211",\n      "addressCountry": "US"\n    },\n    "areaServed": ["Denver", "Aurora", "Lakewood", "Arvada", "Boulder"]\n  }',
  'entity.about-page':
    'A strong About page covers, in order: what the business does, when and by whom it was founded, licenses and certifications held, the service area, team size, and the specific specialization that differentiates it.',
  'entity.title-quality':
    'Use a consistent, descriptive pattern:\n\n  <title>Roof Repair in Denver, CO | Atlas Roofing &amp; Exteriors</title>',
  'entity.meta-description':
    '  <meta name="description" content="Emergency and scheduled roof repair across the Denver metro. Licensed, insured, and typically on site within 24 hours. Free written estimates." />',
  'schema.organization-present':
    'Add site-wide Organization (or LocalBusiness) JSON-LD:\n\n  <script type="application/ld+json">\n  {\n    "@context": "https://schema.org",\n    "@type": "LocalBusiness",\n    "name": "Atlas Roofing & Exteriors",\n    "url": "https://example.com",\n    "logo": "https://example.com/logo.png",\n    "description": "Licensed roofing contractor serving the Denver metro area since 2004.",\n    "telephone": "+1-303-555-0142",\n    "email": "hello@example.com",\n    "address": { "@type": "PostalAddress", "streetAddress": "4820 Kalamath St", "addressLocality": "Denver", "addressRegion": "CO", "postalCode": "80211", "addressCountry": "US" },\n    "sameAs": ["https://www.linkedin.com/company/example", "https://www.bbb.org/us/co/denver/profile/example"]\n  }\n  </script>',
  'schema.organization-completeness':
    'Extend the existing block rather than adding a second one. logo, description, address, telephone and sameAs carry the most weight for entity resolution.',
  'schema.same-as':
    '  "sameAs": [\n    "https://www.linkedin.com/company/atlas-roofing",\n    "https://www.facebook.com/atlasroofingco",\n    "https://www.bbb.org/us/co/denver/profile/roofing/atlas-roofing"\n  ]',
  'schema.faq':
    'Mark up existing FAQ content:\n\n  {\n    "@context": "https://schema.org",\n    "@type": "FAQPage",\n    "mainEntity": [{\n      "@type": "Question",\n      "name": "How long does a roof replacement take?",\n      "acceptedAnswer": {\n        "@type": "Answer",\n        "text": "Most residential replacements take one to two days. Larger or steeper roofs, and jobs requiring deck repair, can run to four days."\n      }\n    }]\n  }',
  'schema.author':
    '  "author": {\n    "@type": "Person",\n    "name": "Marcus Vail",\n    "jobTitle": "Master Roofer, CO License #RC-44821",\n    "url": "https://example.com/team/marcus-vail"\n  }',
  'answer.question-headings':
    'Rewrite section headings as the question, and answer it immediately:\n\n  <h2>How much does a roof replacement cost in Denver?</h2>\n  <p>A standard asphalt shingle replacement on a 2,000 sq ft home in the Denver\n     metro runs $9,500 to $16,000 as of 2026. Steeper pitches, tile and metal\n     systems, and decking repairs increase that range.</p>',
  'answer.faq-coverage':
    'Start from real inputs: your sales inbox, call logs and quote objections. Fifteen genuine customer questions beat fifty invented ones.',
  'answer.passage-sizing':
    'Aim for paragraphs of roughly 40-90 words, each making one complete point that still reads correctly when quoted alone.',
  'answer.definitions':
    'Define terms explicitly before elaborating:\n\n  "Ice damming is a ridge of ice that forms at the roof edge and prevents\n   melting snow from draining. The trapped water backs up under the shingles\n   and enters the structure."',
  'content.factual-specificity':
    'Replace "fast response times" with "we respond to emergency calls within four business hours, and 92% of 2025 storm callouts were on site the same day."',
  'content.first-party-evidence':
    'Publish case studies structured as: the situation, what was found on inspection, what was done, what it cost, and the measured outcome — with dates and a location.',
  'content.freshness':
    '  <p class="updated">Last reviewed: <time datetime="2026-03-14">March 14, 2026</time></p>',
  'trust.contact-details':
    'Publish the full NAP (name, address, phone) in the footer of every page, and keep it byte-identical to the value in your LocalBusiness schema and directory listings.',
  'trust.author-attribution':
    'Add a byline linked to a real bio:\n\n  <p class="byline">Written by <a href="/team/marcus-vail">Marcus Vail</a>,\n     Master Roofer, CO License #RC-44821 — 18 years in commercial roofing.</p>',
  'trust.outbound-citations':
    'Cite the authority behind a claim in the sentence itself: "The 2021 International Residential Code (R905.2.7) requires ice barrier underlayment in the Denver climate zone."',
};

/** Turn a check into the "why it matters" narrative. */
function whyItMatters(check: CheckResult): string {
  return check.explanation;
}

function expectedImpactText(check: CheckResult): string {
  const category = CATEGORY_LABELS[check.category];
  const shortfall = check.maxPoints - check.points;
  const magnitude =
    shortfall >= 7 ? 'a large' : shortfall >= 4 ? 'a meaningful' : shortfall >= 2 ? 'a modest' : 'a small';
  return `Closing this gap contributes ${magnitude} improvement to your ${category} score (${shortfall.toFixed(1)} of ${check.maxPoints} points currently unearned).`;
}

function horizonFor(check: CheckResult, index: number): RecommendationHorizon {
  if (check.severity === Severity.CRITICAL) return RecommendationHorizon.DO_FIRST;
  if (check.severity === Severity.HIGH && check.effort !== EffortLevel.HIGH) {
    return RecommendationHorizon.DO_FIRST;
  }
  if (check.effort === EffortLevel.LOW && index < 8) return RecommendationHorizon.DO_FIRST;
  if (check.effort === EffortLevel.HIGH) return RecommendationHorizon.LONGER_TERM;
  if (check.severity === Severity.LOW) return RecommendationHorizon.LONGER_TERM;
  return RecommendationHorizon.NEXT_30_DAYS;
}

/**
 * Build the prioritized action plan from the full check list.
 */
export function generateRecommendations(checks: CheckResult[]): GeneratedRecommendation[] {
  const actionable = checks.filter(
    (c) =>
      c.applicable &&
      (c.status === 'FAIL' || c.status === 'WARN') &&
      c.severity !== Severity.PASSED,
  );

  const sorted = [...actionable].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    const byImpact = IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact];
    if (byImpact !== 0) return byImpact;
    const byEffort = EFFORT_RANK[a.effort] - EFFORT_RANK[b.effort];
    if (byEffort !== 0) return byEffort;
    const byCategory = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
    if (byCategory !== 0) return byCategory;
    return a.checkId.localeCompare(b.checkId);
  });

  return sorted.map((check, index) => ({
    horizon: horizonFor(check, index),
    priority: index + 1,
    category: check.category,
    title: recommendationTitle(check),
    whyItMatters: whyItMatters(check),
    recommendedChange: check.recommendedAction,
    exampleImplementation: EXAMPLES[check.checkId] ?? null,
    expectedImpact: expectedImpactText(check),
    impact: check.impact,
    effort: check.effort,
    relatedCheckIds: [check.checkId],
    source: EvidenceSource.OBSERVED,
  }));
}

function recommendationTitle(check: CheckResult): string {
  // Reframe the check title from a state ("Site is served over HTTPS") into an
  // action ("Serve the whole site over HTTPS") where a simple rule applies.
  const overrides: Record<string, string> = {
    'tech.https': 'Serve every page over HTTPS',
    'tech.homepage-status': 'Fix the homepage response',
    'tech.redirect-chains': 'Collapse multi-hop redirects',
    'tech.indexability': 'Remove noindex from pages you want cited',
    'tech.robots-txt': 'Publish a permissive robots.txt',
    'tech.ai-crawler-access': 'Review which AI crawlers you allow',
    'tech.sitemap': 'Publish and reference an XML sitemap',
    'tech.llms-txt': 'Publish an llms.txt summary file',
    'tech.canonical': 'Add self-referencing canonical tags',
    'tech.viewport': 'Declare a mobile viewport',
    'tech.lang': 'Declare the content language',
    'tech.broken-links': 'Fix broken internal links',
    'tech.image-alt': 'Add alt text to images',
    'tech.crawl-success': 'Resolve pages that fail to load for crawlers',
    'tech.response-time': 'Improve server response time',
    'tech.discoverable-pages': 'Expose more pages through navigation',
    'entity.brand-name-prominence': 'Make the business name prominent on the homepage',
    'entity.what-we-do': 'State plainly what the business does',
    'entity.audience-definition': 'Name the customers you serve',
    'entity.service-specificity': 'Give each service its own detailed page',
    'entity.geographic-clarity': 'Publish your address and service area',
    'entity.about-page': 'Build out a substantive About page',
    'entity.name-consistency': 'Use the business name consistently in page titles',
    'entity.title-quality': 'Rewrite thin or missing page titles',
    'entity.meta-description': 'Write unique meta descriptions',
    'entity.duplicate-metadata': 'Eliminate duplicate titles and descriptions',
    'entity.open-graph': 'Add Open Graph metadata',
    'content.average-depth': 'Deepen thin pages',
    'content.thin-pages': 'Fix or remove near-empty pages',
    'content.editorial-presence': 'Publish explanatory content',
    'content.factual-specificity': 'Replace vague claims with specific figures',
    'content.vague-language': 'Cut empty marketing filler',
    'content.unsupported-superlatives': 'Support or remove superlative claims',
    'content.freshness': 'Show and maintain content dates',
    'content.internal-linking': 'Strengthen internal linking',
    'content.heading-structure': 'Fix heading hierarchy',
    'content.first-party-evidence': 'Publish first-party evidence and case studies',
    'content.duplication': 'Differentiate templated pages',
    'content.homepage-substance': 'Add explanatory copy to the homepage',
    'answer.question-headings': 'Reframe headings as customer questions',
    'answer.faq-coverage': 'Publish and mark up an FAQ',
    'answer.passage-sizing': 'Break content into extractable passages',
    'answer.lists-and-tables': 'Use lists and tables for structured information',
    'answer.definitions': 'Define your key terms explicitly',
    'answer.comparison-content': 'Publish comparison content',
    'answer.front-loaded': 'Lead with the answer',
    'answer.terminology-consistency': 'Align terminology with customer language',
    'answer.homepage-summary': 'Add a quotable summary sentence to the homepage',
    'answer.process-content': 'Document your process as clear steps',
    'schema.presence': 'Add JSON-LD structured data site-wide',
    'schema.validity': 'Fix invalid structured data',
    'schema.organization-present': 'Declare Organization or LocalBusiness schema',
    'schema.organization-completeness': 'Complete your Organization schema properties',
    'schema.same-as': 'Add sameAs profile links',
    'schema.website': 'Add WebSite schema',
    'schema.breadcrumbs': 'Add BreadcrumbList schema',
    'schema.content-types': 'Add page-level content schema',
    'schema.faq': 'Add FAQPage schema',
    'schema.author': 'Express authorship in structured data',
    'schema.reviews': 'Mark up genuine reviews',
    'schema.name-agreement': 'Align schema name with the visible brand',
    'trust.contact-details': 'Publish complete contact details',
    'trust.contact-page': 'Create a dedicated contact page',
    'trust.author-attribution': 'Attribute content to named authors',
    'trust.author-expertise': 'State credentials and expertise',
    'trust.outbound-citations': 'Cite external sources',
    'trust.source-transparency': 'Name sources inside the text',
    'trust.customer-proof': 'Publish verifiable customer proof',
    'trust.legitimacy-markers': 'Add standard business legitimacy markers',
    'trust.attribution-clarity': 'Make content clearly attributable to the business',
    'trust.update-dates': 'Disclose publication and update dates',
    'competitive.overall-signals': 'Close the overall competitor signal gap',
    'competitive.structured-data': 'Match competitor structured-data coverage',
    'competitive.content-depth': 'Match competitor content depth',
    'competitive.answer-readiness': 'Match competitor answer-ready structure',
  };
  return overrides[check.checkId] ?? check.title;
}

/** Group the plan for display. */
export function groupByHorizon(
  recommendations: GeneratedRecommendation[],
): Record<RecommendationHorizon, GeneratedRecommendation[]> {
  return {
    DO_FIRST: recommendations.filter((r) => r.horizon === 'DO_FIRST'),
    NEXT_30_DAYS: recommendations.filter((r) => r.horizon === 'NEXT_30_DAYS'),
    LONGER_TERM: recommendations.filter((r) => r.horizon === 'LONGER_TERM'),
  };
}

export const HORIZON_LABELS: Record<RecommendationHorizon, string> = {
  DO_FIRST: 'Do first',
  NEXT_30_DAYS: 'Next 30 days',
  LONGER_TERM: 'Longer-term improvements',
};

export const HORIZON_DESCRIPTIONS: Record<RecommendationHorizon, string> = {
  DO_FIRST:
    'High-impact fixes that remove barriers or add missing fundamentals. Most can be completed in a single working session.',
  NEXT_30_DAYS:
    'Meaningful improvements that need coordination or content work but no structural change.',
  LONGER_TERM:
    'Investments that compound — original research, deep service pages and sustained publishing.',
};

/** Derive the top strengths shown in the executive summary. */
export function deriveStrengths(checks: CheckResult[], limit = 3): string[] {
  return checks
    .filter((c) => c.status === 'PASS' && c.applicable && c.maxPoints >= 5)
    .sort((a, b) => b.maxPoints - a.maxPoints || a.checkId.localeCompare(b.checkId))
    .slice(0, limit)
    .map((c) => c.title);
}

/** Derive the top weaknesses shown in the executive summary. */
export function deriveWeaknesses(checks: CheckResult[], limit = 3): string[] {
  return checks
    .filter((c) => c.applicable && (c.status === 'FAIL' || c.status === 'WARN'))
    .sort((a, b) => {
      const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (bySeverity !== 0) return bySeverity;
      const shortfallA = a.maxPoints - a.points;
      const shortfallB = b.maxPoints - b.points;
      if (shortfallB !== shortfallA) return shortfallB - shortfallA;
      return a.checkId.localeCompare(b.checkId);
    })
    .slice(0, limit)
    .map((c) => c.title);
}
