import 'dotenv/config';

import { AuditStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { runAudit } from '@/lib/audit/engine';
import { claimNextJob, completeJob, failJob, updateJobProgress } from '@/lib/queue';
import { pruneRateLimitEvents } from '@/lib/rate-limit';
import { sendAuditCompleteEmail } from '@/lib/email';
import { trackEvent } from '@/lib/analytics';

/**
 * RankInAI audit worker.
 *
 * Runs as its own Railway service (`npm run worker`) against the same database
 * as the web service. Long crawls must never depend on an HTTP request staying
 * open.
 *
 * Behavior:
 *  - polls the queue on an interval
 *  - claims a job atomically (only one worker can own a job)
 *  - heartbeats progress so a long crawl is not reclaimed as stale
 *  - retries transient failures with backoff, restores the credit on permanent
 *    failure before useful work
 *  - shuts down gracefully on SIGTERM/SIGINT, finishing the current job first
 */

const env = getEnv();
const workerId = env.WORKER_ID ?? `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

let shuttingDown = false;
let activeJobs = 0;

/** Failure codes that are worth retrying — transient network conditions. */
const RETRYABLE_CODES = new Set(['TIMEOUT', 'CONNECTION_FAILED', 'HTTP_ERROR', 'UNKNOWN']);

/** Failures where nothing useful was analyzed, so the credit must be restored. */
const REFUNDABLE_CODES = new Set([
  'INVALID_URL',
  'BLOCKED',
  'DNS_FAILURE',
  'TIMEOUT',
  'CONNECTION_FAILED',
  'TOO_MANY_REDIRECTS',
  'REDIRECT_LOOP',
  'RESPONSE_TOO_LARGE',
  'UNSUPPORTED_CONTENT_TYPE',
  'HTTP_ERROR',
  'ROBOTS_BLOCKED',
  'EMPTY',
  'MALFORMED',
  'UNSUPPORTED_SCHEME',
  'CREDENTIALS_IN_URL',
  'BLOCKED_HOSTNAME',
  'BLOCKED_PORT',
  'PRIVATE_ADDRESS',
  'LINK_LOCAL_ADDRESS',
  'LOOPBACK_ADDRESS',
  'METADATA_ENDPOINT',
  'NO_ADDRESSES',
  'UNKNOWN',
]);

function log(
  level: 'info' | 'warn' | 'error',
  message: string,
  extra: Record<string, unknown> = {},
) {
  // Structured single-line logs so Railway's log viewer stays readable.
  const payload = {
    ts: new Date().toISOString(),
    level,
    service: 'rankinai-worker',
    worker: workerId,
    message,
    ...extra,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

async function processJob(job: {
  jobId: string;
  auditId: string;
  attempts: number;
  maxAttempts: number;
}) {
  activeJobs += 1;
  const started = Date.now();

  try {
    const audit = await prisma.audit.findUnique({
      where: { id: job.auditId },
      include: { competitors: { select: { id: true, url: true } } },
    });

    if (!audit || audit.deletedAt) {
      await failJob({
        jobId: job.jobId,
        auditId: job.auditId,
        code: 'AUDIT_MISSING',
        message: 'The audit record was removed before processing.',
        refundable: false,
        retryable: false,
      });
      return;
    }

    log('info', 'Processing audit', {
      auditId: audit.id,
      domain: audit.normalizedDomain,
      attempt: job.attempts,
      pageLimit: audit.pageLimit,
    });

    const result = await runAudit(audit, async (progress, message, step) => {
      await updateJobProgress(job.jobId, progress, message, step);
    });

    if (!result.ok) {
      const code = result.failureCode ?? 'UNKNOWN';
      const outcome = await failJob({
        jobId: job.jobId,
        auditId: job.auditId,
        code,
        message: result.failureMessage ?? 'The audit could not be completed.',
        refundable: result.refundable && REFUNDABLE_CODES.has(code),
        retryable: RETRYABLE_CODES.has(code),
      });

      log('warn', 'Audit failed', {
        auditId: audit.id,
        code,
        willRetry: outcome.willRetry,
        creditRestored: outcome.creditRestored,
        durationMs: Date.now() - started,
      });
      return;
    }

    await completeJob(job.jobId);

    log('info', 'Audit complete', {
      auditId: audit.id,
      score: result.overallScore,
      pages: result.pagesCrawled,
      findings: result.findingCount,
      recommendations: result.recommendationCount,
      durationMs: Date.now() - started,
    });

    await trackEvent({
      name: 'audit_completed',
      userId: audit.userId,
      properties: {
        auditId: audit.id,
        score: result.overallScore ?? 0,
        pageCount: result.pagesCrawled,
        durationMs: Date.now() - started,
      },
      isDemo: audit.isDemo,
    });

    // Notify the owner, if they have not opted out.
    if (!audit.isDemo) {
      const owner = await prisma.user.findUnique({
        where: { id: audit.userId },
        select: { email: true, profile: { select: { emailAuditComplete: true } } },
      });
      if (owner && owner.profile?.emailAuditComplete !== false) {
        await sendAuditCompleteEmail({
          to: owner.email,
          businessName: audit.businessName,
          score: result.overallScore ?? 0,
          auditId: audit.id,
        }).catch((error) => {
          log('warn', 'Audit completion email failed', {
            auditId: audit.id,
            error: error instanceof Error ? error.message : 'unknown',
          });
        });
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown worker error';
    log('error', 'Unhandled error while processing audit', {
      auditId: job.auditId,
      error: detail,
    });

    await failJob({
      jobId: job.jobId,
      auditId: job.auditId,
      code: 'UNKNOWN',
      // Never leak an internal stack trace to the customer.
      message:
        'The audit stopped unexpectedly. Our team has been notified — please try running it again.',
      refundable: true,
      retryable: true,
    }).catch((failError) => {
      log('error', 'Failed to record job failure', {
        auditId: job.auditId,
        error: failError instanceof Error ? failError.message : 'unknown',
      });
    });
  } finally {
    activeJobs -= 1;
  }
}

/** Process a single queued job if one is available. Used by tests and cron. */
export async function processNextJob(): Promise<boolean> {
  const job = await claimNextJob(workerId);
  if (!job) return false;
  await processJob(job);
  return true;
}

async function loop() {
  let idleTicks = 0;

  while (!shuttingDown) {
    try {
      const worked = await processNextJob();
      idleTicks = worked ? 0 : idleTicks + 1;

      // Housekeeping roughly every 15 idle minutes.
      if (idleTicks > 0 && idleTicks % 225 === 0) {
        const pruned = await pruneRateLimitEvents();
        if (pruned > 0) log('info', 'Pruned rate-limit events', { count: pruned });
      }

      if (!worked) {
        await sleep(env.WORKER_POLL_INTERVAL_MS);
      }
    } catch (error) {
      log('error', 'Worker loop error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      await sleep(Math.max(5000, env.WORKER_POLL_INTERVAL_MS));
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('info', 'Shutdown signal received; finishing active work', { signal, activeJobs });

  // Give the in-flight audit a bounded window to finish cleanly.
  const deadline = Date.now() + 30_000;
  while (activeJobs > 0 && Date.now() < deadline) {
    await sleep(500);
  }

  // Release any job still held so another worker can pick it up immediately.
  if (activeJobs > 0) {
    await prisma.auditJob
      .updateMany({
        where: { lockedBy: workerId, status: 'RUNNING' },
        data: {
          status: 'QUEUED',
          lockedAt: null,
          lockedBy: null,
          progressMessage: 'Requeued during a worker restart',
        },
      })
      .catch(() => undefined);
    await prisma.audit
      .updateMany({
        where: { job: { lockedBy: workerId }, status: AuditStatus.RUNNING },
        data: { status: AuditStatus.QUEUED },
      })
      .catch(() => undefined);
  }

  await prisma.$disconnect().catch(() => undefined);
  log('info', 'Worker stopped');
  process.exit(0);
}

async function main() {
  log('info', 'Worker starting', {
    pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
    llmEnabled: env.llmEnabled,
    searchEnabled: env.searchEnabled,
    nodeEnv: env.NODE_ENV,
  });

  // Fail fast if the database is unreachable rather than looping silently.
  await prisma.$queryRaw`SELECT 1`;

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    log('error', 'Unhandled promise rejection', {
      error: reason instanceof Error ? reason.message : String(reason),
    });
  });

  await loop();
}

// Only auto-start when executed directly, so tests can import processNextJob.
const isEntrypoint =
  process.argv[1] != null &&
  (process.argv[1].endsWith('worker/main.ts') || process.argv[1].endsWith('worker/main.js'));

if (isEntrypoint) {
  main().catch((error) => {
    log('error', 'Worker failed to start', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    process.exit(1);
  });
}
