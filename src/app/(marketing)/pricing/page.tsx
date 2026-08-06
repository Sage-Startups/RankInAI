import type { Metadata } from 'next';
import Link from 'next/link';
import { CreditCard, RefreshCw, ShieldCheck } from 'lucide-react';

import { Card, SectionHeading } from '@/components/ui/primitives';
import {
  ComparisonTable,
  CtaBand,
  FaqAccordion,
  PricingCards,
} from '@/components/site/marketing-blocks';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'RankInAI pricing in US dollars. One complete AI visibility audit for $49, or monthly plans from $29. Compare Starter, Growth and Agency.',
  alternates: { canonical: '/pricing' },
};

const PRICING_FAQS = [
  {
    question: 'How does the audit allowance work?',
    answer:
      'Each monthly plan includes a fixed number of full audits per billing period — 3 on Starter, 15 on Growth and 60 on Agency. The allowance resets when Stripe renews your subscription. Unused audits do not roll over.',
  },
  {
    question: 'What happens when I run out of audits mid-month?',
    answer:
      'You can buy a $49 one-time audit credit at any time, including while subscribed. One-time credits never expire and are only consumed after your plan allowance is used up.',
  },
  {
    question: 'Is the one-time audit the same audit as the subscription plans?',
    answer:
      'Yes. It runs the same engine, scores all seven categories and produces the same report and PDF. It crawls up to 10 pages and compares one competitor, matching the Starter limits.',
  },
  {
    question: 'Can I change plans?',
    answer:
      'Yes. Upgrade or downgrade from the billing page at any time through the Stripe Customer Portal. Changing plans resets your period allowance to the new tier, and Stripe prorates the charge.',
  },
  {
    question: 'Do you offer annual billing?',
    answer:
      'Not at launch. All plans are billed monthly in US dollars. If annual billing would help your team, tell us on the contact page — it is on the roadmap.',
  },
  {
    question: 'What counts as a competitor?',
    answer:
      'Any public website you want compared against yours. RankInAI fetches a single public homepage from each competitor and compares the same homepage-level signals. It does not crawl a competitor’s site in depth.',
  },
  {
    question: 'Can I white-label reports for my clients?',
    answer:
      'Agency plans can replace the RankInAI cover branding with your business name and logo. A small "Powered by RankInAI" line remains in the report footer.',
  },
  {
    question: 'What is your refund policy?',
    answer:
      'If an audit fails to complete, the credit is automatically returned to your account and no manual request is needed. For other refund situations, see the Refund Policy — requests within 14 days of purchase are reviewed case by case.',
  },
];

export default function PricingPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="rk-hero-wash absolute inset-0" aria-hidden="true" />
        <div className="rk-container relative py-16 lg:py-20">
          <SectionHeading
            eyebrow="Pricing"
            title="Straightforward pricing in US dollars"
            description="Start with one audit for $49, or subscribe if you audit regularly. Every option runs the same deterministic audit engine and produces the same evidence-backed report."
          />
        </div>
      </section>

      <section className="rk-container py-16 lg:py-20">
        <PricingCards />

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <BillingNote
            icon={CreditCard}
            title="Monthly billing only at launch"
            body="All subscriptions renew monthly in US dollars. Annual billing is not offered yet."
          />
          <BillingNote
            icon={RefreshCw}
            title="Cancel from the portal"
            body="Manage or cancel your subscription yourself through the Stripe Customer Portal. Access continues until the end of the paid period."
          />
          <BillingNote
            icon={ShieldCheck}
            title="Failed audits are refunded automatically"
            body="If an audit fails before producing results, the credit returns to your account without a support request."
          />
        </div>
      </section>

      <section className="bg-ink-900/40 border-y border-white/10">
        <div className="rk-container py-16 lg:py-20">
          <SectionHeading
            eyebrow="Compare"
            title="Full feature comparison"
            description="Plans differ in volume, crawl depth, competitor count and branding — not in the quality of the analysis."
          />
          <div className="mt-10">
            <ComparisonTable />
          </div>
        </div>
      </section>

      <section className="rk-container py-16 lg:py-20">
        <SectionHeading
          eyebrow="Billing questions"
          title="Pricing FAQ"
          description="How allowances, credits, plan changes and refunds work."
        />
        <div className="mt-10">
          <FaqAccordion items={PRICING_FAQS} />
        </div>

        <Card className="bg-ink-900/60 mx-auto mt-8 max-w-3xl border-white/12 p-6">
          <h2 className="text-sm font-semibold text-white">Billing terms</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-400">
            <li>
              All prices are in US dollars and exclude any sales tax or VAT that may apply in your
              jurisdiction. Applicable tax is calculated at checkout.
            </li>
            <li>
              Subscriptions renew automatically each month until canceled. You can cancel at any
              time and keep access until the end of the paid period.
            </li>
            <li>
              One-time audit credits do not expire and are consumed only after any subscription
              allowance for the period has been used.
            </li>
            <li>
              Payments are processed by Stripe. RankInAI never receives or stores your card details.
            </li>
          </ul>
          <p className="mt-4 text-sm text-slate-400">
            Read the full{' '}
            <Link href="/legal/refunds" className="text-cyan-300 underline underline-offset-4">
              Refund Policy
            </Link>{' '}
            and{' '}
            <Link href="/legal/terms" className="text-cyan-300 underline underline-offset-4">
              Terms of Service
            </Link>
            .
          </p>
        </Card>
      </section>

      <CtaBand
        title="Not sure yet? Run the demo first."
        description="The instant demo and the free homepage preview both work without an account, so you can see the analysis before spending anything."
        primaryLabel="Try the free demo"
        primaryHref="/demo"
        secondaryLabel="View the sample report"
        secondaryHref="/sample-report"
      />
    </>
  );
}

function BillingNote({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  body: string;
}) {
  return (
    <Card className="bg-ink-900/60 border-white/12 p-5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <h3 className="mt-3.5 text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-slate-400">{body}</p>
    </Card>
  );
}
