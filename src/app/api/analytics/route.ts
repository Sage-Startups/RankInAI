import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/lib/auth/guards';
import { isAnalyticsEvent, trackEvent } from '@/lib/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().min(1).max(60),
  sessionKey: z.string().max(64).optional(),
  path: z.string().max(200).optional(),
  properties: z.record(z.unknown()).optional(),
});

/**
 * Internal analytics collector.
 *
 * Only whitelisted event names are accepted, and property values are filtered
 * server-side in `trackEvent`, so a hostile client cannot write arbitrary data.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success || !isAnalyticsEvent(parsed.data.name)) {
    // Silently accept unknown events so a stale client cannot generate errors.
    return NextResponse.json({ ok: true });
  }

  const user = await getCurrentUser().catch(() => null);

  await trackEvent({
    name: parsed.data.name,
    userId: user?.id ?? null,
    sessionKey: parsed.data.sessionKey ?? null,
    path: parsed.data.path ?? null,
    properties: parsed.data.properties as Record<string, unknown> | undefined,
  });

  return NextResponse.json({ ok: true });
}
