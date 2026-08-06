'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Globe, Info, Loader2, TriangleAlert, X } from 'lucide-react';

import { Alert, Badge, Card, FieldError, Input, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { ScoreRing } from '@/components/score/score-ring';
import { track } from '@/components/site/analytics-provider';
import { cn } from '@/lib/utils';

/**
 * Free live preview — anonymous, homepage-only, rate limited server-side.
 */

interface PreviewFinding {
  categoryLabel: string;
  title: string;
  severity: string;
  detail: string;
  passed: boolean;
}

interface PreviewResponse {
  ok: boolean;
  error?: string;
  retryAfterSeconds?: number;
  data?: {
    domain: string;
    finalUrl: string;
    previewScore: number;
    title: string | null;
    findings: PreviewFinding[];
    checkedCount: number;
    totalIssuesFound: number;
    disclaimer: string;
  };
}

const SEVERITY_TONE: Record<string, 'danger' | 'warning' | 'info' | 'success' | 'neutral'> = {
  CRITICAL: 'danger',
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'info',
  PASSED: 'success',
  INFORMATIONAL: 'neutral',
};

export function LivePreview({ compact = false }: { compact?: boolean }) {
  const [url, setUrl] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewResponse['data'] | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setError(null);
    setResult(null);
    setLoading(true);
    track('live_preview_requested');

    try {
      const response = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, company: honeypot }),
      });
      const payload = (await response.json()) as PreviewResponse;

      if (!response.ok || !payload.ok || !payload.data) {
        setError(payload.error ?? 'We could not analyze that website. Please try another address.');
        return;
      }

      setResult(payload.data);
      track('live_preview_completed', {
        score: payload.data.previewScore,
        domain: payload.data.domain,
      });
    } catch {
      setError('Something went wrong reaching our servers. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn('w-full', compact ? '' : 'mx-auto max-w-3xl')}>
      <form onSubmit={onSubmit} noValidate>
        <Label htmlFor="preview-url" className="text-slate-200">
          Your website address
        </Label>
        <div className="mt-2 flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Globe
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <Input
              id="preview-url"
              name="url"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="yourcompany.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'preview-error' : 'preview-hint'}
              className="h-12 border-white/20 bg-white/[0.06] pl-9 text-white placeholder:text-slate-400"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            loading={loading}
            loadingText="Analyzing…"
            className="sm:w-auto"
          >
            Run free preview
            {!loading ? <ArrowRight aria-hidden="true" /> : null}
          </Button>
        </div>

        {/* Honeypot — hidden from users, catches naive bots. */}
        <div
          aria-hidden="true"
          className="absolute top-auto left-[-9999px] h-px w-px overflow-hidden"
        >
          <label htmlFor="preview-company">Company (leave blank)</label>
          <input
            id="preview-company"
            name="company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <p id="preview-hint" className="mt-2.5 text-xs leading-relaxed text-slate-400">
          Analyzes your homepage only and shows up to five findings. No account required. This is
          not the full paid audit.
        </p>

        <FieldError id="preview-error" message={error ?? undefined} />
      </form>

      {loading ? (
        <Card className="bg-ink-900/70 mt-6 border-white/12 p-6">
          <div className="flex items-center gap-3 text-slate-300">
            <Loader2 className="size-5 animate-spin text-violet-300" aria-hidden="true" />
            <p className="text-sm">Fetching your homepage and inspecting public signals…</p>
          </div>
        </Card>
      ) : null}

      {result ? <PreviewResult data={result} /> : null}
    </div>
  );
}

function PreviewResult({ data }: { data: NonNullable<PreviewResponse['data']> }) {
  return (
    <Card className="animate-in-up bg-ink-900/70 mt-6 overflow-hidden border-white/12 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-3.5">
        <p className="truncate text-sm font-medium text-slate-200">{data.domain}</p>
        <Badge tone="info">Homepage preview</Badge>
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <ScoreRing score={data.previewScore} size={124} showLabel={false} className="shrink-0" />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-xs font-semibold tracking-[0.14em] text-cyan-300 uppercase">
              Limited preview score
            </p>
            <h3 className="mt-1 text-lg font-semibold text-white">
              {data.totalIssuesFound === 0
                ? 'Your homepage passed every preview check'
                : `${data.totalIssuesFound} of ${data.checkedCount} preview checks need attention`}
            </h3>
            {data.title ? (
              <p className="mt-2 truncate text-sm text-slate-400">
                Page title: <span className="text-slate-300">{data.title}</span>
              </p>
            ) : null}
            <p className="mt-2 text-xs leading-relaxed text-slate-400">{data.disclaimer}</p>
          </div>
        </div>

        <ul className="mt-6 space-y-3">
          {data.findings.map((finding) => (
            <li
              key={finding.title}
              className={cn(
                'rounded-lg border p-4',
                finding.passed
                  ? 'border-emerald-500/25 bg-emerald-500/[0.06]'
                  : 'border-white/12 bg-white/[0.03]',
              )}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0">
                  {finding.passed ? (
                    <Check className="size-4 text-emerald-400" aria-hidden="true" />
                  ) : finding.severity === 'CRITICAL' || finding.severity === 'HIGH' ? (
                    <X className="size-4 text-red-400" aria-hidden="true" />
                  ) : (
                    <TriangleAlert className="size-4 text-amber-400" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-white">{finding.title}</p>
                    <Badge tone={SEVERITY_TONE[finding.severity] ?? 'neutral'}>
                      {finding.passed ? 'Passed' : finding.severity.toLowerCase()}
                    </Badge>
                    <span className="text-xs text-slate-400">{finding.categoryLabel}</span>
                  </div>
                  <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-slate-400">
                    {finding.detail}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <Alert tone="info" className="mt-6 border-violet-500/30 bg-violet-500/[0.09]">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 size-4 shrink-0 text-violet-300" aria-hidden="true" />
            <div className="text-slate-300">
              <p className="font-medium text-white">This is a preview, not the full audit.</p>
              <p className="mt-1 text-[0.8125rem] leading-relaxed">
                A full RankInAI audit crawls up to 50 pages, scores all seven categories with
                evidence for every finding, compares competitors and produces a prioritized action
                plan with example implementations.
              </p>
            </div>
          </div>
        </Alert>

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <Button asChild size="lg" className="flex-1">
            <Link href="/signup">
              Create an account for the full audit
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="flex-1 border-white/25 text-white hover:bg-white/10"
          >
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
