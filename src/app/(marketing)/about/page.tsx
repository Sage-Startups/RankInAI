import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, SectionHeading } from '@/components/ui/primitives';
import { CtaBand } from '@/components/site/marketing-blocks';
import { SITE, absoluteUrl } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'About',
  description:
    'RankInAI is a focused software product for auditing AI visibility and Generative Engine Optimization readiness. Here is what it is, what it is not, and how it is built.',
  alternates: { canonical: '/about' },
};

const PRINCIPLES = [
  {
    title: 'Evidence before opinion',
    body: 'Every score traces to a specific observation recorded from your pages — a URL, a property, a count. If we cannot show you the evidence, we do not score it.',
  },
  {
    title: 'Deterministic, not vibes',
    body: 'The audit engine is rule-based. The same website content always produces the same score. An audit you run twice on an unchanged site returns identical numbers.',
  },
  {
    title: 'Honest about limits',
    body: 'RankInAI measures readiness for AI visibility. It cannot see inside any AI system, and it never claims a specific assistant will mention or recommend you. Anyone promising that is guessing.',
  },
  {
    title: 'Respectful of the sites we read',
    body: 'The crawler identifies itself, honors robots.txt, requests only public pages, never submits forms and never signs in. It reads your site the way a search crawler does.',
  },
];

export default function AboutPage() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.name,
    url: absoluteUrl('/'),
    description: SITE.shortDescription,
    logo: absoluteUrl('/icon'),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />

      <section className="relative overflow-hidden border-b border-white/10">
        <div className="rk-hero-wash absolute inset-0" aria-hidden="true" />
        <div className="rk-container relative py-16 lg:py-20">
          <SectionHeading
            eyebrow="About"
            title="A focused tool for one specific problem"
            description="RankInAI exists to answer a question that traditional SEO tooling was not built for: can an AI system find this business, understand what it does, and safely say something accurate about it?"
          />
        </div>
      </section>

      <section className="rk-container py-16 lg:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="rk-prose text-slate-300">
            <h2 className="text-white">Why this product exists</h2>
            <p>
              A growing share of commercial questions never reach a results page. Someone asks an
              assistant which roofer to call, which accountant handles freelancers, or which
              supplier ships to their state — and gets a composed answer built from passages the
              system could retrieve and attribute.
            </p>
            <p>
              That changes what a website has to do. It is no longer enough to rank; the content has
              to be reachable, unambiguous about who published it, structured so individual passages
              stand alone, and specific enough to be worth quoting. Most business websites were not
              built that way, and most audit tools do not check for it.
            </p>
            <p>RankInAI checks for exactly that, and tells you what to change.</p>

            <h2 className="text-white">What RankInAI is</h2>
            <p>
              A self-serve web application. You enter a website, it crawls the public pages, runs
              roughly seventy deterministic checks across seven weighted categories, and produces a
              scored report with a prioritized action plan and a downloadable PDF. Agencies can
              white-label the report for clients.
            </p>

            <h2 className="text-white">What RankInAI is not</h2>
            <p>
              It is not a rank tracker, a content generator, or a service that claims privileged
              access to any AI system. It has no relationship with OpenAI, Perplexity, Google,
              Anthropic or Microsoft, and it cannot see inside their products. It measures what is
              publicly observable on your website — which is the part you actually control.
            </p>
            <p>
              It is also a young product built by a small operation. There is no large team behind
              it, no venture funding, no awards and no partnership logos, and we would rather say so
              plainly than pad the page with things that are not true.
            </p>

            <h2 className="text-white">How it is built</h2>
            <p>
              A Next.js application with a PostgreSQL database, a separate worker process that runs
              audits from a database-backed queue, and Stripe for payments. The audit engine is
              plain, testable code — no model call sits between your website and your score. An
              optional language model can improve the wording of summaries, but it never sees raw
              page content and never changes a score.
            </p>
            <p>
              The full scoring methodology is documented and published, because a score you cannot
              interrogate is not worth much.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-ink-900/40 border-y border-white/10">
        <div className="rk-container py-16 lg:py-20">
          <SectionHeading
            eyebrow="Principles"
            title="How we decide what goes in the product"
            description="Four rules that settle most product arguments before they start."
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {PRINCIPLES.map((principle) => (
              <Card key={principle.title} className="bg-ink-900/60 border-white/12 p-6">
                <h3 className="text-sm font-semibold text-white">{principle.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{principle.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="rk-container py-16 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-xl font-semibold text-white">Questions, feedback or a bug?</h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-slate-400">
            The contact form goes to a real inbox. If a check produced a result you think is wrong,
            send the URL and the finding — corrections to the audit engine are the highest-priority
            work there is.
          </p>
          <p className="mt-5">
            <Link
              href="/contact"
              className="text-sm font-medium text-cyan-300 underline underline-offset-4 hover:text-cyan-200"
            >
              Get in touch
            </Link>
          </p>
        </div>
      </section>

      <CtaBand
        title="See it work on a real website"
        description="The free homepage preview runs on your own site in seconds, without an account."
        primaryLabel="Try the free preview"
        primaryHref="/demo"
        secondaryLabel="Read the methodology"
        secondaryHref="/how-it-works#methodology"
      />
    </>
  );
}
