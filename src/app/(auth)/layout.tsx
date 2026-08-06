import Link from 'next/link';
import { Check } from 'lucide-react';

import { Logo } from '@/components/brand/logo';
import { SITE } from '@/lib/site-config';

const POINTS = [
  'Seven scored categories with evidence behind every finding',
  'A prioritized action plan with example implementations',
  'Downloadable PDF reports you can hand to a client',
  'Deterministic scoring — the same site always scores the same',
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col bg-[var(--background)] px-5 py-8 sm:px-8">
        <header>
          <Logo />
        </header>
        <main id="main" className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </main>
        <footer className="text-center text-xs text-[var(--muted-foreground)]">
          <nav aria-label="Legal">
            <Link href="/legal/terms" className="hover:underline">
              Terms
            </Link>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <Link href="/legal/privacy" className="hover:underline">
              Privacy
            </Link>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <Link href="/contact" className="hover:underline">
              Contact
            </Link>
          </nav>
        </footer>
      </div>

      <aside className="bg-ink-950 relative hidden overflow-hidden lg:block">
        <div className="rk-hero-wash absolute inset-0" aria-hidden="true" />
        <div className="rk-grid-lines absolute inset-0" aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-center px-12 xl:px-16">
          <p className="text-xs font-semibold tracking-[0.16em] text-violet-300 uppercase">
            AI visibility &amp; GEO audits
          </p>
          <h2 className="mt-5 max-w-md text-3xl leading-tight font-bold text-white">
            {SITE.tagline}
          </h2>
          <p className="mt-5 max-w-md text-[0.9375rem] leading-relaxed text-slate-400">
            {SITE.description}
          </p>
          <ul className="mt-9 space-y-3.5">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3 text-sm leading-relaxed text-slate-300">
                <Check className="mt-0.5 size-4 shrink-0 text-cyan-400" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
          <p className="mt-10 max-w-md text-xs leading-relaxed text-slate-400">
            RankInAI reports on observed website signals and AI visibility readiness. No tool can
            guarantee that a specific AI assistant will mention or recommend a business.
          </p>
        </div>
      </aside>
    </div>
  );
}
