import Link from 'next/link';

import { Logo } from '@/components/brand/logo';
import { FOOTER_NAV, SITE } from '@/lib/site-config';

export function SiteFooter({ supportEmail }: { supportEmail: string }) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-ink-950 text-slate-300">
      <div className="rk-container py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo tone="light" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
              {SITE.tagline} RankInAI measures the public website signals that influence whether
              generative search and answer engines can discover, understand and cite your brand.
            </p>
            <p className="mt-4 text-xs leading-relaxed text-slate-400">
              RankInAI reports on observed website signals and AI visibility readiness. No tool can
              guarantee that a specific AI assistant will mention or recommend a business.
            </p>
          </div>

          {FOOTER_NAV.map((group) => (
            <div key={group.heading}>
              <h2 className="text-sm font-semibold text-white">{group.heading}</h2>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-7 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} RankInAI. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a
              href={`mailto:${supportEmail}`}
              className="transition-colors hover:text-slate-300"
            >
              {supportEmail}
            </a>
            <Link href="/legal/privacy" className="transition-colors hover:text-slate-300">
              Privacy
            </Link>
            <Link href="/legal/terms" className="transition-colors hover:text-slate-300">
              Terms
            </Link>
            <span>Prices in US dollars.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
