import { AuditStatus, JobStatus, PlanTier } from '@prisma/client';

import { prisma } from '@/lib/db';
import { restoreAuditCredit } from '@/lib/credits';

/**
 * Database-backed audit job queue.
 *
 * Concurrency safety comes from a conditional UPDATE that both selects and
 * locks a job in one statement: only the worker whose UPDATE affects a row owns
 * the job. No advisory locks, no external queue service, and it survives a
 * container restart because state lives entirely in Postgres.
 */

/** A job locked for longer than this is presumed dead and is reclaimed. */
export const STALE_LOCK_MINUTES = 15;

export interface ClaimedJob {
  jobId: string;
  auditId: string;
  attempts: number;
  maxAttempts: number;
}

/**
 * Atomically claim the next queued job.
 *
 * Agency-plan audits are served first (priority queue entitlement), then
 * oldest-first within each tier.
 */
export async function claimNextJob(workerId: string): Promise<ClaimedJob | null> {
  const staleCutoff = new Date(Date.now() - STALE_LOCK_MINUTES * 60 * 1000);

  // Reclaim jobs whose worker died mid-run.
  await prisma.auditJob.updateMany({
    where: {
      status: JobStatus.RUNNING,
      lockedAt: { lt: staleCutoff },
    },
    data: {
      status: JobStatus.QUEUED,
      lockedAt: null,
      lockedBy: null,
      progressMessage: 'Requeued after the previous worker stopped responding.',
    },
  });

  const candidates = await prisma.auditJob.findMany({
    where: {
      status: JobStatus.QUEUED,
      scheduledAt: { lte: new Date() },
      audit: { status: { in: [AuditStatus.QUEUED, AuditStatus.RUNNING] }, deletedAt: null },
    },
    select: {
      id: true,
      auditId: true,
      attempts: true,
      maxAttempts: true,
      audit: { select: { planAtCreation: true } },
    },
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
    take: 25,
  });

  const prioritized = [...candidates].sort((a, b) => {
    const priorityA = a.audit.planAtCreation === PlanTier.AGENCY ? 0 : 1;
    const priorityB = b.audit.planAtCreation === PlanTier.AGENCY ? 0 : 1;
    return priorityA - priorityB;
  });

  for (const candidate of prioritized) {
    // The `status: QUEUED` predicate is the lock: only one worker's UPDATE can
    // match, so only one worker gets count === 1.
    const claimed = await prisma.auditJob.updateMany({
      where: { id: candidate.id, status: JobStatus.QUEUED },
      data: {
        status: JobStatus.RUNNING,
        lockedAt: new Date(),
        lockedBy: workerId,
        startedAt: new Date(),
        attempts: { increment: 1 },
        progress: 1,
        progressMessage: 'Starting audit',
        lastError: null,
      },
    });

    if (claimed.count === 1) {
      await prisma.audit.update({
        where: { id: candidate.auditId },
        data: { status: AuditStatus.RUNNING, startedAt: new Date() },
      });

      return {
        jobId: candidate.id,
        auditId: candidate.auditId,
        attempts: candidate.attempts + 1,
        maxAttempts: candidate.maxAttempts,
      };
    }
  }

  return null;
}

export async function updateJobProgress(
  jobId: string,
  progress: number,
  message: string,
  step?: string,
): Promise<void> {
  await prisma.auditJob.update({
    where: { id: jobId },
    data: {
      progress: Math.max(0, Math.min(100, Math.round(progress))),
      progressMessage: message.slice(0, 200),
      currentStep: step?.slice(0, 60),
      lockedAt: new Date(), // heartbeat, so a long crawl is not reclaimed
    },
  });
}

export async function completeJob(jobId: string): Promise<void> {
  await prisma.auditJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.COMPLETED,
      progress: 100,
      progressMessage: 'Audit complete',
      currentStep: 'done',
      finishedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    },
  });
}

/**
 * Record a failure. Retries while attempts remain; otherwise marks the audit
 * failed and, when the failure happened before useful work, restores the credit.
 */
export async function failJob(params: {
  jobId: string;
  auditId: string;
  code: string;
  message: string;
  refundable: boolean;
  retryable: boolean;
}): Promise<{ willRetry: boolean; creditRestored: boolean }> {
  const job = await prisma.auditJob.findUnique({
    where: { id: params.jobId },
    select: { attempts: true, maxAttempts: true },
  });

  const attempts = job?.attempts ?? 1;
  const maxAttempts = job?.maxAttempts ?? 3;
  const willRetry = params.retryable && attempts < maxAttempts;

  if (willRetry) {
    // Exponential backoff: 1min, 4min, 9min…
    const delayMs = attempts * attempts * 60_000;
    await prisma.auditJob.update({
      where: { id: params.jobId },
      data: {
        status: JobStatus.QUEUED,
        lockedAt: null,
        lockedBy: null,
        scheduledAt: new Date(Date.now() + delayMs),
        lastError: `${params.code}: ${params.message}`.slice(0, 2000),
        progressMessage: `Retrying shortly (attempt ${attempts + 1} of ${maxAttempts})`,
      },
    });
    await prisma.audit.update({
      where: { id: params.auditId },
      data: { status: AuditStatus.QUEUED },
    });
    return { willRetry: true, creditRestored: false };
  }

  await prisma.auditJob.update({
    where: { id: params.jobId },
    data: {
      status: JobStatus.FAILED,
      lockedAt: null,
      lockedBy: null,
      finishedAt: new Date(),
      lastError: `${params.code}: ${params.message}`.slice(0, 2000),
      progressMessage: 'Audit failed',
    },
  });

  await prisma.audit.update({
    where: { id: params.auditId },
    data: {
      status: AuditStatus.FAILED,
      failureCode: params.code,
      failureMessage: params.message.slice(0, 500),
      completedAt: new Date(),
    },
  });

  const creditRestored = params.refundable ? await restoreAuditCredit(params.auditId) : false;

  return { willRetry: false, creditRestored };
}

/** Requeue a failed job from the admin area. */
export async function retryJob(auditId: string): Promise<boolean> {
  const job = await prisma.auditJob.findUnique({ where: { auditId } });
  if (!job) return false;
  if (job.status === JobStatus.RUNNING) return false;

  await prisma.$transaction([
    prisma.auditJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.QUEUED,
        attempts: 0,
        progress: 0,
        progressMessage: 'Requeued by an administrator',
        currentStep: null,
        scheduledAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        finishedAt: null,
        lastError: null,
        // A retry re-uses the already-reserved credit, so guard against a
        // double refund if it fails again.
        creditRestored: job.creditRestored,
      },
    }),
    prisma.audit.update({
      where: { id: auditId },
      data: {
        status: AuditStatus.QUEUED,
        failureCode: null,
        failureMessage: null,
        completedAt: null,
      },
    }),
  ]);

  return true;
}

/** Cancel a job that has not started, restoring the credit. */
export async function cancelJob(auditId: string): Promise<boolean> {
  const job = await prisma.auditJob.findUnique({ where: { auditId } });
  if (!job || job.status !== JobStatus.QUEUED) return false;

  await prisma.$transaction([
    prisma.auditJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.CANCELED,
        finishedAt: new Date(),
        progressMessage: 'Canceled before processing',
      },
    }),
    prisma.audit.update({
      where: { id: auditId },
      data: { status: AuditStatus.CANCELED, completedAt: new Date() },
    }),
  ]);

  await restoreAuditCredit(auditId, 'Audit canceled before processing began');
  return true;
}

export interface QueueStats {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  oldestQueuedAt: Date | null;
}

export async function getQueueStats(includeDemo = false): Promise<QueueStats> {
  const where = includeDemo ? {} : { isDemo: false };
  const [queued, running, completed, failed, oldest] = await Promise.all([
    prisma.auditJob.count({ where: { ...where, status: JobStatus.QUEUED } }),
    prisma.auditJob.count({ where: { ...where, status: JobStatus.RUNNING } }),
    prisma.auditJob.count({ where: { ...where, status: JobStatus.COMPLETED } }),
    prisma.auditJob.count({ where: { ...where, status: JobStatus.FAILED } }),
    prisma.auditJob.findFirst({
      where: { ...where, status: JobStatus.QUEUED },
      orderBy: { scheduledAt: 'asc' },
      select: { scheduledAt: true },
    }),
  ]);

  return {
    queued,
    running,
    completed,
    failed,
    oldestQueuedAt: oldest?.scheduledAt ?? null,
  };
}
