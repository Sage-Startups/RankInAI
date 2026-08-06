import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Health check for Railway and uptime monitoring.
 *
 * Returns 200 only when the database is reachable. Deliberately reports
 * capability flags (whether optional providers are configured) but never a
 * secret, a connection string or a version of anything internal.
 */
export async function GET() {
  const started = Date.now();
  const env = getEnv();

  let databaseOk = false;
  let databaseLatencyMs: number | null = null;
  let queueDepth: number | null = null;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    databaseLatencyMs = Date.now() - dbStart;
    databaseOk = true;

    queueDepth = await prisma.auditJob.count({ where: { status: 'QUEUED' } });
  } catch {
    databaseOk = false;
  }

  const body = {
    status: databaseOk ? 'ok' : 'degraded',
    service: 'rankinai-web',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    checks: {
      database: { ok: databaseOk, latencyMs: databaseLatencyMs },
      queue: { ok: databaseOk, queuedJobs: queueDepth },
    },
    capabilities: {
      billingConfigured: env.stripeConfigured,
      billingTestMode: env.billingTestMode,
      llmEnhancement: env.llmEnabled,
      searchObservations: env.searchEnabled,
      emailProvider: env.EMAIL_PROVIDER,
    },
    responseTimeMs: Date.now() - started,
  };

  return NextResponse.json(body, {
    status: databaseOk ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
