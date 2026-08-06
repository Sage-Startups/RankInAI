'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { FlaskConical } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * "Include demo data" toggle.
 *
 * Off by default on every admin screen. Seeded demonstration records must never
 * be mistaken for real business performance, so the on-state is visually loud.
 */
export function DemoToggle({ includeDemo }: { includeDemo: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const next = new URLSearchParams(searchParams.toString());
  if (includeDemo) {
    next.delete('demo');
  } else {
    next.set('demo', '1');
  }
  const href = `${pathname}${next.toString() ? `?${next.toString()}` : ''}`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={href}
        role="switch"
        aria-checked={includeDemo}
        className={cn(
          'inline-flex items-center gap-2.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors',
          includeDemo
            ? 'border-amber-500/60 bg-amber-500/15 text-amber-800 dark:text-amber-200'
            : 'border-[var(--border-strong)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]',
        )}
      >
        <FlaskConical className="size-4" aria-hidden="true" />
        Include demo data
        <span
          className={cn(
            'ml-1 inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors',
            includeDemo ? 'bg-amber-500' : 'bg-[var(--border-strong)]',
          )}
          aria-hidden="true"
        >
          <span
            className={cn(
              'size-4 rounded-full bg-white transition-transform',
              includeDemo ? 'translate-x-4' : 'translate-x-0',
            )}
          />
        </span>
      </Link>

      {includeDemo ? (
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
          Figures below include fabricated demonstration records. Do not present these as real
          business performance.
        </p>
      ) : (
        <p className="text-xs text-[var(--muted-foreground)]">
          Showing real records only. Seeded demonstration data is excluded.
        </p>
      )}
    </div>
  );
}
