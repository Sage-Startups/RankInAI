import {
  AuditCategory,
  EffortLevel,
  EvidenceSource,
  FindingStatus,
  ImpactLevel,
  PageRole,
  RecommendationHorizon,
  Severity,
} from '@prisma/client';

/**
 * Fictional demonstration audit for "Atlas Roofing & Exteriors".
 *
 * Every value here is invented for product demonstration. No real website was
 * audited to produce it. It is shared by:
 *   - the instant landing-page demo
 *   - the public sample report page
 *   - the seeded demo audit in the database (isDemo: true)
 *
 * Keeping one source of truth means the demo, the sample report and the seeded
 * record can never drift apart.
 */

export const DEMO_LABEL = 'Demo data';
export const DEMO_DISCLAIMER =
  'Interactive sample using fictional demonstration data. Atlas Roofing & Exteriors is not a real company and no website was audited to produce these results.';

export const DEMO_BUSINESS = {
  name: 'Atlas Roofing & Exteriors',
  websiteUrl: 'https://www.atlasroofingexteriors.example',
  displayDomain: 'atlasroofingexteriors.example',
  industry: 'Construction and trades',
  location: 'Denver, Colorado',
  targetCountry: 'United States',
  audience: 'Homeowners, property managers and general contractors across the Denver metro area',
  services: 'Roof replacement, storm damage repair, roof inspection, gutter installation, siding',
  founded: 2004,
  overallScore: 72,
  pagesCrawled: 10,
} as const;

export interface DemoCategoryScore {
  category: AuditCategory;
  label: string;
  score: number;
  weight: number;
  summary: string;
}

export const DEMO_CATEGORY_SCORES: DemoCategoryScore[] = [
  {
    category: AuditCategory.TECHNICAL_ACCESSIBILITY,
    label: 'Technical Accessibility',
    score: 86,
    weight: 0.15,
    summary:
      'The site is fully reachable over HTTPS, indexable and served quickly. A missing llms.txt and two broken internal links are the only outstanding items.',
  },
  {
    category: AuditCategory.ENTITY_CLARITY,
    label: 'Entity Clarity',
    score: 74,
    weight: 0.17,
    summary:
      'The business name, service area and audience are all stated, but four service pages share a near-identical title pattern and the About page is thin at 210 words.',
  },
  {
    category: AuditCategory.CONTENT_AUTHORITY,
    label: 'Content Authority',
    score: 63,
    weight: 0.18,
    summary:
      'Service pages average 380 words and lean on marketing phrasing. There are no case studies and only three dated articles in the last two years.',
  },
  {
    category: AuditCategory.ANSWER_READINESS,
    label: 'Answer Readiness',
    score: 58,
    weight: 0.17,
    summary:
      'Only six question-led headings were found across ten pages, and the existing FAQ content is not marked up, so it cannot be read as question/answer pairs.',
  },
  {
    category: AuditCategory.STRUCTURED_DATA,
    label: 'Structured Data',
    score: 69,
    weight: 0.13,
    summary:
      'LocalBusiness schema is present and valid but incomplete — no sameAs links, no areaServed and no FAQPage markup anywhere on the site.',
  },
  {
    category: AuditCategory.TRUST_AND_EVIDENCE,
    label: 'Trust and Evidence',
    score: 81,
    weight: 0.15,
    summary:
      'Full contact details, a license number and a founding year are published. Content is largely unattributed, which is the main remaining gap.',
  },
  {
    category: AuditCategory.COMPETITIVE_VISIBILITY,
    label: 'Competitive Visibility',
    score: 66,
    weight: 0.05,
    summary:
      'Ahead of the sampled competitor on trust signals, behind on structured data coverage and question-led content.',
  },
];

export const DEMO_STRENGTHS = [
  'Complete NAP details published in the footer of every page and mirrored in LocalBusiness schema',
  'Every page is served over HTTPS, indexable, and returns in under 700ms',
  'Colorado roofing license number and 2004 founding date are stated prominently',
];

export const DEMO_WEAKNESSES = [
  'No FAQPage structured data anywhere, despite an existing FAQ section on three pages',
  'Service pages average 380 words with no pricing, process detail or specific outcomes',
  'No named author on any page — all content is anonymous',
];

export interface DemoFinding {
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

export const DEMO_FINDINGS: DemoFinding[] = [
  {
    category: AuditCategory.ANSWER_READINESS,
    categoryLabel: 'Answer Readiness',
    checkId: 'answer.faq-coverage',
    title: 'FAQ content exists but is not machine-readable',
    status: FindingStatus.FAIL,
    severity: Severity.HIGH,
    evidence: {
      faqSectionsFound: 3,
      pagesWithFaqContent: ['/faq', '/services/roof-replacement', '/storm-damage'],
      faqPageSchemaPresent: false,
      questionsDetected: 14,
    },
    explanation:
      'Fourteen question/answer pairs were found across three pages, but none are marked up with FAQPage schema. Without the markup, an answer engine has to infer the structure from headings, which is far less reliable.',
    recommendedAction:
      'Add FAQPage JSON-LD to the /faq page and to the FAQ blocks on the two service pages, mapping each visible question to its answer text.',
    effort: EffortLevel.LOW,
    impact: ImpactLevel.HIGH,
    pageUrl: 'https://www.atlasroofingexteriors.example/faq',
    source: EvidenceSource.OBSERVED,
  },
  {
    category: AuditCategory.CONTENT_AUTHORITY,
    categoryLabel: 'Content Authority',
    checkId: 'content.average-depth',
    title: 'Service pages are too thin to be retrieved as answers',
    status: FindingStatus.FAIL,
    severity: Severity.HIGH,
    evidence: {
      averageWordsPerPage: 380,
      thinnestPages: [
        { url: '/services/gutter-installation', words: 212 },
        { url: '/services/siding', words: 244 },
        { url: '/services/roof-inspection', words: 301 },
      ],
      threshold: '500 words for a service page',
    },
    explanation:
      'Retrieval systems select passages, not pages. At 212-380 words with no pricing, process or outcome detail, these pages rarely contain a passage long enough to answer a question on its own.',
    recommendedAction:
      'Expand each service page to cover what the service is, who it suits, the step-by-step process, realistic price ranges, typical timelines and what is included.',
    effort: EffortLevel.HIGH,
    impact: ImpactLevel.HIGH,
    pageUrl: 'https://www.atlasroofingexteriors.example/services/gutter-installation',
    source: EvidenceSource.OBSERVED,
  },
  {
    category: AuditCategory.TRUST_AND_EVIDENCE,
    categoryLabel: 'Trust and Evidence',
    checkId: 'trust.author-attribution',
    title: 'No content is attributed to a named person',
    status: FindingStatus.FAIL,
    severity: Severity.HIGH,
    evidence: {
      authorsFound: [],
      pagesWithByline: 0,
      editorialPages: 3,
      personSchemaPresent: false,
    },
    explanation:
      'Named authors let a system attach expertise and accountability to a claim. Every page on this site is anonymous, so nothing published here can be weighed as expert testimony.',
    recommendedAction:
      'Add a byline with a real name and credentials to every substantive page, linked to a bio page, and express it in Person schema.',
    effort: EffortLevel.MEDIUM,
    impact: ImpactLevel.HIGH,
    pageUrl: 'https://www.atlasroofingexteriors.example/blog/ice-dam-prevention',
    source: EvidenceSource.OBSERVED,
  },
  {
    category: AuditCategory.STRUCTURED_DATA,
    categoryLabel: 'Structured Data',
    checkId: 'schema.organization-completeness',
    title: 'LocalBusiness schema is missing key properties',
    status: FindingStatus.WARN,
    severity: Severity.MEDIUM,
    evidence: {
      propertiesPresent: ['name', 'url', 'telephone', 'address'],
      valuableMissing: ['logo', 'description', 'sameAs', 'areaServed', 'email'],
      schemaValid: true,
    },
    explanation:
      'The block is valid but carries only four properties. sameAs and areaServed in particular are what let an entity-resolution system connect this business to its other public profiles and its service region.',
    recommendedAction:
      'Extend the existing LocalBusiness block with logo, description, email, areaServed and a sameAs array of verified profiles.',
    effort: EffortLevel.LOW,
    impact: ImpactLevel.HIGH,
    pageUrl: 'https://www.atlasroofingexteriors.example/',
    source: EvidenceSource.OBSERVED,
  },
  {
    category: AuditCategory.ENTITY_CLARITY,
    categoryLabel: 'Entity Clarity',
    checkId: 'entity.about-page',
    title: 'About page is too thin to define the organization',
    status: FindingStatus.WARN,
    severity: Severity.MEDIUM,
    evidence: {
      aboutPageUrl: '/about',
      wordCount: 210,
      mentionsFoundingOrHistory: true,
      mentionsTeam: false,
      mentionsCredentials: false,
    },
    explanation:
      'The About page confirms the founding year but says nothing about leadership, team size, certifications or specialization. This is the page a model looks to when confirming who is behind the content.',
    recommendedAction:
      'Expand the About page to at least 500 words covering leadership, crew size, certifications, insurance, the specific service area and what the business specializes in.',
    effort: EffortLevel.MEDIUM,
    impact: ImpactLevel.HIGH,
    pageUrl: 'https://www.atlasroofingexteriors.example/about',
    source: EvidenceSource.OBSERVED,
  },
  {
    category: AuditCategory.TECHNICAL_ACCESSIBILITY,
    categoryLabel: 'Technical Accessibility',
    checkId: 'tech.https',
    title: 'Every page is served over HTTPS',
    status: FindingStatus.PASS,
    severity: Severity.PASSED,
    evidence: { pagesChecked: 10, pagesOverHttps: 10, certificateValid: true },
    explanation:
      'HTTPS is the baseline requirement for being treated as a trustworthy source by AI crawlers.',
    recommendedAction: 'No action needed — keep the certificate renewed.',
    effort: EffortLevel.LOW,
    impact: ImpactLevel.HIGH,
    pageUrl: 'https://www.atlasroofingexteriors.example/',
    source: EvidenceSource.OBSERVED,
  },
  {
    category: AuditCategory.TRUST_AND_EVIDENCE,
    categoryLabel: 'Trust and Evidence',
    checkId: 'trust.contact-details',
    title: 'Complete contact details are published site-wide',
    status: FindingStatus.PASS,
    severity: Severity.PASSED,
    evidence: {
      emailFound: true,
      phoneFound: true,
      postalAddressFound: true,
      matchesSchema: true,
      sampleAddress: '4820 Kalamath St, Denver, CO 80211',
    },
    explanation:
      'A verifiable phone number, email and postal address are among the strongest signals that a site represents a real operating business.',
    recommendedAction: 'No action needed — keep the details identical across the site and directories.',
    effort: EffortLevel.LOW,
    impact: ImpactLevel.HIGH,
    pageUrl: 'https://www.atlasroofingexteriors.example/contact',
    source: EvidenceSource.OBSERVED,
  },
  {
    category: AuditCategory.TECHNICAL_ACCESSIBILITY,
    categoryLabel: 'Technical Accessibility',
    checkId: 'tech.llms-txt',
    title: 'No llms.txt guidance file published',
    status: FindingStatus.INFO,
    severity: Severity.INFORMATIONAL,
    evidence: { found: false, checkedUrl: '/llms.txt' },
    explanation:
      'llms.txt is an emerging convention for pointing language models at the pages that best summarize a site. Adoption is early, so its absence is not penalized heavily.',
    recommendedAction:
      'Consider publishing /llms.txt with a short business description and links to the most useful pages.',
    effort: EffortLevel.LOW,
    impact: ImpactLevel.LOW,
    pageUrl: null,
    source: EvidenceSource.OBSERVED,
  },
];

export interface DemoRecommendation {
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
}

export const DEMO_RECOMMENDATIONS: DemoRecommendation[] = [
  {
    horizon: RecommendationHorizon.DO_FIRST,
    priority: 1,
    category: AuditCategory.ANSWER_READINESS,
    title: 'Publish and mark up an FAQ',
    whyItMatters:
      'Fourteen genuine question/answer pairs already exist on the site but are invisible as structured data. FAQPage markup is the lowest-effort change here with a direct effect on how retrievable those answers are.',
    recommendedChange:
      'Add FAQPage JSON-LD to /faq and to the FAQ blocks on the roof-replacement and storm-damage pages. Map each visible question to its exact answer text — never mark up a question that is not on the page.',
    exampleImplementation: `{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "How long does a roof replacement take?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Most residential replacements in the Denver metro take one to two days. Steeper pitches, tile and metal systems, and jobs needing deck repair can run to four days."
    }
  }]
}`,
    expectedImpact:
      'Closing this gap contributes a meaningful improvement to your Answer Readiness score (8.0 of 8 points currently unearned).',
    impact: ImpactLevel.HIGH,
    effort: EffortLevel.LOW,
  },
  {
    horizon: RecommendationHorizon.DO_FIRST,
    priority: 2,
    category: AuditCategory.STRUCTURED_DATA,
    title: 'Complete your LocalBusiness schema properties',
    whyItMatters:
      'Your schema block is valid but carries only four properties. sameAs and areaServed are what let an entity-resolution system connect this business to its other public profiles and confirm the region it serves.',
    recommendedChange:
      'Extend the existing LocalBusiness block — do not add a second one — with logo, description, email, areaServed and a sameAs array of verified profiles.',
    exampleImplementation: `{
  "@context": "https://schema.org",
  "@type": "RoofingContractor",
  "name": "Atlas Roofing & Exteriors",
  "url": "https://www.atlasroofingexteriors.example",
  "logo": "https://www.atlasroofingexteriors.example/logo.png",
  "description": "Licensed roofing contractor serving the Denver metro area since 2004.",
  "telephone": "+1-303-555-0142",
  "email": "hello@atlasroofingexteriors.example",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "4820 Kalamath St",
    "addressLocality": "Denver",
    "addressRegion": "CO",
    "postalCode": "80211",
    "addressCountry": "US"
  },
  "areaServed": ["Denver", "Aurora", "Lakewood", "Arvada", "Boulder", "Westminster"],
  "sameAs": [
    "https://www.linkedin.com/company/atlas-roofing-exteriors",
    "https://www.bbb.org/us/co/denver/profile/roofing/atlas-roofing-exteriors"
  ]
}`,
    expectedImpact:
      'Closing this gap contributes a meaningful improvement to your Structured Data score (4.5 of 8 points currently unearned).',
    impact: ImpactLevel.HIGH,
    effort: EffortLevel.LOW,
  },
  {
    horizon: RecommendationHorizon.DO_FIRST,
    priority: 3,
    category: AuditCategory.TRUST_AND_EVIDENCE,
    title: 'Attribute content to named authors',
    whyItMatters:
      'Every page on the site is anonymous. Named authors with stated credentials let a system treat your guidance as expert testimony rather than unattributed marketing copy.',
    recommendedChange:
      'Add a byline with a real name and license number to every substantive page, link it to a bio page, and express it in Person schema.',
    exampleImplementation: `<p class="byline">
  Written by <a href="/team/marcus-vail">Marcus Vail</a>,
  Master Roofer, CO License #RC-44821 — 18 years in commercial roofing.
</p>`,
    expectedImpact:
      'Closing this gap contributes a large improvement to your Trust and Evidence score (8.0 of 8 points currently unearned).',
    impact: ImpactLevel.HIGH,
    effort: EffortLevel.MEDIUM,
  },
  {
    horizon: RecommendationHorizon.NEXT_30_DAYS,
    priority: 4,
    category: AuditCategory.ENTITY_CLARITY,
    title: 'Build out a substantive About page',
    whyItMatters:
      'The About page is the page a model looks to when confirming the organization behind the content. At 210 words it confirms a founding year and nothing else.',
    recommendedChange:
      'Expand the About page to at least 500 words covering leadership, crew size, certifications, insurance, the exact service area and what the business specializes in.',
    exampleImplementation: null,
    expectedImpact:
      'Closing this gap contributes a meaningful improvement to your Entity Clarity score (2.8 of 8 points currently unearned).',
    impact: ImpactLevel.HIGH,
    effort: EffortLevel.MEDIUM,
  },
  {
    horizon: RecommendationHorizon.NEXT_30_DAYS,
    priority: 5,
    category: AuditCategory.ANSWER_READINESS,
    title: 'Reframe headings as customer questions',
    whyItMatters:
      'Only six question-shaped headings were found across ten pages. A heading phrased as the question a customer would ask, answered immediately beneath it, is the most reliable pattern for producing a retrievable passage.',
    recommendedChange:
      'Convert descriptive subheadings on the service pages into the questions customers actually ask, then answer each in the two or three sentences directly below.',
    exampleImplementation: `<h2>How much does a roof replacement cost in Denver?</h2>
<p>A standard asphalt shingle replacement on a 2,000 sq ft home in the Denver
   metro runs $9,500 to $16,000 as of 2026. Steeper pitches, tile and metal
   systems, and decking repairs increase that range.</p>`,
    expectedImpact:
      'Closing this gap contributes a meaningful improvement to your Answer Readiness score (5.4 of 9 points currently unearned).',
    impact: ImpactLevel.HIGH,
    effort: EffortLevel.MEDIUM,
  },
  {
    horizon: RecommendationHorizon.NEXT_30_DAYS,
    priority: 6,
    category: AuditCategory.CONTENT_AUTHORITY,
    title: 'Replace vague claims with specific figures',
    whyItMatters:
      'Phrases like "industry-leading response times" carry no retrievable information. Specific figures give a model something concrete to quote.',
    recommendedChange:
      'Rewrite the eight vague phrases identified in the findings into measurable statements with real numbers.',
    exampleImplementation:
      'Replace "industry-leading response times" with "we respond to emergency calls within four business hours, and 92% of 2025 storm callouts were on site the same day."',
    expectedImpact:
      'Closing this gap contributes a modest improvement to your Content Authority score (3.5 of 7 points currently unearned).',
    impact: ImpactLevel.HIGH,
    effort: EffortLevel.MEDIUM,
  },
  {
    horizon: RecommendationHorizon.LONGER_TERM,
    priority: 7,
    category: AuditCategory.CONTENT_AUTHORITY,
    title: 'Deepen thin service pages',
    whyItMatters:
      'Service pages averaging 380 words rarely contain a passage long enough to answer a question on its own, so they are seldom cited even when they are relevant.',
    recommendedChange:
      'Expand each service page to cover what the service is, who it suits, the step-by-step process, realistic price ranges, typical timelines and what is included.',
    exampleImplementation: null,
    expectedImpact:
      'Closing this gap contributes a large improvement to your Content Authority score (4.1 of 9 points currently unearned).',
    impact: ImpactLevel.HIGH,
    effort: EffortLevel.HIGH,
  },
  {
    horizon: RecommendationHorizon.LONGER_TERM,
    priority: 8,
    category: AuditCategory.CONTENT_AUTHORITY,
    title: 'Publish first-party evidence and case studies',
    whyItMatters:
      'Original data and detailed case studies are what distinguish a source worth citing from a page that restates common knowledge. None were found.',
    recommendedChange:
      'Publish at least six case studies structured as: the situation, what inspection found, what was done, what it cost, and the measured outcome — with dates and locations.',
    exampleImplementation: null,
    expectedImpact:
      'Closing this gap contributes a meaningful improvement to your Content Authority score (5.3 of 7 points currently unearned).',
    impact: ImpactLevel.HIGH,
    effort: EffortLevel.HIGH,
  },
];

export interface DemoPage {
  url: string;
  path: string;
  role: PageRole;
  title: string;
  wordCount: number;
  statusCode: number;
  schemaTypes: string[];
  questionHeadings: number;
  note: string;
}

export const DEMO_PAGES: DemoPage[] = [
  {
    url: 'https://www.atlasroofingexteriors.example/',
    path: '/',
    role: PageRole.HOME,
    title: 'Denver Roofing Contractor | Atlas Roofing & Exteriors',
    wordCount: 612,
    statusCode: 200,
    schemaTypes: ['RoofingContractor', 'WebSite'],
    questionHeadings: 2,
    note: 'Strong opening summary sentence; LocalBusiness schema present but incomplete.',
  },
  {
    url: 'https://www.atlasroofingexteriors.example/about',
    path: '/about',
    role: PageRole.ABOUT,
    title: 'About Us | Atlas Roofing & Exteriors',
    wordCount: 210,
    statusCode: 200,
    schemaTypes: [],
    questionHeadings: 0,
    note: 'Thin. Founding year present, no leadership, credentials or specialization.',
  },
  {
    url: 'https://www.atlasroofingexteriors.example/services/roof-replacement',
    path: '/services/roof-replacement',
    role: PageRole.SERVICE,
    title: 'Roof Replacement | Atlas Roofing & Exteriors',
    wordCount: 548,
    statusCode: 200,
    schemaTypes: ['Service'],
    questionHeadings: 3,
    note: 'Best service page. Includes an FAQ block that is not marked up.',
  },
  {
    url: 'https://www.atlasroofingexteriors.example/services/roof-inspection',
    path: '/services/roof-inspection',
    role: PageRole.SERVICE,
    title: 'Roof Inspection | Atlas Roofing & Exteriors',
    wordCount: 301,
    statusCode: 200,
    schemaTypes: ['Service'],
    questionHeadings: 1,
    note: 'No pricing, process or timeline detail.',
  },
  {
    url: 'https://www.atlasroofingexteriors.example/services/gutter-installation',
    path: '/services/gutter-installation',
    role: PageRole.SERVICE,
    title: 'Gutter Installation | Atlas Roofing & Exteriors',
    wordCount: 212,
    statusCode: 200,
    schemaTypes: [],
    questionHeadings: 0,
    note: 'Thinnest page on the site. No schema.',
  },
  {
    url: 'https://www.atlasroofingexteriors.example/services/siding',
    path: '/services/siding',
    role: PageRole.SERVICE,
    title: 'Siding | Atlas Roofing & Exteriors',
    wordCount: 244,
    statusCode: 200,
    schemaTypes: [],
    questionHeadings: 0,
    note: 'Duplicate opening paragraph shared with the gutter page.',
  },
  {
    url: 'https://www.atlasroofingexteriors.example/storm-damage',
    path: '/storm-damage',
    role: PageRole.SERVICE,
    title: 'Storm Damage Repair | Atlas Roofing & Exteriors',
    wordCount: 497,
    statusCode: 200,
    schemaTypes: ['Service'],
    questionHeadings: 2,
    note: 'Contains an unmarked FAQ block and useful insurance-claim detail.',
  },
  {
    url: 'https://www.atlasroofingexteriors.example/faq',
    path: '/faq',
    role: PageRole.FAQ,
    title: 'Frequently Asked Questions | Atlas Roofing & Exteriors',
    wordCount: 734,
    statusCode: 200,
    schemaTypes: [],
    questionHeadings: 9,
    note: 'Nine real questions with good answers — no FAQPage schema.',
  },
  {
    url: 'https://www.atlasroofingexteriors.example/contact',
    path: '/contact',
    role: PageRole.CONTACT,
    title: 'Contact | Atlas Roofing & Exteriors',
    wordCount: 186,
    statusCode: 200,
    schemaTypes: ['ContactPage'],
    questionHeadings: 0,
    note: 'Full NAP, hours and a map. Matches schema exactly.',
  },
  {
    url: 'https://www.atlasroofingexteriors.example/blog/ice-dam-prevention',
    path: '/blog/ice-dam-prevention',
    role: PageRole.ARTICLE,
    title: 'How to Prevent Ice Dams in Colorado | Atlas Roofing',
    wordCount: 891,
    statusCode: 200,
    schemaTypes: ['BlogPosting'],
    questionHeadings: 4,
    note: 'Strongest content on the site, but published anonymously and undated.',
  },
];

export const DEMO_COMPETITOR = {
  url: 'https://www.summitpeakroofing.example',
  name: 'Summit Peak Roofing',
  overallScore: 68,
  categoryScores: {
    TECHNICAL_ACCESSIBILITY: 82,
    ENTITY_CLARITY: 71,
    CONTENT_AUTHORITY: 58,
    ANSWER_READINESS: 74,
    STRUCTURED_DATA: 79,
    TRUST_AND_EVIDENCE: 62,
  } as Record<string, number>,
  highlights: [
    'Declares 5 schema types including FAQPage and BreadcrumbList',
    '11 question-led headings on the homepage',
    'Publishes a last-updated date on every service page',
  ],
  gaps: [
    'No postal address published anywhere on the site',
    'Homepage copy is thinner (418 words)',
    'No license number or founding date stated',
  ],
} as const;

/** Steps shown during the animated demo sequence (~5 seconds total). */
export const DEMO_SEQUENCE = [
  { label: 'Checking crawl access', durationMs: 700 },
  { label: 'Reading structured data', durationMs: 850 },
  { label: 'Analyzing brand entity signals', durationMs: 900 },
  { label: 'Reviewing answer-ready content', durationMs: 950 },
  { label: 'Comparing competitor signals', durationMs: 800 },
  { label: 'Building recommendations', durationMs: 800 },
] as const;

export const DEMO_NEXT_ACTION = {
  title: 'Add FAQPage schema to your existing FAQ content',
  detail:
    'It is the single highest-return change available to Atlas today: the content already exists and is good — it simply is not machine-readable. Roughly two hours of work for a direct gain in Answer Readiness and Structured Data.',
} as const;

/** Compact shape used by the landing-page mini report. */
export const DEMO_MINI_REPORT = {
  business: DEMO_BUSINESS,
  overallScore: DEMO_BUSINESS.overallScore,
  categories: DEMO_CATEGORY_SCORES,
  strengths: DEMO_STRENGTHS,
  weaknesses: DEMO_WEAKNESSES,
  competitor: DEMO_COMPETITOR,
  nextAction: DEMO_NEXT_ACTION,
} as const;
