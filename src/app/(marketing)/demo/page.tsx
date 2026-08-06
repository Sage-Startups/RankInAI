import type { Metadata } from 'next';
import Link from 'next/link';

import { Alert, Card, SectionHeading } from '@/components/ui/primitives';
import { InstantDemo } from '@/components/demo/instant-demo';
import { LivePreview } from '@/components/demo/live-preview';
import { CtaBand } from '@/components/site/marketing-blocks';
import { getSettings } from '@/lib/settings';
import { DEMO_DISCLAIMER } from '@/lib/demo/sample-audit';

export const metadata: Metadata = {
  title: 'Free demo',
  description:
    'Run the RankInAI demo instantly, or get a free limited AI visibility preview of your own homepage. No account required.',
  alternates: { canonical: '/demo' },
};

export default async function DemoPage() {
  const settings = await getSettings();

  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="rk-hero-wash absolute inset-0" aria-hidden="true" />
        <div className="rk-grid-lines absolute inset-0" aria-hidden="true" />
        <div className="rk-container relative py-16 lg:py-20">
          <SectionHeading
            eyebrow="Free demo"
            title="Two ways to see RankInAI working"
            description="Watch a full audit on a fictional company, or point the analyzer at your own homepage. Neither requires an account or a credit card."
          />
        </div>
      </section>

      <section className="rk-container py-16 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
          <div>
            <h2 className="text-xl font-semibold text-white">1. Instant sample demo</h2>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-slate-400">
              A complete, pre-generated audit for a fictional US roofing contractor. It shows the
              overall score, all seven category scores, three strengths, three high-priority
              problems, the recommended next action and a competitor comparison — in about five
              seconds.
            </p>
            <Alert tone="warning" className="mt-6">
              {DEMO_DISCLAIMER}
            </Alert>

            <Card className="bg-ink-900/60 mt-6 border-white/12 p-5">
              <h3 className="text-sm font-semibold text-white">What the demo is showing you</h3>
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-400">
                <li>
                  The exact report structure a paid audit produces, with the same categories and
                  weights.
                </li>
                <li>
                  How findings are framed: what was observed, why it matters and what to change.
                </li>
                <li>How the action plan is prioritized by severity, impact and effort.</li>
              </ul>
              <p className="mt-4 text-sm text-slate-400">
                Want the full version?{' '}
                <Link href="/sample-report" className="text-cyan-300 underline underline-offset-4">
                  Open the complete sample report
                </Link>
                .
              </p>
            </Card>
          </div>

          <div>
            {settings.demoModeEnabled ? (
              <InstantDemo size="full" />
            ) : (
              <Card className="bg-ink-900/60 border-white/12 p-8 text-center text-slate-300">
                <p>The interactive demo is temporarily unavailable.</p>
              </Card>
            )}
          </div>
        </div>
      </section>

      <section className="bg-ink-900/40 border-y border-white/10">
        <div className="rk-container py-16 lg:py-20">
          <SectionHeading
            eyebrow="Free live preview"
            title="2. Analyze your own homepage"
            description="Enter a public website address and RankInAI will fetch the homepage and run twelve real checks against it. This is a limited preview — the full audit crawls up to 50 pages and scores all seven categories."
          />

          <div className="mt-10">
            {settings.freePreviewEnabled ? (
              <LivePreview />
            ) : (
              <Card className="bg-ink-900/60 mx-auto max-w-3xl border-white/12 p-8 text-center text-slate-300">
                <p>The free preview is temporarily unavailable. Please try again later.</p>
              </Card>
            )}
          </div>

          <div className="mx-auto mt-10 max-w-3xl">
            <Card className="bg-ink-900/60 border-white/12 p-5">
              <h3 className="text-sm font-semibold text-white">How the preview treats your site</h3>
              <ul className="mt-3 space-y-2 text-[0.8125rem] leading-relaxed text-slate-400">
                <li>Fetches one page — your homepage — and nothing else.</li>
                <li>
                  Identifies itself as RankInAI-Auditor, never submits a form and never signs in.
                </li>
                <li>
                  Stores only hashed operational metadata (domain, a hashed client identifier, the
                  score and timing). No page content is retained.
                </li>
                <li>Rate limited per visitor to keep the service available for everyone.</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      <CtaBand
        title="Ready for the full picture?"
        description="A complete audit crawls up to 50 pages, scores all seven categories with evidence for every finding, compares up to five competitors and produces a downloadable PDF."
        primaryLabel="Buy one audit for $49"
        primaryHref="/signup?plan=ONE_TIME_AUDIT"
        secondaryLabel="Compare plans"
        secondaryHref="/pricing"
      />
    </>
  );
}
