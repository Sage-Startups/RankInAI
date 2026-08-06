import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * RankInAI mark — an original geometric device.
 *
 * Three ascending bars (a rising rank) intersected by a diagonal beam
 * (the query passing through), inside a rounded square.
 */
export function LogoMark({
  className,
  size = 32,
  title,
}: {
  className?: string;
  size?: number;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id="rk-mark-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5844D8" />
          <stop offset="1" stopColor="#0E7490" />
        </linearGradient>
        <linearGradient id="rk-mark-beam" x1="8" y1="30" x2="32" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67E8F9" />
          <stop offset="1" stopColor="#CFC7FF" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#rk-mark-bg)" />
      <rect x="9" y="22" width="5" height="9" rx="1.6" fill="#ffffff" fillOpacity="0.62" />
      <rect x="17.5" y="17" width="5" height="14" rx="1.6" fill="#ffffff" fillOpacity="0.82" />
      <rect x="26" y="11" width="5" height="20" rx="1.6" fill="#ffffff" />
      <path
        d="M7.5 27.5 L32.5 10.5"
        stroke="url(#rk-mark-beam)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="32.5" cy="10.5" r="2.9" fill="#67E8F9" />
    </svg>
  );
}

/** Full wordmark, optionally linked to the homepage. */
export function Logo({
  className,
  size = 32,
  href = '/',
  showWordmark = true,
  tone = 'auto',
}: {
  className?: string;
  size?: number;
  href?: string | null;
  showWordmark?: boolean;
  tone?: 'auto' | 'light' | 'dark';
}) {
  const textColor =
    tone === 'light'
      ? 'text-white'
      : tone === 'dark'
        ? 'text-ink-900'
        : 'text-[var(--foreground)]';

  const content = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} title="RankInAI" />
      {showWordmark ? (
        <span
          className={cn(
            'text-[1.0625rem] font-bold leading-none tracking-[-0.02em]',
            textColor,
          )}
        >
          Rank
          {/*
            Shades chosen for AA contrast at this weight and size against both
            the white app surface and the near-black marketing surface:
            violet-600 6.5:1 / violet-400 6.2:1, cyan-700 5.4:1 / cyan-400 11:1.
          */}
          <span className="text-violet-600 dark:text-violet-400">In</span>
          <span className="text-cyan-700 dark:text-cyan-400">AI</span>
        </span>
      ) : null}
    </span>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      className="inline-flex rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ring)]"
      aria-label="RankInAI home"
    >
      {content}
    </Link>
  );
}

export const BRAND_TAGLINE = 'See whether AI can find, understand and recommend your brand.';
