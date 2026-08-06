import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Alert, Badge, SectionHeading } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { ReportView } from '@/components/report/report-view';
import { CtaBand } from '@/components/site/marketing-blocks';
import { buildSampleReportData } from '@/lib/report/build';
import { DEMO_DISCLAIMER, DEMO_LABEL } from '@/lib/demo/sample-audit';

export const metadata: Metadata = {
  title: 'Sample report',
  description:
    'A complete RankInAI AI visibility audit report for a fictional US business, showing every section: scores, findings with evidence, competitor comparison and the prioritized action plan.',
  alternates: { canonical: '/sample-report' },
};

export default function SampleReportPage() {
  const data = buildSampleReportData();

  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="rk-hero-wash absolute inset-0" aria-hidden="true" />
        <div className="rk-container relative py-14 lg:py-16">
          <Badge tone="demo" className="mb-4">
            {DEMO_LABEL}
          </Badge>
          <SectionHeading
            align="left"
            eyebrow="Sample report"
            title="A complete audit report, start to finish"
            description="This is exactly what a paid RankInAI audit produces — every section, every finding, every piece of evidence. Only the business is fictional."
          />
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">
                Run this on your website
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/25 text-white hover:bg-white/10"
            >
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="bg-[var(--background)]">
        <div className="rk-container py-10 lg:py-14">
          <Alert
            tone="warning"
            title="Interactive sample using fictional demonstration data"
            className="mb-8"
          >
            {DEMO_DISCLAIMER} Every score, finding and figure below was authored for this
            demonstration.
          </Alert>

          <ReportView data={data} />
        </div>
      </div>

      <div className="bg-ink-950">
        <CtaBand
          title="Your report will look exactly like this — with your evidence"
          description="Every finding in a real audit is backed by values recorded from your own pages, so you can verify any claim in a browser."
          primaryLabel="Buy one audit for $49"
          primaryHref="/signup?plan=ONE_TIME_AUDIT"
          secondaryLabel="Try the free demo first"
          secondaryHref="/demo"
        />
      </div>
    </>
  );
}
