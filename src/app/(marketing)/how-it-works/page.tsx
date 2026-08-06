import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, FileSearch, Gauge, ListChecks, ScanSearch, TrendingUp } from 'lucide-react';

import { Alert, Card, SectionHeading } from '@/components/ui/primitives';
import { CtaBand } from '@/components/site/marketing-blocks';
import { CATEGORY_ORDER, CATEGORY_WEIGHTS } from '@/lib/audit/scoring';
import { CATEGORY_DESCRIPTIONS, CATEGORY_LABELS } from '@/lib/audit/types';
import { absoluteUrl } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'How a RankInAI audit runs: safe crawling, roughly seventy deterministic checks, weighted category scoring and a prioritized action plan.',
  alternates: { canonical: '/how-it-works' },
};

const STEPS = [
  {
    icon: FileSearch,
    title: 'Enter the website',
    body: 'Supply the URL, business name, industry, target audience, primary services, main location and up to five competitor URLs. You confirm you are authorized to audit the primary website.',
    detail: [
      'The URL is validated before anything leaves our servers: only http and https, no credentials in the address, no private or reserved network ranges, no cloud metadata endpoints.',
      'The extra business context is used to check terminology alignment — whether the words you use to describe your services actually appear on the site.',
    ],
  },
  {
    icon: ScanSearch,
    title: 'RankInAI crawls and analyzes it',
    body: 'A queued worker fetches robots.txt, your sitemap and llms.txt, then crawls up to 50 public pages depending on your plan, prioritizing the pages that matter most for AI visibility.',
    detail: [
      'The crawler identifies itself as RankInAI-Auditor and honors robots.txt rules for that agent.',
      'It never submits a form, never signs in, never executes a downloaded file and skips cart, checkout, account and login URLs entirely.',
      'Homepage, about, services, FAQ, contact, case studies and editorial pages are prioritized over deep or parameterized URLs.',
    ],
  },
  {
    icon: Gauge,
    title: 'The audit engine scores seven categories',
    body: 'Roughly seventy checks run against the collected evidence. Each check awards a fraction of its available points and records exactly what was found.',
    detail: [
      'Scoring is deterministic: the same page content always produces the same score. Nothing is randomized.',
      'Checks that cannot apply to a site are excluded from both the numerator and the denominator, so nothing is penalized unfairly.',
      'An optional AI enhancement can improve the wording of summaries — it can never change a score or alter observed evidence.',
    ],
  },
  {
    icon: ListChecks,
    title: 'It produces actionable recommendations',
    body: 'Every failing or partial check becomes an action, ordered by severity, then impact, then effort, and grouped into three horizons.',
    detail: [
      'Do first — high-impact fixes, most completable in a single working session.',
      'Next 30 days — meaningful improvements needing coordination or content work.',
      'Longer-term improvements — investments that compound, such as original research and deep service pages.',
    ],
  },
  {
    icon: TrendingUp,
    title: 'You track improvements over time',
    body: 'Re-run the audit after making changes. The report shows the score change against your previous audit of the same domain.',
    detail: [
      'Historical score tracking is included on Growth and Agency plans.',
      'Because scoring is deterministic, a score change reflects a real change on the site rather than measurement noise.',
    ],
  },
];

export default function HowItWorksPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'How it works', item: absoluteUrl('/how-it-works') },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <section className="relative overflow-hidden border-b border-white/10">
        <div className="rk-hero-wash absolute inset-0" aria-hidden="true" />
        <div className="rk-container relative py-16 lg:py-20">
          <SectionHeading
            eyebrow="How it works"
            title="From a URL to an evidence-backed action plan"
            description="RankInAI reads your public website the way a search crawler does, scores what it finds against a fixed rubric, and turns every gap into a specific change you can make."
          />
        </div>
      </section>

      <section className="rk-container py-16 lg:py-20">
        <ol className="space-y-6">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title}>
                <Card className="border-white/12 bg-ink-900/60 p-6 sm:p-8">
                  <div className="flex flex-col gap-6 sm:flex-row">
                    <div className="flex shrink-0 items-start gap-4">
                      <span className="flex size-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                        <Icon className="size-5.5" aria-hidden="true" />
                      </span>
                      <span className="text-2xl font-bold tabular-nums text-white/15 sm:hidden">
                        {index + 1}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-3">
                        <span className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 sm:inline">
                          Step {index + 1}
                        </span>
                      </div>
                      <h2 className="mt-1 text-lg font-semibold text-white">{step.title}</h2>
                      <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-slate-300">
                        {step.body}
                      </p>
                      <ul className="mt-4 space-y-2">
                        {step.detail.map((line) => (
                          <li
                            key={line}
                            className="flex gap-2.5 text-sm leading-relaxed text-slate-400"
                          >
                            <span
                              className="mt-2 size-1 shrink-0 rounded-full bg-cyan-400"
                              aria-hidden="true"
                            />
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>

      <section id="methodology" className="scroll-mt-24 border-y border-white/10 bg-ink-900/40">
        <div className="rk-container py-16 lg:py-20">
          <SectionHeading
            eyebrow="Methodology"
            title="How the overall score is calculated"
            description="Each category produces a 0-100 score from its own checks. The overall score is the weighted sum of the categories that could be measured."
          />

          <div className="mx-auto mt-10 max-w-3xl">
            <Card className="border-white/12 bg-ink-900/60 p-6 sm:p-8">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-violet-300">
                Category score
              </h3>
              <pre tabIndex={0} className="mt-3 overflow-x-auto rounded-lg bg-ink-950/70 p-4 text-[0.8125rem] leading-relaxed text-slate-300">
{`category_score = round(100 × Σ(points_awarded) / Σ(points_possible))

  — summed only over checks that apply to this website
  — a check that cannot apply is excluded from both sums`}
              </pre>

              <h3 className="mt-8 text-sm font-semibold uppercase tracking-[0.12em] text-violet-300">
                Overall score
              </h3>
              <pre tabIndex={0} className="mt-3 overflow-x-auto rounded-lg bg-ink-950/70 p-4 text-[0.8125rem] leading-relaxed text-slate-300">
{`overall = round( Σ category_score × effective_weight )

effective_weight = base_weight / Σ(base_weight of available categories)`}
              </pre>

              <table className="mt-8 w-full border-collapse text-left text-sm">
                <caption className="sr-only">Category base weights</caption>
                <thead>
                  <tr className="border-b border-white/12">
                    <th scope="col" className="pb-2.5 font-semibold text-white">
                      Category
                    </th>
                    <th scope="col" className="pb-2.5 text-right font-semibold text-white">
                      Base weight
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORY_ORDER.map((category) => (
                    <tr key={category} className="border-b border-white/6">
                      <th scope="row" className="py-2.5 font-normal text-slate-300">
                        {CATEGORY_LABELS[category]}
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {CATEGORY_DESCRIPTIONS[category]}
                        </span>
                      </th>
                      <td className="py-2.5 text-right align-top font-semibold tabular-nums text-white">
                        {Math.round(CATEGORY_WEIGHTS[category] * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Alert tone="info" className="mt-6 border-cyan-500/25 bg-cyan-500/[0.07]">
                <p className="font-medium text-white">Competitive Visibility rebalancing</p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed">
                  If you supply no competitor URL — or none can be reached — Competitive Visibility
                  is marked unavailable and its 5% weight is redistributed across the other six
                  categories in proportion to their base weights. The overall score always sits on
                  the same 0-100 scale.
                </p>
              </Alert>

              <p className="mt-6 text-sm text-slate-400">
                Worked examples, the full check list and every point allocation are documented in{' '}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-slate-200">
                  AUDIT_METHODOLOGY.md
                </code>{' '}
                in the product repository.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="rk-container py-16 lg:py-20">
        <SectionHeading
          eyebrow="Honest limits"
          title="What an audit can and cannot tell you"
          description="RankInAI measures observable website signals. It is important to be precise about what that does and does not prove."
        />

        <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
          <Card className="border-emerald-500/25 bg-emerald-500/[0.06] p-6">
            <h3 className="text-sm font-semibold text-emerald-300">What RankInAI does</h3>
            <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-300">
              <li>Measures signals directly from your website with recorded evidence</li>
              <li>Scores AI visibility readiness against a fixed, published rubric</li>
              <li>Tells you which specific changes may improve discoverability</li>
              <li>Compares your observable signals against competitors you supply</li>
              <li>Optionally reports publicly visible search results, clearly labeled as such</li>
            </ul>
          </Card>

          <Card className="border-red-500/25 bg-red-500/[0.06] p-6">
            <h3 className="text-sm font-semibold text-red-300">What no tool can do</h3>
            <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-300">
              <li>Guarantee that ChatGPT, Perplexity, Gemini or Copilot will mention your brand</li>
              <li>See inside any AI system’s training data, index or ranking logic</li>
              <li>Promise a position, a citation rate or a volume of referrals</li>
              <li>Measure how often you are currently mentioned inside a private AI product</li>
              <li>Replace the underlying work of publishing genuinely useful content</li>
            </ul>
          </Card>
        </div>

        <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-slate-400">
          Every report distinguishes clearly between signals measured directly from your website,
          optional public-web search observations, AI-generated interpretation and sample or demo
          information.
        </p>

        <div className="mt-8 text-center">
          <Link
            href="/features"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-300 underline underline-offset-4 hover:text-cyan-200"
          >
            See every check the audit runs
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <CtaBand
        title="Watch it run before you buy"
        description="The instant demo takes five seconds. The free homepage preview runs on your real website without an account."
        primaryLabel="Try the free demo"
        primaryHref="/demo"
        secondaryLabel="See pricing"
        secondaryHref="/pricing"
      />
    </>
  );
}
