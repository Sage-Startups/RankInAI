import {
  AlertTriangle,
  BadgeCheck,
  Check,
  CircleDot,
  ExternalLink,
  Info,
  Minus,
  Sparkles,
  X,
} from 'lucide-react';

import { Alert, Badge, Card, Separator } from '@/components/ui/primitives';
import { ScoreBar, ScoreRing } from '@/components/score/score-ring';
import { CATEGORY_DESCRIPTIONS, SEVERITY_LABELS } from '@/lib/audit/types';
import { HORIZON_DESCRIPTIONS, HORIZON_LABELS } from '@/lib/audit/recommendations';
import { METHODOLOGY_SUMMARY, REPORT_LIMITATIONS, type ReportData } from '@/lib/report/types';
import { DEMO_LABEL } from '@/lib/demo/sample-audit';
import { cn, formatDate, scoreBandLabel } from '@/lib/utils';
import { overallScoreInterpretation } from '@/lib/audit/scoring';

/**
 * Full HTML report.
 *
 * Server component — no client-side state. Section order matches the PDF so a
 * customer reading either sees the same document.
 */

const SEVERITY_TONE = {
  CRITICAL: 'danger',
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'info',
  PASSED: 'success',
  INFORMATIONAL: 'neutral',
} as const;

const HORIZON_STYLES = {
  DO_FIRST: 'border-red-500/30 bg-red-500/[0.06]',
  NEXT_30_DAYS: 'border-amber-500/30 bg-amber-500/[0.06]',
  LONGER_TERM: 'border-cyan-500/30 bg-cyan-500/[0.06]',
} as const;

export function ReportView({ data }: { data: ReportData }) {
  const doFirst = data.recommendations.filter((r) => r.horizon === 'DO_FIRST');
  const next30 = data.recommendations.filter((r) => r.horizon === 'NEXT_30_DAYS');
  const longer = data.recommendations.filter((r) => r.horizon === 'LONGER_TERM');

  return (
    <article className="space-y-10">
      {data.isDemo ? (
        <Alert tone="warning" title={`${DEMO_LABEL} — fictional demonstration report`}>
          Every figure in this report is invented for product demonstration. {data.businessName} is
          not a real company, and no website was audited to produce these results.
        </Alert>
      ) : null}

      <ReportCover data={data} />
      <ExecutiveSummary data={data} />
      <CategoryScores data={data} />
      <StrengthsAndWeaknesses data={data} />

      {data.categories
        .filter((c) => c.available)
        .map((category) => (
          <CategorySection
            key={category.category}
            data={data}
            categoryKey={category.category}
            label={category.label}
            score={category.score}
            summary={category.summary}
          />
        ))}

      <CompetitorSection data={data} />
      {data.searchObservations.length > 0 ? <SearchSection data={data} /> : null}
      <ActionPlan doFirst={doFirst} next30={next30} longer={longer} />
      <PageObservations data={data} />
      <MethodologySection data={data} />
      <LimitationsSection />
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* 1-3. Cover, business, date                                                  */
/* -------------------------------------------------------------------------- */

function ReportCover({ data }: { data: ReportData }) {
  return (
    <Card className="overflow-hidden border-[var(--border)]" id="cover">
      <div className="rk-hero-wash border-b border-[var(--border)] bg-ink-950 px-6 py-8 text-white sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {data.branding.whiteLabel && data.branding.companyName ? (
              <p className="text-lg font-bold tracking-tight">{data.branding.companyName}</p>
            ) : (
              <p className="text-lg font-bold tracking-tight">
                Rank<span className="text-violet-400">In</span>
                <span className="text-cyan-400">AI</span>
              </p>
            )}
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
              AI Visibility &amp; GEO Audit Report
            </p>
          </div>
          {data.isDemo ? <Badge tone="demo">{DEMO_LABEL}</Badge> : null}
        </div>

        <h1 className="mt-7 text-2xl font-bold sm:text-3xl">{data.businessName}</h1>
        <p className="mt-1.5 break-all text-sm text-slate-300">{data.websiteUrl}</p>

        <dl className="mt-6 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <CoverField label="Audit date" value={formatDate(data.auditDate, 'long')} />
          <CoverField label="Pages analyzed" value={String(data.pagesCrawled)} />
          <CoverField label="Industry" value={data.industry ?? 'Not specified'} />
          <CoverField label="Target market" value={data.targetCountry} />
        </dl>
      </div>

      <div className="flex flex-col items-center gap-8 p-6 sm:flex-row sm:p-8">
        <ScoreRing score={data.overallScore} size={168} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">
            Overall AI Visibility Score: {data.overallScore}/100 ({scoreBandLabel(data.overallScore)})
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-[var(--muted-foreground)]">
            {overallScoreInterpretation(data.overallScore)}
          </p>
          {data.previousScore != null ? (
            <p className="mt-3 text-sm">
              <span className="text-[var(--muted-foreground)]">Previous audit:</span>{' '}
              <strong className="tabular-nums">{data.previousScore}</strong>{' '}
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  data.overallScore >= data.previousScore
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400',
                )}
              >
                ({data.overallScore >= data.previousScore ? '+' : ''}
                {data.overallScore - data.previousScore})
              </span>
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function CoverField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-white">{value}</dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Executive summary                                                        */
/* -------------------------------------------------------------------------- */

function ExecutiveSummary({ data }: { data: ReportData }) {
  return (
    <section id="summary">
      <SectionTitle number="1" title="Executive summary" />
      <Card className="p-6">
        <p className="text-[0.9375rem] leading-relaxed text-[var(--foreground)]">
          {data.executiveSummary}
        </p>
        {data.llmEnhanced ? (
          <p className="mt-4 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <Sparkles className="size-3.5 text-violet-500" aria-hidden="true" />
            This summary was rewritten for clarity by {data.llmModel ?? 'an AI model'} on{' '}
            {formatDate(data.llmGeneratedAt, 'datetime')}. Scores and evidence are computed by the
            rule-based audit engine and were not altered.
          </p>
        ) : null}
      </Card>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 5-6. Scores                                                                 */
/* -------------------------------------------------------------------------- */

function CategoryScores({ data }: { data: ReportData }) {
  return (
    <section id="scores">
      <SectionTitle number="2" title="Category scores" />
      <div className="grid gap-4 sm:grid-cols-2">
        {data.categories.map((category) => (
          <Card key={category.category} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">{category.label}</h3>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  {Math.round(category.effectiveWeight * 100)}% of the overall score
                  {category.available ? '' : ' · not measured'}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 text-2xl font-bold tabular-nums',
                  category.available ? '' : 'text-[var(--muted-foreground)]',
                )}
              >
                {category.available ? category.score : '—'}
              </span>
            </div>
            <ScoreBar score={category.score} available={category.available} className="mt-3" />
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-[var(--muted-foreground)]">
              {category.summary}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 7-8. Strengths and weaknesses                                               */
/* -------------------------------------------------------------------------- */

function StrengthsAndWeaknesses({ data }: { data: ReportData }) {
  return (
    <section id="highlights">
      <SectionTitle number="3" title="Key strengths and critical weaknesses" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-emerald-500/30 bg-emerald-500/[0.05] p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            <BadgeCheck className="size-4" aria-hidden="true" />
            Key strengths
          </h3>
          <ul className="mt-3 space-y-2.5">
            {data.strengths.length > 0 ? (
              data.strengths.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm leading-relaxed">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden="true" />
                  {item}
                </li>
              ))
            ) : (
              <li className="text-sm text-[var(--muted-foreground)]">
                No checks passed with enough weight to be listed as a headline strength.
              </li>
            )}
          </ul>
        </Card>

        <Card className="border-red-500/30 bg-red-500/[0.05] p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
            <AlertTriangle className="size-4" aria-hidden="true" />
            Critical weaknesses
          </h3>
          <ul className="mt-3 space-y-2.5">
            {data.weaknesses.length > 0 ? (
              data.weaknesses.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm leading-relaxed">
                  <X className="mt-0.5 size-4 shrink-0 text-red-500" aria-hidden="true" />
                  {item}
                </li>
              ))
            ) : (
              <li className="text-sm text-[var(--muted-foreground)]">
                No failing checks were found. Remaining opportunities are refinements.
              </li>
            )}
          </ul>
        </Card>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 9-14. Per-category detail                                                   */
/* -------------------------------------------------------------------------- */

function CategorySection({
  data,
  categoryKey,
  label,
  score,
  summary,
}: {
  data: ReportData;
  categoryKey: ReportData['categories'][number]['category'];
  label: string;
  score: number;
  summary: string;
}) {
  const findings = data.findings.filter((f) => f.category === categoryKey);
  if (findings.length === 0) return null;

  return (
    <section id={`category-${categoryKey.toLowerCase()}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{label}</h2>
        <span className="text-sm text-[var(--muted-foreground)]">
          Score <strong className="tabular-nums text-[var(--foreground)]">{score}</strong>/100
        </span>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-[var(--muted-foreground)]">
        {CATEGORY_DESCRIPTIONS[categoryKey]} {summary}
      </p>
      <div className="space-y-3">
        {findings.map((finding) => (
          <FindingCard key={finding.id} finding={finding} />
        ))}
      </div>
    </section>
  );
}

export function FindingCard({ finding }: { finding: ReportData['findings'][number] }) {
  const evidenceEntries = Object.entries(finding.evidence ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && value !== '',
  );

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusIcon status={finding.status} />
            <h3 className="text-sm font-semibold">{finding.title}</h3>
          </div>
          <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{finding.checkId}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Badge tone={SEVERITY_TONE[finding.severity]}>{SEVERITY_LABELS[finding.severity]}</Badge>
          {finding.source === 'AI_ENHANCED' ? <Badge tone="accent">AI-enhanced</Badge> : null}
          {finding.source === 'SEARCH_OBSERVATION' ? (
            <Badge tone="info">Public-web observation</Badge>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
        {finding.explanation}
      </p>

      {finding.status !== 'PASS' ? (
        <div className="mt-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Recommended action
          </p>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed">
            {finding.recommendedAction}
          </p>
          <p className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--muted-foreground)]">
            <span>Effort: {finding.effort.toLowerCase()}</span>
            <span>Impact: {finding.impact.toLowerCase()}</span>
          </p>
        </div>
      ) : null}

      {evidenceEntries.length > 0 ? (
        <details className="mt-3.5 group">
          <summary className="cursor-pointer list-none text-xs font-medium text-[var(--accent)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]">
            Evidence observed on your website
          </summary>
          <dl className="mt-2.5 space-y-1.5 rounded-lg bg-[var(--surface-muted)] p-3.5">
            {evidenceEntries.map(([key, value]) => (
              <div key={key} className="grid gap-1 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-3">
                <dt className="font-mono text-xs text-[var(--muted-foreground)]">{key}</dt>
                <dd className="overflow-x-auto break-words font-mono text-xs">
                  {formatEvidenceValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}

      {finding.pageUrl ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          <ExternalLink className="size-3.5" aria-hidden="true" />
          <span className="break-all">{finding.pageUrl}</span>
        </p>
      ) : null}
    </Card>
  );
}

function StatusIcon({ status }: { status: ReportData['findings'][number]['status'] }) {
  const common = 'size-4 shrink-0';
  switch (status) {
    case 'PASS':
      return (
        <>
          <Check className={cn(common, 'text-emerald-500')} aria-hidden="true" />
          <span className="sr-only">Passed:</span>
        </>
      );
    case 'FAIL':
      return (
        <>
          <X className={cn(common, 'text-red-500')} aria-hidden="true" />
          <span className="sr-only">Failed:</span>
        </>
      );
    case 'WARN':
      return (
        <>
          <AlertTriangle className={cn(common, 'text-amber-500')} aria-hidden="true" />
          <span className="sr-only">Partial:</span>
        </>
      );
    case 'NOT_APPLICABLE':
      return (
        <>
          <Minus className={cn(common, 'text-[var(--muted-foreground)]')} aria-hidden="true" />
          <span className="sr-only">Not applicable:</span>
        </>
      );
    default:
      return (
        <>
          <Info className={cn(common, 'text-cyan-500')} aria-hidden="true" />
          <span className="sr-only">Informational:</span>
        </>
      );
  }
}

export function formatEvidenceValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.length > 300 ? `${value.slice(0, 300)}…` : value;
  if (Array.isArray(value)) {
    if (value.length === 0) return 'none';
    return value
      .slice(0, 8)
      .map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v)))
      .join(', ');
  }
  const json = JSON.stringify(value);
  return json.length > 400 ? `${json.slice(0, 400)}…` : json;
}

/* -------------------------------------------------------------------------- */
/* 15. Competitors                                                             */
/* -------------------------------------------------------------------------- */

function CompetitorSection({ data }: { data: ReportData }) {
  return (
    <section id="competitors">
      <SectionTitle number="4" title="Competitor comparison" />
      {data.competitors.length === 0 ? (
        <Alert tone="neutral">
          No competitor was supplied for this audit, so Competitive Visibility was marked
          unavailable and its 5% weight was redistributed across the other six categories. Add a
          competitor URL when you re-run this audit to see the comparison.
        </Alert>
      ) : (
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold">Overall comparison</h3>
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
              Competitor scores are derived from a single public homepage fetch, not a full crawl.
              They compare homepage-level signals only.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold">{data.businessName} (you)</span>
                  <span className="text-sm font-semibold tabular-nums">{data.overallScore}</span>
                </div>
                <ScoreBar score={data.overallScore} />
              </div>
              {data.competitors
                .filter((c) => c.overallScore != null)
                .map((competitor) => (
                  <div key={competitor.url}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm text-[var(--muted-foreground)]">
                        {competitor.name ?? competitor.url}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {competitor.overallScore}
                      </span>
                    </div>
                    <ScoreBar score={competitor.overallScore ?? 0} />
                  </div>
                ))}
            </div>
          </Card>

          {data.competitors.map((competitor) => (
            <Card key={competitor.url} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{competitor.name ?? 'Competitor'}</h3>
                  <p className="mt-0.5 break-all text-xs text-[var(--muted-foreground)]">
                    {competitor.url}
                  </p>
                </div>
                {competitor.overallScore != null ? (
                  <span className="text-xl font-bold tabular-nums">{competitor.overallScore}</span>
                ) : (
                  <Badge tone="danger">Not analyzed</Badge>
                )}
              </div>

              {competitor.error ? (
                <p className="mt-3 text-sm text-[var(--muted-foreground)]">{competitor.error}</p>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                      What they do well
                    </h4>
                    <ul className="mt-2 space-y-1.5">
                      {competitor.highlights.length > 0 ? (
                        competitor.highlights.map((item) => (
                          <li key={item} className="text-[0.8125rem] leading-relaxed text-[var(--muted-foreground)]">
                            {item}
                          </li>
                        ))
                      ) : (
                        <li className="text-[0.8125rem] text-[var(--muted-foreground)]">
                          No standout strengths detected on their homepage.
                        </li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      Where they are weak
                    </h4>
                    <ul className="mt-2 space-y-1.5">
                      {competitor.gaps.length > 0 ? (
                        competitor.gaps.map((item) => (
                          <li key={item} className="text-[0.8125rem] leading-relaxed text-[var(--muted-foreground)]">
                            {item}
                          </li>
                        ))
                      ) : (
                        <li className="text-[0.8125rem] text-[var(--muted-foreground)]">
                          No obvious gaps on their homepage.
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Optional public-web observations                                            */
/* -------------------------------------------------------------------------- */

function SearchSection({ data }: { data: ReportData }) {
  return (
    <section id="search-observations">
      <SectionTitle number="5" title="Public-web observations" />
      <Alert tone="info" className="mb-4">
        These are observations of publicly visible search results at the time of the audit, gathered
        through {data.searchProvider ?? 'a search provider'}. They describe general web visibility
        only. They are <strong>not</strong> evidence of whether any particular AI assistant will
        mention or recommend the brand.
      </Alert>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-2xl border-collapse text-left text-sm">
          <caption className="sr-only">Public-web search observations</caption>
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
              <th scope="col" className="px-5 py-3 font-semibold">Query</th>
              <th scope="col" className="px-5 py-3 font-semibold">Brand appears</th>
              <th scope="col" className="px-5 py-3 font-semibold">Results</th>
              <th scope="col" className="px-5 py-3 font-semibold">Top domains</th>
            </tr>
          </thead>
          <tbody>
            {data.searchObservations.map((observation) => (
              <tr key={observation.query} className="border-b border-[var(--border)] last:border-0">
                <th scope="row" className="px-5 py-3 font-normal">{observation.query}</th>
                <td className="px-5 py-3">
                  {observation.brandAppears ? (
                    <Badge tone="success">Yes</Badge>
                  ) : (
                    <Badge tone="warning">No</Badge>
                  )}
                </td>
                <td className="px-5 py-3 tabular-nums">{observation.resultCount}</td>
                <td className="px-5 py-3 text-[var(--muted-foreground)]">
                  {observation.topDomains.slice(0, 4).join(', ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 16. Action plan                                                             */
/* -------------------------------------------------------------------------- */

function ActionPlan({
  doFirst,
  next30,
  longer,
}: {
  doFirst: ReportData['recommendations'];
  next30: ReportData['recommendations'];
  longer: ReportData['recommendations'];
}) {
  const groups = [
    { key: 'DO_FIRST' as const, items: doFirst },
    { key: 'NEXT_30_DAYS' as const, items: next30 },
    { key: 'LONGER_TERM' as const, items: longer },
  ];

  const total = doFirst.length + next30.length + longer.length;

  return (
    <section id="action-plan">
      <SectionTitle number="6" title="Prioritized action plan" />
      {total === 0 ? (
        <Alert tone="success">
          No failing or partial checks were found. There is nothing in the action plan for this
          audit — re-run it after your next round of content changes to confirm the score holds.
        </Alert>
      ) : (
        <div className="space-y-6">
          {groups.map((group) =>
            group.items.length === 0 ? null : (
              <div key={group.key}>
                <div className={cn('rounded-lg border px-5 py-3.5', HORIZON_STYLES[group.key])}>
                  <h3 className="text-sm font-semibold">
                    {HORIZON_LABELS[group.key]}
                    <span className="ml-2 font-normal text-[var(--muted-foreground)]">
                      {group.items.length} {group.items.length === 1 ? 'action' : 'actions'}
                    </span>
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                    {HORIZON_DESCRIPTIONS[group.key]}
                  </p>
                </div>

                <ol className="mt-3 space-y-3">
                  {group.items.map((rec) => (
                    <li key={rec.id}>
                      <RecommendationCard recommendation={rec} />
                    </li>
                  ))}
                </ol>
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}

export function RecommendationCard({
  recommendation,
}: {
  recommendation: ReportData['recommendations'][number];
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xs font-bold tabular-nums">
            {recommendation.priority}
          </span>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold">{recommendation.title}</h4>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              {recommendation.categoryLabel}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Badge tone={recommendation.impact === 'HIGH' ? 'danger' : 'neutral'}>
            {recommendation.impact.toLowerCase()} impact
          </Badge>
          <Badge tone="neutral">{recommendation.effort.toLowerCase()} effort</Badge>
          {recommendation.source === 'AI_ENHANCED' ? <Badge tone="accent">AI-enhanced</Badge> : null}
        </div>
      </div>

      <dl className="mt-4 space-y-3.5 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Why it matters
          </dt>
          <dd className="mt-1 leading-relaxed text-[var(--muted-foreground)]">
            {recommendation.whyItMatters}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Exact recommended change
          </dt>
          <dd className="mt-1 whitespace-pre-line leading-relaxed">
            {recommendation.recommendedChange}
          </dd>
        </div>
        {recommendation.exampleImplementation ? (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Example implementation
            </dt>
            <dd className="mt-1.5">
              <pre tabIndex={0} className="overflow-x-auto rounded-lg bg-[var(--surface-muted)] p-3.5 text-xs leading-relaxed">
                {recommendation.exampleImplementation}
              </pre>
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Expected impact
          </dt>
          <dd className="mt-1 leading-relaxed text-[var(--muted-foreground)]">
            {recommendation.expectedImpact}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* 17. Page-by-page                                                            */
/* -------------------------------------------------------------------------- */

function PageObservations({ data }: { data: ReportData }) {
  return (
    <section id="pages">
      <SectionTitle number="7" title="Page-by-page observations" />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-3xl border-collapse text-left text-sm">
          <caption className="sr-only">Pages analyzed during this audit</caption>
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
              <th scope="col" className="px-5 py-3 font-semibold">Page</th>
              <th scope="col" className="px-5 py-3 font-semibold">Role</th>
              <th scope="col" className="px-5 py-3 font-semibold">Status</th>
              <th scope="col" className="px-5 py-3 font-semibold">Words</th>
              <th scope="col" className="px-5 py-3 font-semibold">Schema</th>
              <th scope="col" className="px-5 py-3 font-semibold">Q-headings</th>
            </tr>
          </thead>
          <tbody>
            {data.pages.map((page) => (
              <tr key={page.url} className="border-b border-[var(--border)] last:border-0">
                <th scope="row" className="max-w-xs px-5 py-3 font-normal">
                  <span className="block truncate" title={page.url}>
                    {page.title ?? page.url}
                  </span>
                  <span className="block truncate text-xs text-[var(--muted-foreground)]">
                    {page.url}
                  </span>
                  {page.note ? (
                    <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
                      {page.note}
                    </span>
                  ) : null}
                  {page.error ? (
                    <span className="mt-1 block text-xs text-red-600 dark:text-red-400">
                      {page.error}
                    </span>
                  ) : null}
                </th>
                <td className="px-5 py-3 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  {page.role.replace(/_/g, ' ').toLowerCase()}
                </td>
                <td className="px-5 py-3 tabular-nums">{page.statusCode ?? '—'}</td>
                <td className="px-5 py-3 tabular-nums">{page.wordCount || '—'}</td>
                <td className="px-5 py-3 text-xs text-[var(--muted-foreground)]">
                  {page.schemaTypes.length > 0 ? page.schemaTypes.slice(0, 3).join(', ') : 'none'}
                </td>
                <td className="px-5 py-3 tabular-nums">{page.questionHeadings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {data.robotsSummary ? (
        <Card className="mt-4 p-5">
          <h3 className="text-sm font-semibold">Site-level files</h3>
          <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <SiteFile label="robots.txt" value={data.robotsSummary.found ? 'Found' : 'Not found'} />
            <SiteFile
              label="XML sitemap"
              value={
                data.robotsSummary.sitemapFound
                  ? `Found (${data.robotsSummary.sitemapUrlCount} URLs)`
                  : 'Not found'
              }
            />
            <SiteFile label="llms.txt" value={data.robotsSummary.llmsTxtFound ? 'Found' : 'Not found'} />
            <SiteFile
              label="AI crawlers blocked"
              value={
                data.robotsSummary.blockedAiAgents.length > 0
                  ? data.robotsSummary.blockedAiAgents.join(', ')
                  : 'None'
              }
            />
          </dl>
        </Card>
      ) : null}
    </section>
  );
}

function SiteFile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-2">
      <dt className="text-[var(--muted-foreground)]">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 18-19. Methodology and limitations                                          */
/* -------------------------------------------------------------------------- */

function MethodologySection({ data }: { data: ReportData }) {
  return (
    <section id="methodology">
      <SectionTitle number="8" title="Methodology" />
      <Card className="p-6">
        <dl className="space-y-5">
          {METHODOLOGY_SUMMARY.map((item) => (
            <div key={item.heading}>
              <dt className="text-sm font-semibold">{item.heading}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-[var(--muted-foreground)]">
                {item.body}
              </dd>
            </div>
          ))}
        </dl>

        <Separator className="my-6" />

        <h3 className="text-sm font-semibold">Where each statement came from</h3>
        <ul className="mt-3 space-y-2 text-sm text-[var(--muted-foreground)]">
          <li className="flex gap-2.5">
            <CircleDot className="mt-0.5 size-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
            <span>
              <strong className="text-[var(--foreground)]">Observed</strong> — measured directly from
              your website during this audit. All scores derive from these.
            </span>
          </li>
          <li className="flex gap-2.5">
            <CircleDot className="mt-0.5 size-3.5 shrink-0 text-cyan-500" aria-hidden="true" />
            <span>
              <strong className="text-[var(--foreground)]">Public-web observation</strong> — what was
              publicly visible in search results at audit time. Never scored.
            </span>
          </li>
          <li className="flex gap-2.5">
            <CircleDot className="mt-0.5 size-3.5 shrink-0 text-violet-500" aria-hidden="true" />
            <span>
              <strong className="text-[var(--foreground)]">AI-enhanced</strong> — wording improved by
              a language model working only from computed results. Never changes a score or evidence.
            </span>
          </li>
          {data.isDemo ? (
            <li className="flex gap-2.5">
              <CircleDot className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
              <span>
                <strong className="text-[var(--foreground)]">Demo data</strong> — fictional
                information created for product demonstration. This entire report is demo data.
              </span>
            </li>
          ) : null}
        </ul>
      </Card>
    </section>
  );
}

function LimitationsSection() {
  return (
    <section id="limitations">
      <SectionTitle number="9" title="Limitations and disclaimer" />
      <Card className="p-6">
        <ul className="space-y-3">
          {REPORT_LIMITATIONS.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-[var(--muted-foreground)]">
              <Info className="mt-0.5 size-4 shrink-0 text-cyan-500" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

function SectionTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-3">
      <span className="text-sm font-bold tabular-nums text-[var(--accent)]">{number}</span>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
}
