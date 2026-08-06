import { type Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';

/**
 * Privacy-conscious internal event tracking.
 *
 * Rules:
 *  - never store raw form values, email addresses, passwords or payment data
 *  - `sessionKey` is an opaque client-generated id, not tied to identity
 *  - properties are whitelisted per event and clipped to short scalars
 *  - failures are swallowed: analytics must never break a user action
 */

export const ANALYTICS_EVENTS = [
  'home_viewed',
  'demo_started',
  'demo_completed',
  'live_preview_requested',
  'live_preview_completed',
  'pricing_viewed',
  'plan_selected',
  'signup_started',
  'signup_completed',
  'checkout_started',
  'checkout_completed',
  'audit_created',
  'audit_completed',
  'report_downloaded',
  'sample_report_viewed',
  'contact_submitted',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export function isAnalyticsEvent(value: string): value is AnalyticsEventName {
  return (ANALYTICS_EVENTS as readonly string[]).includes(value);
}

/** Property keys allowed to be persisted. Anything else is dropped. */
const ALLOWED_PROPERTY_KEYS = new Set([
  'plan',
  'productKey',
  'source',
  'score',
  'category',
  'variant',
  'auditId',
  'durationMs',
  'pageCount',
  'result',
  'domain',
  'isDemo',
]);

function sanitizeProperties(input: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!input) return {};
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_PROPERTY_KEYS.has(key)) continue;
    if (typeof value === 'string') {
      output[key] = value.slice(0, 120);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      output[key] = value;
    } else if (typeof value === 'boolean') {
      output[key] = value;
    }
  }
  return output;
}

export async function trackEvent(params: {
  name: AnalyticsEventName;
  userId?: string | null;
  sessionKey?: string | null;
  path?: string | null;
  properties?: Record<string, unknown>;
  isDemo?: boolean;
}): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        name: params.name,
        userId: params.userId ?? null,
        sessionKey: params.sessionKey?.slice(0, 64) ?? null,
        path: params.path?.slice(0, 200) ?? null,
        properties: sanitizeProperties(params.properties) as unknown as Prisma.InputJsonValue,
        isDemo: params.isDemo ?? false,
      },
    });
  } catch {
    // Analytics is best-effort by design.
  }
}

export interface FunnelCounts {
  homeViewed: number;
  demoStarted: number;
  demoCompleted: number;
  previewRequested: number;
  pricingViewed: number;
  signupCompleted: number;
  checkoutStarted: number;
  checkoutCompleted: number;
  auditCreated: number;
  auditCompleted: number;
  reportDownloaded: number;
}

/** Aggregate the conversion funnel. Excludes demo data unless asked. */
export async function getFunnelCounts(
  options: {
    includeDemo?: boolean;
    since?: Date;
    until?: Date;
  } = {},
): Promise<FunnelCounts> {
  const where: Prisma.AnalyticsEventWhereInput = {
    ...(options.includeDemo ? {} : { isDemo: false }),
    ...(options.since || options.until
      ? {
          createdAt: {
            ...(options.since ? { gte: options.since } : {}),
            ...(options.until ? { lte: options.until } : {}),
          },
        }
      : {}),
  };

  const grouped = await prisma.analyticsEvent.groupBy({
    by: ['name'],
    where,
    _count: { _all: true },
  });

  const map = new Map(grouped.map((g) => [g.name, g._count._all]));
  const get = (name: AnalyticsEventName) => map.get(name) ?? 0;

  return {
    homeViewed: get('home_viewed'),
    demoStarted: get('demo_started'),
    demoCompleted: get('demo_completed'),
    previewRequested: get('live_preview_requested'),
    pricingViewed: get('pricing_viewed'),
    signupCompleted: get('signup_completed'),
    checkoutStarted: get('checkout_started'),
    checkoutCompleted: get('checkout_completed'),
    auditCreated: get('audit_created'),
    auditCompleted: get('audit_completed'),
    reportDownloaded: get('report_downloaded'),
  };
}
