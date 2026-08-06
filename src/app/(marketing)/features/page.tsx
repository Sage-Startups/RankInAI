import type { Metadata } from 'next';
import {
  BadgeCheck,
  BookOpenCheck,
  Braces,
  Building2,
  Download,
  FileText,
  Gauge,
  History,
  MessageSquareQuote,
  Palette,
  ScanSearch,
  ShieldCheck,
  Table2,
  Target,
  Users,
} from 'lucide-react';

import { Card, SectionHeading } from '@/components/ui/primitives';
import { CtaBand } from '@/components/site/marketing-blocks';
import { CATEGORY_WEIGHTS } from '@/lib/audit/scoring';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Every audit category and platform feature in RankInAI: technical accessibility, entity clarity, content authority, answer readiness, structured data, trust and evidence, and competitive visibility.',
  alternates: { canonical: '/features' },
};

const AUDIT_CATEGORIES = [
  {
    key: 'TECHNICAL_ACCESSIBILITY' as const,
    icon: ScanSearch,
    title: 'Technical Accessibility',
    summary: 'Can AI crawlers reach, load and index your pages at all?',
    checks: [
      'HTTPS coverage and certificate validity',
      'HTTP status codes and redirect chain length',
      'noindex directives and page indexability',
      'robots.txt presence, rules and blanket blocks',
      'Named AI crawler access (GPTBot, PerplexityBot, ClaudeBot, Google-Extended and others)',
      'XML sitemap discovery and URL count',
      'llms.txt detection',
      'Canonical URL coverage and self-reference',
      'Mobile viewport and language declaration',
      'Broken internal link sampling',
      'Image alt-text coverage',
      'Crawl success rate and server response time',
      'Number of distinct discoverable pages',
    ],
  },
  {
    key: 'ENTITY_CLARITY' as const,
    icon: Building2,
    title: 'Entity Clarity',
    summary: 'Can a model state who you are, what you do and who you serve — without guessing?',
    checks: [
      'Business name prominence in title, H1 and opening copy',
      'A plain statement of what the business does',
      'Explicit definition of the customers served',
      'Service and product specificity across pages',
      'Geographic clarity: address, service area, areaServed',
      'About page substance',
      'Name consistency across page titles',
      'Title tag quality and length',
      'Meta description coverage',
      'Duplicate title and description detection',
      'Open Graph and Twitter metadata',
    ],
  },
  {
    key: 'CONTENT_AUTHORITY' as const,
    icon: BookOpenCheck,
    title: 'Content Authority',
    summary: 'Is there enough original, specific, expert content to be treated as a source?',
    checks: [
      'Average content depth per page',
      'Thin and near-empty page detection',
      'Presence of explanatory or educational content',
      'Concrete facts and figures versus qualitative claims',
      'Empty marketing filler detection',
      'Unsupported superlative detection',
      'Content freshness and visible dates',
      'Internal linking depth',
      'Heading hierarchy and single-H1 structure',
      'First-party evidence: case studies, original data, customer proof',
      'Duplicated body copy across templated pages',
      'Homepage explanatory substance',
    ],
  },
  {
    key: 'ANSWER_READINESS' as const,
    icon: MessageSquareQuote,
    title: 'Answer Readiness',
    summary: 'How easily can a single passage be lifted and used as a direct answer?',
    checks: [
      'Question-shaped headings',
      'FAQ coverage and FAQPage markup',
      'Passage sizing — extractable paragraphs',
      'Lists and tables for structured information',
      'Explicit term definitions',
      'Comparison and alternatives content',
      'Front-loaded answers before elaboration',
      'Terminology alignment with customer language',
      'A quotable homepage summary sentence',
      'Process and how-to content',
    ],
  },
  {
    key: 'STRUCTURED_DATA' as const,
    icon: Braces,
    title: 'Structured Data',
    summary: 'Is there valid, reasonably complete schema markup — not just a token block?',
    checks: [
      'JSON-LD presence across pages',
      'Syntactic validity of every block',
      'Organization or LocalBusiness declaration',
      'Organization property completeness (logo, description, address, telephone, sameAs)',
      'sameAs profile links',
      'WebSite and BreadcrumbList schema',
      'Content-type schema: Article, BlogPosting, Service, Product, HowTo',
      'FAQPage markup on FAQ content',
      'Person and author schema',
      'Review and AggregateRating markup',
      'Agreement between schema name and the visible brand',
    ],
  },
  {
    key: 'TRUST_AND_EVIDENCE' as const,
    icon: BadgeCheck,
    title: 'Trust and Evidence',
    summary: 'Is there enough verifiable substance to treat the content as reliable?',
    checks: [
      'Published phone, email and postal address',
      'A dedicated contact page',
      'Named author attribution on content',
      'Stated credentials, licenses and expertise',
      'Outbound citations to authoritative sources',
      'Source transparency inside the prose',
      'Customer proof: case studies, testimonials, review markup',
      'Business legitimacy markers: privacy policy, terms, license number, founding date',
      'Clear attribution of content to the business',
      'Publication and update-date disclosure',
    ],
  },
  {
    key: 'COMPETITIVE_VISIBILITY' as const,
    icon: Target,
    title: 'Competitive Visibility',
    summary: 'How do your observable signals compare with the competitors you supply?',
    checks: [
      'Overall homepage signal comparison',
      'Structured-data coverage versus competitors',
      'Content depth versus competitors',
      'Answer-ready structure versus competitors',
      'Schema types competitors declare that you do not',
    ],
  },
];

const PLATFORM_FEATURES = [
  {
    icon: Gauge,
    title: 'Deterministic scoring',
    body: 'The same website content always produces the same scores. No randomization, no black box — every point traces to a recorded observation.',
  },
  {
    icon: FileText,
    title: 'Evidence panel on every finding',
    body: 'Each finding shows the exact values found: which URLs, which properties, which counts. You can verify any claim yourself in a browser.',
  },
  {
    icon: ShieldCheck,
    title: 'Safe, polite crawling',
    body: 'The crawler identifies itself, honors robots.txt, never submits forms, never authenticates and never executes downloaded files. Private networks are blocked at the socket level.',
  },
  {
    icon: Download,
    title: 'Branded PDF reports',
    body: 'A full PDF with cover page, category scorecards, findings, action plan, page-by-page observations and methodology — with page numbers and clean page breaks.',
  },
  {
    icon: History,
    title: 'Historical score tracking',
    body: 'Re-run an audit after making changes and see the score movement against your previous audit of the same domain. Included on Growth and Agency.',
  },
  {
    icon: Palette,
    title: 'White-label reports',
    body: 'Agency plans replace the RankInAI cover branding with a client name and logo, keeping a small "Powered by RankInAI" line in the footer.',
  },
  {
    icon: Table2,
    title: 'CSV export',
    body: 'Export findings and recommendations for your own reporting, tracking spreadsheets or client deliverables. Growth and Agency plans.',
  },
  {
    icon: Users,
    title: 'Team-ready architecture',
    body: 'The data model separates accounts, subscriptions, audits and reports so multi-seat access can be added without migrating your history.',
  },
];

export default function FeaturesPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="rk-hero-wash absolute inset-0" aria-hidden="true" />
        <div className="rk-container relative py-16 lg:py-20">
          <SectionHeading
            eyebrow="Features"
            title="Every check, and what each one is for"
            description="RankInAI runs roughly seventy deterministic checks across seven weighted categories. Below is what each category covers and the platform features around it."
          />
        </div>
      </section>

      <section className="rk-container py-16 lg:py-20">
        <div className="space-y-6">
          {AUDIT_CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <Card key={category.key} className="border-white/12 bg-ink-900/60 p-6 sm:p-8">
                <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:gap-10">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/12 text-cyan-300">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <span className="rounded-full border border-white/12 px-2.5 py-0.5 text-xs tabular-nums text-slate-400">
                        {Math.round(CATEGORY_WEIGHTS[category.key] * 100)}% of score
                      </span>
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-white">{category.title}</h2>
                    <p className="mt-2 text-[0.9375rem] leading-relaxed text-slate-400">
                      {category.summary}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      What is checked
                    </h3>
                    <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                      {category.checks.map((check) => (
                        <li
                          key={check}
                          className="flex gap-2.5 text-[0.8125rem] leading-relaxed text-slate-300"
                        >
                          <span
                            className="mt-1.5 size-1 shrink-0 rounded-full bg-violet-400"
                            aria-hidden="true"
                          />
                          {check}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="border-y border-white/10 bg-ink-900/40">
        <div className="rk-container py-16 lg:py-20">
          <SectionHeading
            eyebrow="Platform"
            title="Built to be used, not just looked at"
            description="The audit is the product, but the surrounding platform is what makes it usable week after week."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {PLATFORM_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="border-white/12 bg-ink-900/60 p-5">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-3.5 text-sm font-semibold text-white">{feature.title}</h3>
                  <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-slate-400">
                    {feature.body}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rk-container py-16 lg:py-20">
        <SectionHeading
          eyebrow="Optional enhancements"
          title="Two optional layers, clearly separated"
          description="The core audit works fully without either. When they are enabled, the report labels their output explicitly so you always know where a statement came from."
        />

        <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
          <Card className="border-white/12 bg-ink-900/60 p-6">
            <h3 className="text-sm font-semibold text-white">AI narrative enhancement</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
              When an OpenAI key is configured, a model rewrites executive summaries and
              explanations into clearer prose. It receives only already-computed scores and check
              outcomes — it never sees raw page content and can never change a score, a status or a
              piece of evidence. Enhanced text is marked <em>AI-enhanced</em> in the report.
            </p>
          </Card>

          <Card className="border-white/12 bg-ink-900/60 p-6">
            <h3 className="text-sm font-semibold text-white">Public-web search observations</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
              When a search provider is configured, RankInAI runs a small fixed set of queries
              (brand plus service, brand plus location, brand reviews) and reports what is publicly
              visible. These are labeled <em>public-web observations</em> and are never presented as
              evidence of what any particular AI model will say.
            </p>
          </Card>
        </div>
      </section>

      <CtaBand
        title="See the checks running on a real website"
        description="The free homepage preview runs twelve of these checks on your own site without an account."
        primaryLabel="Run the free preview"
        primaryHref="/demo"
        secondaryLabel="View the sample report"
        secondaryHref="/sample-report"
      />
    </>
  );
}
