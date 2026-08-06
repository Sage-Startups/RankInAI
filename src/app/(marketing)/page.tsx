import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Braces,
  Building2,
  FileSearch,
  Gauge,
  ListChecks,
  MessageSquareQuote,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';

import { Badge, Card, SectionHeading } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { InstantDemo } from '@/components/demo/instant-demo';
import { LivePreview } from '@/components/demo/live-preview';
import {
  ComparisonTable,
  CtaBand,
  FaqAccordion,
  PricingCards,
  Testimonials,
} from '@/components/site/marketing-blocks';
import { ScoreBar, ScoreRing } from '@/components/score/score-ring';
import { HOME_FAQS, SITE, absoluteUrl } from '@/lib/site-config';
import { CATEGORY_DESCRIPTIONS, CATEGORY_LABELS } from '@/lib/audit/types';
import { CATEGORY_ORDER, CATEGORY_WEIGHTS } from '@/lib/audit/scoring';
import { DEMO_LABEL, DEMO_MINI_REPORT } from '@/lib/demo/sample-audit';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'AI Visibility & GEO Audit Platform',
  description: SITE.description,
  alternates: { canonical: '/' },
};

const CATEGORY_ICONS = {
  TECHNICAL_ACCESSIBILITY: ScanSearch,
  ENTITY_CLARITY: Building2,
  CONTENT_AUTHORITY: BookOpenCheck,
  ANSWER_READINESS: MessageSquareQuote,
  STRUCTURED_DATA: Braces,
  TRUST_AND_EVIDENCE: BadgeCheck,
  COMPETITIVE_VISIBILITY: Target,
} as const;

const WORKFLOW = [
  {
    title: 'Enter your website',
    body: 'Add your URL, business name, services and up to five competitors. Confirm you are authorized to audit the site.',
    icon: FileSearch,
  },
  {
    title: 'RankInAI crawls and analyzes',
    body: 'A polite, identifiable crawler fetches up to 50 public pages, honors robots.txt and records evidence from each one.',
    icon: ScanSearch,
  },
  {
    title: 'Seven categories are scored',
    body: 'Around 70 deterministic checks produce evidence-backed scores. Same content in, same scores out — every time.',
    icon: Gauge,
  },
  {
    title: 'You get a prioritized plan',
    body: 'Every finding becomes an action grouped into Do first, Next 30 days and Longer-term, with example implementations.',
    icon: ListChecks,
  },
  {
    title: 'Track improvements over time',
    body: 'Re-run the audit after making changes and watch the score move. Historical tracking is included on Growth and Agency.',
    icon: TrendingUp,
  },
];

const CAPABILITIES = [
  'Crawl the site at all',
  'Understand what the company does',
  'Recognize its core entities and expertise',
  'Retrieve useful answer passages',
  'Trust its authorship and evidence',
  'Identify its products and services',
  'Associate the brand with relevant questions',
  'Cite or recommend its content',
];

export default async function HomePage() {
  const settings = await getSettings();

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: absoluteUrl('/'),
    description: SITE.description,
    offers: [
      {
        '@type': 'Offer',
        name: 'One-Time Full Audit',
        price: '49.00',
        priceCurrency: 'USD',
        url: absoluteUrl('/pricing'),
      },
      {
        '@type': 'Offer',
        name: 'Starter',
        price: '29.00',
        priceCurrency: 'USD',
        url: absoluteUrl('/pricing'),
      },
      {
        '@type': 'Offer',
        name: 'Growth',
        price: '79.00',
        priceCurrency: 'USD',
        url: absoluteUrl('/pricing'),
      },
      {
        '@type': 'Offer',
        name: 'Agency',
        price: '199.00',
        priceCurrency: 'USD',
        url: absoluteUrl('/pricing'),
      },
    ],
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: HOME_FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Static, developer-authored JSON-LD.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* 1. Announcement bar */}
      <div className="border-b border-white/10 bg-violet-600/12">
        <div className="rk-container flex items-center justify-center gap-2 py-2.5 text-center text-[0.8125rem] text-slate-200">
          <Sparkles className="size-4 shrink-0 text-cyan-300" aria-hidden="true" />
          <span>
            New: llms.txt detection and AI-crawler access checks are now part of every audit.
          </span>
          <Link
            href="/features"
            className="hidden font-medium text-cyan-300 underline underline-offset-4 hover:text-cyan-200 sm:inline"
          >
            See what changed
          </Link>
        </div>
      </div>

      {/* 3. Hero + 4. Instant demo */}
      <section className="relative overflow-hidden">
        <div className="rk-hero-wash absolute inset-0" aria-hidden="true" />
        <div className="rk-grid-lines absolute inset-0" aria-hidden="true" />
        <div className="rk-container relative py-16 lg:py-24">
          <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
            <div>
              <Badge tone="accent" className="border-violet-400/40 bg-violet-500/15 text-violet-200">
                AI visibility &amp; GEO audits
              </Badge>
              <h1 className="mt-5 text-[2.125rem] font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
                Find out whether AI can{' '}
                <span className="rk-gradient-text">understand and recommend</span> your business.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                RankInAI audits your website’s technical accessibility, entity clarity, content
                authority and answer readiness, then gives you a prioritized plan for improving
                AI-search visibility.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="#demo">
                    Run the Free Demo
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/25 text-white hover:bg-white/10"
                >
                  <Link href="/sample-report">View Sample Report</Link>
                </Button>
              </div>

              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-400" aria-hidden="true" />
                  Deterministic, evidence-based scoring
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-400" aria-hidden="true" />
                  No account needed for the demo
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-400" aria-hidden="true" />
                  One-time audits from $49
                </li>
              </ul>
            </div>

            <div id="demo" className="scroll-mt-24">
              {settings.demoModeEnabled ? (
                <InstantDemo />
              ) : (
                <Card className="border-white/12 bg-ink-900/70 p-8 text-center text-slate-300">
                  <p>The interactive demo is temporarily unavailable.</p>
                  <Button asChild className="mt-5">
                    <Link href="/sample-report">View the sample report instead</Link>
                  </Button>
                </Card>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Trust / value statement */}
      <section className="border-y border-white/10 bg-ink-900/50">
        <div className="rk-container py-12">
          <div className="grid gap-8 md:grid-cols-3">
            <ValueStat
              value="7"
              label="scored categories"
              body="Technical accessibility, entity clarity, content authority, answer readiness, structured data, trust and evidence, competitive visibility."
            />
            <ValueStat
              value="~70"
              label="deterministic checks"
              body="Every score traces to specific evidence found on your pages. Nothing is randomized, and re-running an audit on unchanged content returns the same score."
            />
            <ValueStat
              value="0"
              label="guarantees invented"
              body="RankInAI reports observed website signals and readiness. It never claims a specific AI assistant will mention or recommend your brand."
            />
          </div>
        </div>
      </section>

      {/* 6. What GEO is */}
      <section className="rk-container py-20 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              align="left"
              eyebrow="What we measure"
              title="Generative search reads your website differently"
              description="Traditional SEO optimizes for a ranked list of links. Generative engines assemble an answer from passages they can retrieve, understand and attribute. RankInAI evaluates the signals that determine whether AI systems can:"
            />
            <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
              {CAPABILITIES.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-300"
                >
                  <span
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cyan-400"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <Card className="border-white/12 bg-ink-900/60 p-6 sm:p-8">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-violet-300">
              How the overall score is built
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Each category is scored 0-100 from its own checks, then combined using fixed weights.
              If you supply no competitor, Competitive Visibility is marked unavailable and its
              weight is redistributed proportionally.
            </p>
            {/*
              `dt` and `dd` must be the only children of the wrapping `div`, so
              the weight and its bar both live inside the `dd`.
            */}
            <dl className="mt-6 space-y-3.5">
              {CATEGORY_ORDER.map((category) => (
                <div key={category}>
                  <dt className="text-[0.8125rem] text-slate-300">{CATEGORY_LABELS[category]}</dt>
                  <dd className="mt-1.5 flex items-center gap-3">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                        style={{ width: `${CATEGORY_WEIGHTS[category] * 100 * 5}%` }}
                      />
                    </span>
                    <span className="w-9 shrink-0 text-right text-[0.8125rem] font-semibold tabular-nums text-white">
                      {Math.round(CATEGORY_WEIGHTS[category] * 100)}%
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
            <Link
              href="/how-it-works#methodology"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-cyan-300 underline underline-offset-4 hover:text-cyan-200"
            >
              Read the full scoring methodology
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Card>
        </div>
      </section>

      {/* 7. Workflow */}
      <section className="border-y border-white/10 bg-ink-900/40">
        <div className="rk-container py-20 lg:py-24">
          <SectionHeading
            eyebrow="Product workflow"
            title="From URL to action plan in one pass"
            description="No browser extension, no tag to install, no access to your analytics. RankInAI reads your public website the way a search crawler does."
          />
          <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
            {WORKFLOW.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title}>
                  <Card className="h-full border-white/12 bg-ink-900/60 p-5">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                        <Icon className="size-4.5" aria-hidden="true" />
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-slate-400">
                        Step {index + 1}
                      </span>
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-white">{step.title}</h3>
                    <p className="mt-2 text-[0.8125rem] leading-relaxed text-slate-400">
                      {step.body}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* 8. Audit categories */}
      <section className="rk-container py-20 lg:py-24">
        <SectionHeading
          eyebrow="Audit categories"
          title="Seven categories, roughly seventy checks"
          description="Every check records what was actually found on your pages — the URL, the value, the count — so you can verify any finding yourself."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {CATEGORY_ORDER.map((category) => {
            const Icon = CATEGORY_ICONS[category];
            return (
              <Card key={category} className="border-white/12 bg-ink-900/60 p-6">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-cyan-500/12 text-cyan-300">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="rounded-full border border-white/12 px-2 py-0.5 text-xs tabular-nums text-slate-400">
                    {Math.round(CATEGORY_WEIGHTS[category] * 100)}% weight
                  </span>
                </div>
                <h3 className="mt-4 text-[0.9375rem] font-semibold text-white">
                  {CATEGORY_LABELS[category]}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {CATEGORY_DESCRIPTIONS[category]}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 9. Dashboard preview + 10. Report preview */}
      <section className="border-y border-white/10 bg-ink-900/40">
        <div className="rk-container py-20 lg:py-24">
          <SectionHeading
            eyebrow="Inside the product"
            title="A dashboard and report you can hand to a client"
            description="Score history, category scorecards, evidence panels and a downloadable PDF. Agency plans can replace the cover branding with their own."
          />

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <DashboardPreview />
            <ReportPreview />
          </div>
        </div>
      </section>

      {/* Free live preview */}
      <section className="rk-container py-20 lg:py-24">
        <SectionHeading
          eyebrow="Free live preview"
          title="Or point it at your own homepage right now"
          description="No account required. RankInAI fetches your homepage only and shows up to five findings so you can see the analysis working on real content."
        />
        <div className="mt-10">
          {settings.freePreviewEnabled ? (
            <LivePreview />
          ) : (
            <Card className="mx-auto max-w-3xl border-white/12 bg-ink-900/60 p-8 text-center text-slate-300">
              <p>The free preview is temporarily unavailable. The instant demo is still available.</p>
            </Card>
          )}
        </div>
      </section>

      {/* 11. Feature comparison */}
      <section className="border-y border-white/10 bg-ink-900/40">
        <div className="rk-container py-20 lg:py-24">
          <SectionHeading
            eyebrow="Compare plans"
            title="What each plan includes"
            description="Every plan runs the same audit engine and scores all seven categories. Plans differ in volume, crawl depth, competitors and branding."
          />
          <div className="mt-12">
            <ComparisonTable />
          </div>
        </div>
      </section>

      {/* 12. Pricing */}
      <section className="rk-container py-20 lg:py-24">
        <SectionHeading
          eyebrow="Pricing"
          title="Buy one audit, or subscribe"
          description="All prices in US dollars. Monthly billing only at launch — cancel from the billing portal at any time."
        />
        <div className="mt-12">
          <PricingCards />
        </div>
        <p className="mt-8 text-center text-sm text-slate-400">
          Need a higher volume than the Agency plan?{' '}
          <Link href="/contact" className="text-cyan-300 underline underline-offset-4">
            Talk to us
          </Link>
          .
        </p>
      </section>

      {/* 13. Testimonials */}
      <section className="border-y border-white/10 bg-ink-900/40">
        <div className="rk-container py-20 lg:py-24">
          <SectionHeading
            eyebrow="Feedback"
            title="What customers say"
            description="RankInAI is a young product. Rather than invent social proof, the quotes below are clearly marked as samples until real, attributed testimonials replace them."
          />
          <div className="mt-12">
            <Testimonials />
          </div>
        </div>
      </section>

      {/* 14. FAQ */}
      <section className="rk-container py-20 lg:py-24">
        <SectionHeading
          eyebrow="Questions"
          title="Frequently asked questions"
          description="Straight answers about what RankInAI measures, what it cannot promise, and how it treats your website."
        />
        <div className="mt-12">
          <FaqAccordion items={HOME_FAQS} />
        </div>
      </section>

      {/* 15. Final CTA */}
      <CtaBand
        title="See exactly what AI systems can and cannot learn about your business"
        description="Run the instant demo, try the free homepage preview, or buy a single complete audit for $49. No subscription required."
      />
    </>
  );
}

function ValueStat({ value, label, body }: { value: string; label: string; body: string }) {
  return (
    <div>
      <p className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight text-white">{value}</span>
        <span className="text-sm font-medium text-violet-300">{label}</span>
      </p>
      <p className="mt-2.5 text-sm leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}

function DashboardPreview() {
  const report = DEMO_MINI_REPORT;
  return (
    <Card className="overflow-hidden border-white/12 bg-ink-900/60">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
        <p className="text-sm font-medium text-slate-200">Dashboard overview</p>
        <Badge tone="demo">{DEMO_LABEL}</Badge>
      </div>
      <div className="p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Latest score" value="72" accent />
          <MiniStat label="Audits used" value="4 / 15" />
          <MiniStat label="One-time credits" value="2" />
          <MiniStat label="Open actions" value="8" />
        </div>

        <div className="mt-6 space-y-3">
          {report.categories.slice(0, 4).map((category) => (
            <div key={category.category}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="truncate text-[0.8125rem] text-slate-300">{category.label}</span>
                <span className="shrink-0 text-[0.8125rem] font-semibold tabular-nums text-white">
                  {category.score}
                </span>
              </div>
              <ScoreBar score={category.score} className="bg-white/10" />
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Recent audits
          </p>
          <ul className="mt-3 space-y-2.5 text-[0.8125rem]">
            {[
              { site: 'atlasroofingexteriors.example', score: 72, when: 'Today' },
              { site: 'summitpeakroofing.example', score: 68, when: '3 days ago' },
              { site: 'frontrangedental.example', score: 81, when: 'Last week' },
            ].map((row) => (
              <li key={row.site} className="flex items-center justify-between gap-3">
                <span className="truncate text-slate-300">{row.site}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-slate-400">{row.when}</span>
                  <span className="font-semibold tabular-nums text-white">{row.score}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

function ReportPreview() {
  return (
    <Card className="overflow-hidden border-white/12 bg-ink-900/60">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
        <p className="text-sm font-medium text-slate-200">Report preview</p>
        <Badge tone="demo">{DEMO_LABEL}</Badge>
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <ScoreRing score={72} size={116} showLabel={false} className="shrink-0" />
          <div className="min-w-0 text-center sm:text-left">
            <h3 className="text-base font-semibold text-white">
              Atlas Roofing &amp; Exteriors
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Denver, Colorado · 10 pages analyzed · April 2026
            </p>
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-slate-400">
              Reachable and trustworthy, but content is not structured for retrieval. Three critical
              gaps and eight prioritized actions.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2.5">
          {[
            { label: 'Do first', count: 3, tone: 'bg-red-500/15 text-red-300 border-red-500/25' },
            {
              label: 'Next 30 days',
              count: 3,
              tone: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
            },
            {
              label: 'Longer-term',
              count: 2,
              tone: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
            },
          ].map((group) => (
            <div
              key={group.label}
              className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm ${group.tone}`}
            >
              <span className="font-medium">{group.label}</span>
              <span className="tabular-nums">
                {group.count} {group.count === 1 ? 'action' : 'actions'}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Evidence sample
          </p>
          <pre tabIndex={0} className="mt-3 overflow-x-auto rounded bg-ink-950/70 p-3 text-[0.6875rem] leading-relaxed text-slate-300">
{`{
  "checkId": "schema.organization-completeness",
  "propertiesPresent": ["name", "url", "telephone", "address"],
  "valuableMissing": ["logo", "description", "sameAs", "areaServed"],
  "schemaValid": true
}`}
          </pre>
        </div>

        <Button asChild variant="secondary" className="mt-5 w-full">
          <Link href="/sample-report">
            Open the full sample report
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function MiniStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[0.6875rem] uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${accent ? 'text-cyan-300' : 'text-white'}`}
      >
        {value}
      </p>
    </div>
  );
}
