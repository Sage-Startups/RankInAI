import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * RankClear mark — an original geometric device.
 *
 * A ring of four arcs (the signals being read from every side) around a solid
 * centre (the answer they resolve to), inside a light outer circle.
 *
 * The mark is theme-aware rather than a fixed image. The centre is near-black
 * on light surfaces and near-white on dark ones: at 1.15:1 the navy centre is
 * effectively invisible against the marketing shell, so a single fixed fill
 * would erase the middle of the logo on half the site.
 */

/** Mint arcs, right half. */
const ARC_MINT_TOP = 'M23.75 6.93 A13.6 13.6 0 0 1 33.57 19.05';
const ARC_MINT_LOWER = 'M33.47 21.89 A13.6 13.6 0 0 1 22.83 33.30';
/** Gold arcs, left half. */
const ARC_GOLD_LOWER = 'M17.17 33.30 A13.6 13.6 0 0 1 6.53 21.89';
const ARC_GOLD_TOP = 'M6.43 19.05 A13.6 13.6 0 0 1 16.25 6.93';

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

      {/* Outer circle: pale on light surfaces, a dim teal on dark ones. */}
      <circle
        cx="20"
        cy="20"
        r="18.4"
        className="stroke-[#c4e7e1] dark:stroke-[#2a5f58]"
        strokeWidth="1.5"
      />

      <g strokeWidth="2.9" strokeLinecap="round">
        <path d={ARC_MINT_TOP} className="stroke-[#4fc7b8]" />
        <path d={ARC_MINT_LOWER} className="stroke-[#4fc7b8]" />
        <path d={ARC_GOLD_LOWER} className="stroke-[#c89a4b]" />
        <path d={ARC_GOLD_TOP} className="stroke-[#c89a4b]" />
      </g>

      <circle cx="20" cy="20" r="5.4" className="fill-[#101a26] dark:fill-white" />
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
    tone === 'light' ? 'text-white' : tone === 'dark' ? 'text-ink-900' : 'text-[var(--foreground)]';

  const content = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} title="RankClear" />
      {showWordmark ? (
        <span
          className={cn('text-[1.0625rem] leading-none font-bold tracking-[-0.02em]', textColor)}
        >
          Rank
          {/*
            The brand teal (#3aa294) reaches only 3.10:1 on white, which fails AA
            for text at this weight and size, so light mode uses a darker tone of
            the same hue (5.5:1) and dark mode uses the mark's own mint (10:1).
          */}
          <span className="text-[#12766a] dark:text-[#5ccec1]">Clear</span>
        </span>
      ) : null}
    </span>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      className="inline-flex rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ring)]"
      aria-label="RankClear home"
    >
      {content}
    </Link>
  );
}

export const BRAND_TAGLINE = 'See whether AI can find, understand and recommend your brand.';
