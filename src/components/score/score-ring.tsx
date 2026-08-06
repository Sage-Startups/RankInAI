import { cn, scoreBand, scoreBandLabel } from '@/lib/utils';

const BAND_COLORS: Record<ReturnType<typeof scoreBand>, { stroke: string; text: string }> = {
  excellent: { stroke: '#10b981', text: 'text-emerald-600 dark:text-emerald-400' },
  // cyan-600 is only 3.7:1 on the white surface; cyan-700 clears AA at 5.4:1.
  good: { stroke: '#22d3ee', text: 'text-cyan-700 dark:text-cyan-400' },
  fair: { stroke: '#f59e0b', text: 'text-amber-600 dark:text-amber-400' },
  poor: { stroke: '#f97316', text: 'text-orange-600 dark:text-orange-400' },
  critical: { stroke: '#ef4444', text: 'text-red-600 dark:text-red-400' },
};

/**
 * Circular score gauge. Rendered as inline SVG so it prints correctly in the
 * report view and needs no client-side charting library.
 */
export function ScoreRing({
  score,
  size = 160,
  strokeWidth = 12,
  label = 'Overall AI Visibility Score',
  showLabel = true,
  className,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showLabel?: boolean;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const band = scoreBand(clamped);
  const colors = BAND_COLORS[band];
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${label}: ${clamped} out of 100, ${scoreBandLabel(clamped)}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn('leading-none font-bold tabular-nums', colors.text)}
            style={{ fontSize: size * 0.28 }}
          >
            {clamped}
          </span>
          <span
            className="mt-1 text-[var(--muted-foreground)]"
            style={{ fontSize: Math.max(10, size * 0.085) }}
          >
            out of 100
          </span>
        </div>
      </div>
      {showLabel ? (
        <div className="mt-3 text-center">
          <p className={cn('text-sm font-semibold', colors.text)}>{scoreBandLabel(clamped)}</p>
          <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
        </div>
      ) : null}
    </div>
  );
}

/** Horizontal bar used for category scorecards. */
export function ScoreBar({
  score,
  available = true,
  className,
}: {
  score: number;
  available?: boolean;
  className?: string;
}) {
  if (!available) {
    return (
      <div className={cn('h-2 w-full rounded-full bg-[var(--surface-muted)]', className)}>
        <div className="h-full w-full rounded-full border border-dashed border-[var(--border-strong)]" />
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const colors = BAND_COLORS[scoreBand(clamped)];

  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]', className)}
      role="img"
      aria-label={`Score ${clamped} out of 100`}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${clamped}%`, backgroundColor: colors.stroke }}
      />
    </div>
  );
}

export function ScoreDelta({ current, previous }: { current: number; previous: number | null }) {
  if (previous == null) {
    return <span className="text-xs text-[var(--muted-foreground)]">First audit</span>;
  }
  const delta = current - previous;
  if (delta === 0) {
    return <span className="text-xs text-[var(--muted-foreground)]">No change</span>;
  }
  const positive = delta > 0;
  return (
    <span
      className={cn(
        'text-xs font-semibold tabular-nums',
        positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
      )}
    >
      {positive ? '+' : ''}
      {delta} vs previous audit
    </span>
  );
}

export { BAND_COLORS };
