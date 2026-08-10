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

  // Deliberately guarded. A misconfigured environment makes `getEnv()` throw,
  // and an unguarded call here turns every deployment problem into the same
  // opaque "Healthcheck failure" with the cause buried in a stack trace. The
  // health endpoint is the one route that must always answer and say why.
  let env: ReturnType<typeof getEnv> | null = null;
  let configError: string | null = null;
  try {
    env = getEnv();
  } catch (error) {
    configError = error instanceof Error ? error.message : String(error);
  }

  let databaseOk = false;
  let databaseLatencyMs: number | null = null;
  let queueDepth: number | null = null;

  let databaseError: string | null = null;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    databaseLatencyMs = Date.now() - dbStart;
    databaseOk = true;

    queueDepth = await prisma.auditJob.count({ where: { status: 'QUEUED' } });
  } catch (error) {
    databaseOk = false;
    // A Prisma connection error reads:
    //
    //   ""
    //   "Invalid `prisma.$queryRaw()` invocation:"
    //   ""
    //   "Can't reach database server at `host:port`"
    //
    // so skip the blank lines and the invocation preamble to reach the line
    // that actually says what went wrong. It names the host and port but never
    // the credentials, which Prisma keeps out of its error text.
    const raw = error instanceof Error ? error.message : String(error);
    databaseError =
      raw
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 0 && !line.endsWith('invocation:'))
        ?.slice(0, 300) ?? 'Unknown database error';
  }

  const healthy = databaseOk && configError === null;

  const body = {
    status: healthy ? 'ok' : 'degraded',
    service: 'rankinai-web',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    checks: {
      configuration: { ok: configError === null, error: configError },
      database: { ok: databaseOk, latencyMs: databaseLatencyMs, error: databaseError },
      queue: { ok: databaseOk, queuedJobs: queueDepth },
    },
    // Degraded-but-serving states (ephemeral auth secret, billing test mode
    // forced off, ignored fixture bypass). Warnings do not fail the check —
    // the application is up and safe — but they belong where an operator
    // debugging a deployment will actually look.
    warnings: env?.configWarnings ?? [],
    capabilities: env
      ? {
          billingConfigured: env.stripeConfigured,
          billingTestMode: env.billingTestMode,
          llmEnhancement: env.llmEnabled,
          searchObservations: env.searchEnabled,
          emailProvider: env.EMAIL_PROVIDER,
        }
      : null,
    responseTimeMs: Date.now() - started,
  };

  // A failing health check on a hosting platform surfaces as one unhelpful
  // line, so put the reason in the deploy logs where it can actually be read.
  if (!healthy) {
    console.error(
      JSON.stringify({
        ts: body.timestamp,
        level: 'error',
        service: 'rankinai-web',
        message: 'Health check failed',
        configuration: configError ?? 'ok',
        database: databaseError ?? 'ok',
      }),
    );
  }

  return NextResponse.json(body, {
    status: healthy ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
