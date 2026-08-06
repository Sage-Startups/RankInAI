import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { getCurrentUser } from '@/lib/auth/guards';
import { getSettings } from '@/lib/settings';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);

  return (
    // `dark`: the marketing shell is dark in every theme, so the tokens and the
    // `dark:` utilities inside it must both resolve to their dark values.
    <div className="dark flex min-h-dvh flex-col bg-ink-950 text-[var(--foreground)]">
      <SiteHeader signedIn={Boolean(user)} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter supportEmail={settings.supportEmail} />
    </div>
  );
}
