import Link from 'next/link';
import { Check, Minus } from 'lucide-react';

import { Badge, Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { COMPARISON_ROWS, ALL_PRODUCTS, type PricedProduct } from '@/lib/plans';
import { formatUsd, cn } from '@/lib/utils';
import { SAMPLE_TESTIMONIALS, TESTIMONIAL_NOTICE } from '@/lib/site-config';

/** Shared marketing sections used by the home, pricing and features pages. */

export function PricingCards({
  ctaHref = '/signup',
  highlightPopular = true,
}: {
  ctaHref?: string;
  highlightPopular?: boolean;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-4">
      {ALL_PRODUCTS.map((product) => (
        <PricingCard
          key={product.key}
          product={product}
          ctaHref={`${ctaHref}?plan=${product.key}`}
          highlight={highlightPopular && Boolean(product.mostPopular)}
        />
      ))}
    </div>
  );
}

export function PricingCard({
  product,
  ctaHref,
  highlight,
}: {
  product: PricedProduct;
  ctaHref: string;
  highlight: boolean;
}) {
  return (
    <Card
      className={cn(
        'relative flex flex-col border-white/12 bg-ink-900/60 text-slate-200',
        highlight && 'border-violet-500/50 shadow-lg shadow-violet-900/30 ring-1 ring-violet-500/30',
      )}
    >
      {highlight ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white">
          Most Popular
        </span>
      ) : null}

      <div className="p-6">
        <h3 className="text-base font-semibold text-white">{product.name}</h3>
        <p className="mt-1.5 min-h-10 text-sm leading-relaxed text-slate-400">{product.tagline}</p>

        <p className="mt-5 flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tracking-tight text-white">
            {formatUsd(product.priceCents)}
          </span>
          <span className="text-sm text-slate-400">
            {product.interval === 'one_time' ? 'once' : '/ month'}
          </span>
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {product.interval === 'one_time'
            ? 'Single audit, no subscription'
            : 'Billed monthly in US dollars · cancel anytime'}
        </p>

        <Button asChild className="mt-5 w-full" variant={highlight ? 'primary' : 'secondary'}>
          <Link href={ctaHref}>
            {product.interval === 'one_time' ? 'Buy one audit' : `Choose ${product.name}`}
          </Link>
        </Button>
      </div>

      <div className="mt-auto border-t border-white/10 p-6">
        <ul className="space-y-2.5">
          {product.features.map((feature) => (
            <li key={feature} className="flex gap-2.5 text-[0.8125rem] leading-relaxed text-slate-300">
              <Check className="mt-0.5 size-4 shrink-0 text-violet-400" aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

export function ComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/12">
      <table className="w-full min-w-3xl border-collapse text-left text-sm">
        <caption className="sr-only">Feature comparison across RankInAI plans</caption>
        <thead>
          <tr className="bg-white/[0.04]">
            <th scope="col" className="px-5 py-4 font-semibold text-white">
              Feature
            </th>
            <th scope="col" className="px-5 py-4 font-semibold text-white">
              One-Time Audit
            </th>
            <th scope="col" className="px-5 py-4 font-semibold text-white">
              Starter
            </th>
            <th scope="col" className="px-5 py-4 font-semibold text-violet-300">
              Growth
            </th>
            <th scope="col" className="px-5 py-4 font-semibold text-white">
              Agency
            </th>
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((row, index) => (
            <tr
              key={row.label}
              className={cn('border-t border-white/8', index % 2 === 1 && 'bg-white/[0.015]')}
            >
              <th scope="row" className="px-5 py-3.5 font-medium text-slate-200">
                {row.label}
              </th>
              <ComparisonCell value={row.oneTime} />
              <ComparisonCell value={row.starter} />
              <ComparisonCell value={row.growth} />
              <ComparisonCell value={row.agency} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComparisonCell({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return (
      <td className="px-5 py-3.5">
        {value ? (
          <>
            <Check className="size-4 text-emerald-400" aria-hidden="true" />
            <span className="sr-only">Included</span>
          </>
        ) : (
          <>
            <Minus className="size-4 text-slate-600" aria-hidden="true" />
            <span className="sr-only">Not included</span>
          </>
        )}
      </td>
    );
  }
  return <td className="px-5 py-3.5 text-slate-300">{value}</td>;
}

export function Testimonials() {
  return (
    <div>
      <div className="grid gap-5 md:grid-cols-3">
        {SAMPLE_TESTIMONIALS.map((testimonial) => (
          <Card key={testimonial.quote} className="border-white/12 bg-ink-900/60 p-6">
            <Badge tone="demo" className="mb-4">
              Sample
            </Badge>
            <blockquote className="text-[0.9375rem] leading-relaxed text-slate-200">
              “{testimonial.quote}”
            </blockquote>
            <footer className="mt-4 text-sm">
              <p className="font-medium text-white">{testimonial.name}</p>
              <p className="text-slate-400">{testimonial.role}</p>
            </footer>
          </Card>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-slate-400">
        {TESTIMONIAL_NOTICE}
      </p>
    </div>
  );
}

export function FaqAccordion({
  items,
  className,
}: {
  items: Array<{ question: string; answer: string }>;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto max-w-3xl divide-y divide-white/10 rounded-xl border border-white/12', className)}>
      {items.map((item) => (
        <details key={item.question} className="group px-5 py-4 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[0.9375rem] font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ring)]">
            {item.question}
            <span
              className="shrink-0 text-slate-400 transition-transform group-open:rotate-45"
              aria-hidden="true"
            >
              +
            </span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function CtaBand({
  title,
  description,
  primaryHref = '/signup',
  primaryLabel = 'Run your first audit',
  secondaryHref = '/demo',
  secondaryLabel = 'Try the free demo',
}: {
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="rk-container pb-24">
      <div className="rk-hero-wash relative overflow-hidden rounded-2xl border border-white/12 px-6 py-14 text-center sm:px-12">
        <h2 className="mx-auto max-w-2xl text-2xl font-semibold text-white sm:text-3xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-[0.9375rem] leading-relaxed text-slate-300">
          {description}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={primaryHref}>{primaryLabel}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-white/25 text-white hover:bg-white/10">
            <Link href={secondaryHref}>{secondaryLabel}</Link>
          </Button>
        </div>
        <p className="mt-6 text-xs text-slate-400">
          One-time audits from $49. Monthly plans from $29. All prices in US dollars.
        </p>
      </div>
    </section>
  );
}
