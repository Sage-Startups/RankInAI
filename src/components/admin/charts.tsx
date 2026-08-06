'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatUsd } from '@/lib/utils';

/**
 * Admin charts.
 *
 * Deliberately restrained: one accent per series, gridlines at low contrast,
 * and axis labels that read correctly in both light and dark themes. Every
 * chart is paired with a table elsewhere on the page so the data is accessible
 * without relying on the visualization.
 */

const VIOLET = '#6d5ef0';
const CYAN = '#22d3ee';

interface DailyPoint {
  date: string;
  revenueCents: number;
  signups: number;
  audits: number;
}

function shortDate(value: string): string {
  const [, month, day] = value.split('-');
  return `${month}/${day}`;
}

const AXIS_STYLE = {
  fontSize: 11,
  fill: 'var(--muted-foreground)',
};

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string | number;
  valueFormatter: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={String(entry.name)} className="mt-1 flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
            aria-hidden="true"
          />
          <span className="text-[var(--muted-foreground)]">{entry.name}:</span>
          <span className="font-semibold tabular-nums">
            {valueFormatter(Number(entry.value ?? 0))}
          </span>
        </p>
      ))}
    </div>
  );
}

export function RevenueChart({ data, title }: { data: DailyPoint[]; title: string }) {
  return (
    <figure>
      <figcaption className="sr-only">{title}</figcaption>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={VIOLET} stopOpacity={0.32} />
                <stop offset="100%" stopColor={VIOLET} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              minTickGap={16}
            />
            <YAxis
              tickFormatter={(value) => `$${Math.round(Number(value) / 100)}`}
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              content={
                <ChartTooltip valueFormatter={(value) => formatUsd(value, { showCents: true })} />
              }
            />
            <Area
              type="monotone"
              dataKey="revenueCents"
              name="Revenue"
              stroke={VIOLET}
              strokeWidth={2}
              fill="url(#revenue-fill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function SignupChart({ data, title }: { data: DailyPoint[]; title: string }) {
  return (
    <figure>
      <figcaption className="sr-only">{title}</figcaption>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              minTickGap={16}
            />
            <YAxis
              allowDecimals={false}
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip content={<ChartTooltip valueFormatter={(value) => String(value)} />} />
            <Bar dataKey="signups" name="Sign-ups" fill={CYAN} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function AuditsChart({ data, title }: { data: DailyPoint[]; title: string }) {
  return (
    <figure>
      <figcaption className="sr-only">{title}</figcaption>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              minTickGap={16}
            />
            <YAxis
              allowDecimals={false}
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip content={<ChartTooltip valueFormatter={(value) => String(value)} />} />
            <Bar dataKey="audits" name="Audits created" fill={VIOLET} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** Simple funnel bars — proportional widths, no chart library needed. */
export function ConversionFunnel({ steps }: { steps: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...steps.map((step) => step.value));

  return (
    <ol className="space-y-3">
      {steps.map((step, index) => {
        const width = Math.max(2, (step.value / max) * 100);
        const previous = index > 0 ? (steps[index - 1]?.value ?? 0) : null;
        const rate = previous && previous > 0 ? Math.round((step.value / previous) * 100) : null;

        return (
          <li key={step.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-sm">{step.label}</span>
              <span className="text-sm font-semibold tabular-nums">
                {step.value}
                {rate != null ? (
                  <span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">
                    {rate}% of previous
                  </span>
                ) : null}
              </span>
            </div>
            <div className="h-6 w-full overflow-hidden rounded bg-[var(--surface-muted)]">
              <div
                className="h-full rounded bg-gradient-to-r from-violet-500 to-cyan-400"
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
