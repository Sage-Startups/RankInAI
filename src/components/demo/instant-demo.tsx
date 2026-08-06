'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, CircleAlert, Loader2, Play, TriangleAlert } from 'lucide-react';

import { Badge, Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { ScoreBar, ScoreRing } from '@/components/score/score-ring';
import { track } from '@/components/site/analytics-provider';
import {
  DEMO_DISCLAIMER,
  DEMO_LABEL,
  DEMO_MINI_REPORT,
  DEMO_SEQUENCE,
} from '@/lib/demo/sample-audit';
import { cn } from '@/lib/utils';

type Phase = 'idle' | 'running' | 'complete';

/**
 * Instant sample demo.
 *
 * Runs a ~5 second animated sequence, then reveals a mini report built from the
 * fictional Atlas Roofing dataset. Everything is labeled as demo data — the copy
 * never implies a real website was audited.
 */
export function InstantDemo({
  autoStart = false,
  size = 'compact',
}: {
  autoStart?: boolean;
  size?: 'compact' | 'full';
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [stepIndex, setStepIndex] = useState(-1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }, []);

  const start = useCallback(() => {
    clearTimers();
    setPhase('running');
    setStepIndex(0);
    track('demo_started', { variant: size });

    let elapsed = 0;
    DEMO_SEQUENCE.forEach((step, index) => {
      elapsed += step.durationMs;
      timers.current.push(
        setTimeout(() => {
          setStepIndex(index + 1);
        }, elapsed),
      );
    });

    timers.current.push(
      setTimeout(() => {
        setPhase('complete');
        track('demo_completed', { variant: size, score: DEMO_MINI_REPORT.overallScore });
      }, elapsed + 250),
    );
  }, [clearTimers, size]);

  useEffect(() => {
    if (autoStart) start();
    return clearTimers;
  }, [autoStart, start, clearTimers]);

  return (
    <Card
      className={cn(
        'bg-ink-900/70 overflow-hidden border-white/12 text-slate-100 backdrop-blur',
        size === 'full' && 'shadow-2xl shadow-violet-900/20',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-red-400/70" />
            <span className="size-2.5 rounded-full bg-amber-400/70" />
            <span className="size-2.5 rounded-full bg-emerald-400/70" />
          </span>
          <p className="text-sm font-medium text-slate-200">{DEMO_MINI_REPORT.business.name}</p>
        </div>
        <Badge tone="demo">{DEMO_LABEL}</Badge>
      </div>

      <div className="p-5 sm:p-6">
        {phase === 'idle' ? (
          <IdleState onStart={start} />
        ) : phase === 'running' ? (
          <RunningState stepIndex={stepIndex} />
        ) : (
          <MiniReport size={size} onReplay={start} />
        )}
      </div>

      <p className="bg-ink-950/60 border-t border-white/10 px-5 py-3 text-[0.6875rem] leading-relaxed text-slate-400">
        {DEMO_DISCLAIMER}
      </p>
    </Card>
  );
}

function IdleState({ onStart }: { onStart: () => void }) {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-violet-500/15 text-violet-300">
        <Play className="size-6" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">See a completed audit in 5 seconds</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
        Watch RankInAI analyze a fictional US roofing contractor and produce a scored AI visibility
        report. No account, no email address.
      </p>
      <Button onClick={onStart} size="lg" className="mt-6">
        Run the free demo
        <ArrowRight aria-hidden="true" />
      </Button>
    </div>
  );
}

function RunningState({ stepIndex }: { stepIndex: number }) {
  const progress = Math.round((stepIndex / DEMO_SEQUENCE.length) * 100);

  return (
    <div className="py-3">
      <div
        className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Demo audit progress"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(6, progress)}%` }}
        />
      </div>

      <ol className="space-y-2.5" aria-live="polite">
        {DEMO_SEQUENCE.map((step, index) => {
          const done = index < stepIndex;
          const active = index === stepIndex;
          return (
            <li
              key={step.label}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                done && 'text-slate-400',
                active && 'bg-white/[0.05] text-white',
                !done && !active && 'text-slate-400',
              )}
            >
              <span className="flex size-5 shrink-0 items-center justify-center">
                {done ? (
                  <Check className="size-4 text-emerald-400" aria-hidden="true" />
                ) : active ? (
                  <Loader2 className="size-4 animate-spin text-violet-300" aria-hidden="true" />
                ) : (
                  <span className="size-1.5 rounded-full bg-slate-600" aria-hidden="true" />
                )}
              </span>
              {step.label}
              {done ? <span className="sr-only">complete</span> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MiniReport({ size, onReplay }: { size: 'compact' | 'full'; onReplay: () => void }) {
  const report = DEMO_MINI_REPORT;

  return (
    <div className="animate-in-up">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <ScoreRing
          score={report.overallScore}
          size={size === 'full' ? 160 : 128}
          showLabel={false}
          className="shrink-0"
        />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-xs font-semibold tracking-[0.14em] text-violet-300 uppercase">
            Overall AI Visibility Score
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">
            {report.business.name} scores {report.overallScore} out of 100
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Reachable and trustworthy, but its content is not structured for retrieval. The FAQ
            answers already exist — they are simply not machine-readable.
          </p>
          <p className="mt-3 text-xs text-slate-400">
            {report.business.pagesCrawled} pages analyzed · {report.business.location} ·{' '}
            {report.business.industry}
          </p>
        </div>
      </div>

      <div className="mt-7 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {report.categories.map((category) => (
          <div key={category.category}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="truncate text-[0.8125rem] text-slate-300">{category.label}</span>
              <span className="shrink-0 text-[0.8125rem] font-semibold text-white tabular-nums">
                {category.score}
              </span>
            </div>
            <ScoreBar score={category.score} className="bg-white/10" />
          </div>
        ))}
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <Check className="size-4" aria-hidden="true" />
            Three strengths
          </h4>
          <ul className="mt-2.5 space-y-2">
            {report.strengths.map((item) => (
              <li key={item} className="text-[0.8125rem] leading-relaxed text-slate-300">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-red-500/25 bg-red-500/[0.07] p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-red-300">
            <TriangleAlert className="size-4" aria-hidden="true" />
            Three high-priority problems
          </h4>
          <ul className="mt-2.5 space-y-2">
            {report.weaknesses.map((item) => (
              <li key={item} className="text-[0.8125rem] leading-relaxed text-slate-300">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-violet-500/30 bg-violet-500/[0.09] p-4">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-violet-200">
          <CircleAlert className="size-4" aria-hidden="true" />
          Recommended next action
        </h4>
        <p className="mt-1.5 text-sm font-medium text-white">{report.nextAction.title}</p>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-slate-300">
          {report.nextAction.detail}
        </p>
      </div>

      <div className="mt-4 rounded-lg border border-white/12 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-white">Competitor comparison</h4>
          <Badge tone="demo">{DEMO_LABEL}</Badge>
        </div>
        <div className="mt-3 space-y-3">
          <ComparisonRow label={report.business.name} score={report.overallScore} highlight />
          <ComparisonRow label={report.competitor.name} score={report.competitor.overallScore} />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          Ahead on trust signals ({report.competitor.gaps[0]?.toLowerCase()}), behind on structured
          data and question-led content.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
        <Button asChild size="lg" className="flex-1">
          <Link href="/signup">
            Run an audit on your website
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="flex-1 border-white/25 text-white hover:bg-white/10"
        >
          <Link href="/sample-report">View the full demo report</Link>
        </Button>
      </div>

      <button
        type="button"
        onClick={onReplay}
        className="mt-3 w-full rounded-md py-1.5 text-xs text-slate-400 underline underline-offset-4 transition-colors hover:text-slate-200"
      >
        Replay the demo
      </button>
    </div>
  );
}

function ComparisonRow({
  label,
  score,
  highlight = false,
}: {
  label: string;
  score: number;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span
          className={cn(
            'truncate text-[0.8125rem]',
            highlight ? 'font-semibold text-white' : 'text-slate-300',
          )}
        >
          {label}
        </span>
        <span className="shrink-0 text-[0.8125rem] font-semibold text-white tabular-nums">
          {score}
        </span>
      </div>
      <ScoreBar score={score} className="bg-white/10" />
    </div>
  );
}
