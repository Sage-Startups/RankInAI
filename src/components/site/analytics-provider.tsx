'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Client-side hook into the internal, privacy-conscious analytics endpoint.
 *
 * No third-party tracker is loaded. The product functions fully with
 * NEXT_PUBLIC_ANALYTICS_ENABLED unset.
 */

const SESSION_KEY_NAME = 'rk_session_key';

function sessionKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    let key = window.sessionStorage.getItem(SESSION_KEY_NAME);
    if (!key) {
      key = crypto.randomUUID();
      window.sessionStorage.setItem(SESSION_KEY_NAME, key);
    }
    return key;
  } catch {
    return '';
  }
}

export function analyticsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'false';
}

/** Fire-and-forget event. Never blocks or throws. */
export function track(name: string, properties: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined' || !analyticsEnabled()) return;
  const body = JSON.stringify({
    name,
    sessionKey: sessionKey(),
    path: window.location.pathname,
    properties,
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics', new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Analytics is best-effort.
  }
}

const PATH_EVENTS: Record<string, string> = {
  '/': 'home_viewed',
  '/pricing': 'pricing_viewed',
  '/sample-report': 'sample_report_viewed',
};

export function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const event = PATH_EVENTS[pathname];
    if (event) track(event);
  }, [pathname]);

  return null;
}
