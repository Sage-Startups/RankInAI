import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';

import { SITE, absoluteUrl, appUrl } from '@/lib/site-config';
import { getSettings } from '@/lib/settings';
import { MaintenanceBanner } from '@/components/site/maintenance-banner';
import { AnalyticsProvider } from '@/components/site/analytics-provider';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: {
    default: `${SITE.name} — AI Visibility & GEO Audit Platform`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    'AI visibility audit',
    'GEO audit',
    'Generative Engine Optimization',
    'AI search visibility',
    'answer engine optimization',
    'AI brand discoverability',
    'AI website audit',
  ],
  authors: [{ name: SITE.name }],
  creator: SITE.name,
  publisher: SITE.name,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: SITE.locale,
    url: absoluteUrl('/'),
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: `${SITE.name} — ${SITE.tagline}` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  icons: {
    icon: [{ url: '/icon', type: 'image/svg+xml' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#05070f' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    <html lang="en-US" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <a href="#main" className="rk-skip-link">
          Skip to main content
        </a>
        {settings.maintenanceBannerEnabled && settings.maintenanceBannerText ? (
          <MaintenanceBanner text={settings.maintenanceBannerText} />
        ) : null}
        <AnalyticsProvider />
        {children}
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{ duration: 5000 }}
        />
      </body>
    </html>
  );
}
