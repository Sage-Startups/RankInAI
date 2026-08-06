import type { Server } from 'node:http';
import { AuditStatus, CreditSource, JobStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { runAudit } from '@/lib/audit/engine';
import { claimNextJob, completeJob, failJob, retryJob, cancelJob } from '@/lib/queue';
import { reserveAuditCredit } from '@/lib/credits';
import { buildReportData } from '@/lib/report/build';
import { generateReportPdf } from '@/lib/report/pdf';
import { runFreePreview } from '@/lib/audit/preview';
import { CATEGORY_ORDER } from '@/lib/audit/scoring';
import { cleanupTestData, createTestUser, disconnect, prisma, useTestScope } from '../helpers/db';
import { FIXTURE_ORIGIN, FIXTURE_EXPECTED_SCORE_RANGE } from '../fixtures/site';
import { startFixtureServer, stopFixtureServer } from '../fixtures/server';

useTestScope('pipeline');

let server: Server;

// One server for the whole file. A per-describe afterAll would stop it before
// the later describe blocks run.
beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await stopFixtureServer(server);
  await cleanupTestData();
  await disconnect();
});

async function createQueuedAudit(
  userId: string,
  overrides: { websiteUrl?: string; competitors?: string[]; pageLimit?: number } = {},
) {
  const audit = await prisma.audit.create({
    data: {
      userId,
      websiteUrl: overrides.websiteUrl ?? FIXTURE_ORIGIN,
      normalizedDomain: '127.0.0.1',
      businessName: 'Northbridge Plumbing Co.',
      industry: 'Home services',
      targetCountry: 'United States',
      targetAudience: 'Homeowners and property managers in Worcester County',
      primaryServices: 'Drain cleaning, water heater replacement, emergency plumbing',
      businessLocation: 'Northbridge, Massachusetts',
      status: AuditStatus.QUEUED,
      creditSource: CreditSource.ONE_TIME_CREDIT,
      pageLimit: overrides.pageLimit ?? 10,
      competitorLimit: 1,
      consentConfirmed: true,
      competitors: overrides.competitors
        ? { create: overrides.competitors.map((url) => ({ url })) }
        : undefined,
      job: { create: { status: JobStatus.QUEUED } },
    },
    include: { competitors: { select: { id: true, url: true } } },
  });
  return audit;
}

describe('end-to-end audit pipeline against the controlled fixture', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it('crawls, scores, persists findings and produces a complete report', async () => {
    const user = await createTestUser({ credits: 1 });
    const audit = await createQueuedAudit(user.id);
    await reserveAuditCredit(user.id, audit.id);

    const progress: number[] = [];
    const result = await runAudit(audit, async (value) => {
      progress.push(value);
    });

    expect(result.ok).toBe(true);
    expect(result.failureCode).toBeNull();

    // Progress is reported and increases monotonically.
    expect(progress.length).toBeGreaterThan(3);
    expect(progress[progress.length - 1]).toBe(100);
    for (let i = 1; i < progress.length; i += 1) {
      expect(progress[i]!).toBeGreaterThanOrEqual(progress[i - 1]!);
    }

    // Multiple pages were crawled.
    expect(result.pagesCrawled).toBeGreaterThanOrEqual(5);
    expect(result.findingCount).toBeGreaterThan(50);
    expect(result.recommendationCount).toBeGreaterThan(0);

    // The score sits in the expected band for this fixture.
    expect(result.overallScore).toBeGreaterThanOrEqual(FIXTURE_EXPECTED_SCORE_RANGE.min);
    expect(result.overallScore).toBeLessThanOrEqual(FIXTURE_EXPECTED_SCORE_RANGE.max);

    const stored = await prisma.audit.findUniqueOrThrow({
      where: { id: audit.id },
      include: { scores: true, findings: true, recommendations: true, pages: true },
    });

    expect(stored.status).toBe(AuditStatus.COMPLETED);
    expect(stored.overallScore).toBe(result.overallScore);
    expect(stored.completedAt).not.toBeNull();
    expect(stored.executiveSummary).toBeTruthy();
    expect(stored.executiveSummary!.length).toBeGreaterThan(150);

    // All seven category rows are written.
    expect(stored.scores).toHaveLength(CATEGORY_ORDER.length);

    // Competitive Visibility is unavailable — no competitor was supplied.
    const competitive = stored.scores.find((s) => s.category === 'COMPETITIVE_VISIBILITY');
    expect(competitive?.available).toBe(false);
    expect(competitive?.effectiveWeight).toBe(0);

    // The other six categories share the redistributed weight, totalling 1.
    const totalWeight = stored.scores.reduce((sum, s) => sum + s.effectiveWeight, 0);
    expect(totalWeight).toBeCloseTo(1, 2);

    // Findings carry evidence and explanations.
    for (const finding of stored.findings.slice(0, 10)) {
      expect(finding.explanation.length).toBeGreaterThan(20);
      expect(finding.evidence).toBeTypeOf('object');
    }
  });

  it('detects the fixture’s deliberate strengths', async () => {
    const user = await createTestUser({ credits: 1 });
    const audit = await createQueuedAudit(user.id);
    await reserveAuditCredit(user.id, audit.id);
    await runAudit(audit, async () => {});

    const findings = await prisma.auditFinding.findMany({ where: { auditId: audit.id } });
    const byId = new Map(findings.map((f) => [f.checkId, f]));

    // The fixture publishes an Organization/LocalBusiness block with sameAs.
    expect(byId.get('schema.organization-present')?.status).toBe('PASS');
    expect(byId.get('schema.same-as')?.status).toBe('PASS');
    // FAQ content marked up with FAQPage schema.
    expect(byId.get('schema.faq')?.status).toBe('PASS');
    // Full contact details in the footer of every page.
    expect(byId.get('trust.contact-details')?.status).toBe('PASS');
    // robots.txt and a sitemap are published.
    expect(byId.get('tech.robots-txt')?.status).toBe('PASS');
    expect(byId.get('tech.sitemap')?.status).toBe('PASS');
    // No AI crawler is blocked.
    expect(byId.get('tech.ai-crawler-access')?.status).toBe('PASS');
  });

  it('detects the fixture’s deliberate weaknesses', async () => {
    const user = await createTestUser({ credits: 1 });
    const audit = await createQueuedAudit(user.id);
    await reserveAuditCredit(user.id, audit.id);
    await runAudit(audit, async () => {});

    const findings = await prisma.auditFinding.findMany({ where: { auditId: audit.id } });
    const byId = new Map(findings.map((f) => [f.checkId, f]));

    // No llms.txt is published.
    expect(byId.get('tech.llms-txt')?.status).toBe('INFO');
    // The fixture contains "world-class" and "the best".
    expect(byId.get('content.vague-language')?.status).not.toBe('PASS');
    expect(byId.get('content.unsupported-superlatives')?.status).not.toBe('PASS');
    // /services/fixtures is deliberately under 150 words.
    expect(byId.get('content.thin-pages')?.status).not.toBe('PASS');
    // Two service pages share an identical opening paragraph.
    expect(byId.get('content.duplication')?.status).not.toBe('PASS');
    // No comparison content exists.
    expect(byId.get('answer.comparison-content')?.status).not.toBe('PASS');
    // The thin page has two images with no alt attribute.
    expect(byId.get('tech.image-alt')?.status).not.toBe('PASS');
  });

  it('produces identical scores when the same site is audited twice', async () => {
    const user = await createTestUser({ credits: 2 });

    const first = await createQueuedAudit(user.id);
    await reserveAuditCredit(user.id, first.id);
    const resultA = await runAudit(first, async () => {});

    const second = await createQueuedAudit(user.id);
    await reserveAuditCredit(user.id, second.id);
    const resultB = await runAudit(second, async () => {});

    expect(resultB.overallScore).toBe(resultA.overallScore);

    const [scoresA, scoresB] = await Promise.all([
      prisma.auditScore.findMany({ where: { auditId: first.id }, orderBy: { category: 'asc' } }),
      prisma.auditScore.findMany({ where: { auditId: second.id }, orderBy: { category: 'asc' } }),
    ]);

    for (let i = 0; i < scoresA.length; i += 1) {
      expect(scoresB[i]!.score).toBe(scoresA[i]!.score);
      expect(scoresB[i]!.category).toBe(scoresA[i]!.category);
    }
  });

  it('records the previous score on a repeat audit of the same domain', async () => {
    const user = await createTestUser({ credits: 2 });

    const first = await createQueuedAudit(user.id);
    await reserveAuditCredit(user.id, first.id);
    const resultA = await runAudit(first, async () => {});

    const second = await createQueuedAudit(user.id);
    await reserveAuditCredit(user.id, second.id);
    await runAudit(second, async () => {});

    const stored = await prisma.audit.findUniqueOrThrow({ where: { id: second.id } });
    expect(stored.previousScore).toBe(resultA.overallScore);
  });

  it('scores Competitive Visibility when a competitor is supplied', async () => {
    const user = await createTestUser({ credits: 1 });
    const audit = await createQueuedAudit(user.id, {
      competitors: [`${FIXTURE_ORIGIN}/about`],
    });
    await reserveAuditCredit(user.id, audit.id);

    await runAudit(audit, async () => {});

    const competitive = await prisma.auditScore.findFirstOrThrow({
      where: { auditId: audit.id, category: 'COMPETITIVE_VISIBILITY' },
    });
    expect(competitive.available).toBe(true);
    expect(competitive.effectiveWeight).toBeCloseTo(0.05, 3);

    const competitor = await prisma.auditCompetitor.findFirstOrThrow({
      where: { auditId: audit.id },
    });
    expect(competitor.status).toBe('ANALYZED');
    expect(competitor.overallScore).toBeGreaterThan(0);
  });

  it('respects the plan page limit', async () => {
    const user = await createTestUser({ credits: 1 });
    const audit = await createQueuedAudit(user.id, { pageLimit: 3 });
    await reserveAuditCredit(user.id, audit.id);

    const result = await runAudit(audit, async () => {});
    expect(result.pagesCrawled).toBeLessThanOrEqual(3);
  });

  it('generates a downloadable PDF from the completed audit', async () => {
    const user = await createTestUser({ credits: 1 });
    const audit = await createQueuedAudit(user.id);
    await reserveAuditCredit(user.id, audit.id);
    await runAudit(audit, async () => {});

    const data = await buildReportData(audit.id);
    expect(data).not.toBeNull();

    const pdf = await generateReportPdf(data!);
    expect(pdf.byteLength).toBeGreaterThan(20_000);
    // Valid PDF header and EOF marker.
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.subarray(-1024).toString('latin1')).toContain('%%EOF');
  });

  it('fails cleanly and refunds the credit for an unreachable website', async () => {
    const user = await createTestUser({ credits: 1 });
    const audit = await createQueuedAudit(user.id, {
      websiteUrl: 'https://this-domain-definitely-does-not-exist-rankinai.invalid',
    });
    await reserveAuditCredit(user.id, audit.id);

    let record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(record.oneTimeCredits).toBe(0);

    const result = await runAudit(audit, async () => {});
    expect(result.ok).toBe(false);
    expect(result.refundable).toBe(true);

    const job = await prisma.auditJob.findUniqueOrThrow({ where: { auditId: audit.id } });
    await failJob({
      jobId: job.id,
      auditId: audit.id,
      code: result.failureCode ?? 'UNKNOWN',
      message: result.failureMessage ?? 'failed',
      refundable: true,
      retryable: false,
    });

    record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(record.oneTimeCredits).toBe(1);

    const stored = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } });
    expect(stored.status).toBe(AuditStatus.FAILED);
    expect(stored.failureMessage).toBeTruthy();
    // The customer-facing message must not leak a stack trace.
    expect(stored.failureMessage).not.toContain('at Object.');
  });
});

describe('job queue', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it('claims a queued job exactly once even with concurrent workers', async () => {
    const user = await createTestUser({ credits: 1 });
    await createQueuedAudit(user.id);

    const [a, b, c] = await Promise.all([
      claimNextJob('worker-a'),
      claimNextJob('worker-b'),
      claimNextJob('worker-c'),
    ]);

    const claimed = [a, b, c].filter(Boolean);
    expect(claimed).toHaveLength(1);
  });

  it('marks the audit running when a job is claimed', async () => {
    const user = await createTestUser({ credits: 1 });
    const audit = await createQueuedAudit(user.id);

    const job = await claimNextJob('worker-status');
    expect(job?.auditId).toBe(audit.id);

    const stored = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } });
    expect(stored.status).toBe(AuditStatus.RUNNING);
    expect(stored.startedAt).not.toBeNull();
  });

  it('retries a transient failure with backoff before giving up', async () => {
    const user = await createTestUser({ credits: 1 });
    const audit = await createQueuedAudit(user.id);
    await reserveAuditCredit(user.id, audit.id);

    const job = await claimNextJob('worker-retry');
    expect(job).not.toBeNull();

    const first = await failJob({
      jobId: job!.jobId,
      auditId: audit.id,
      code: 'TIMEOUT',
      message: 'The website took too long to respond.',
      refundable: true,
      retryable: true,
    });

    expect(first.willRetry).toBe(true);
    expect(first.creditRestored).toBe(false);

    const stored = await prisma.auditJob.findUniqueOrThrow({ where: { auditId: audit.id } });
    expect(stored.status).toBe(JobStatus.QUEUED);
    expect(stored.scheduledAt.getTime()).toBeGreaterThan(Date.now());

    // The credit has not been returned while a retry is still pending.
    const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(record.oneTimeCredits).toBe(0);
  });

  it('restores the credit once retries are exhausted', async () => {
    const user = await createTestUser({ credits: 1 });
    const audit = await createQueuedAudit(user.id);
    await reserveAuditCredit(user.id, audit.id);

    const job = await claimNextJob('worker-exhaust');
    await prisma.auditJob.update({
      where: { id: job!.jobId },
      data: { attempts: 3, maxAttempts: 3 },
    });

    const result = await failJob({
      jobId: job!.jobId,
      auditId: audit.id,
      code: 'TIMEOUT',
      message: 'The website took too long to respond.',
      refundable: true,
      retryable: true,
    });

    expect(result.willRetry).toBe(false);
    expect(result.creditRestored).toBe(true);

    const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(record.oneTimeCredits).toBe(1);
  });

  it('completes a job and marks it finished', async () => {
    const user = await createTestUser({ credits: 1 });
    const audit = await createQueuedAudit(user.id);
    const job = await claimNextJob('worker-complete');

    await completeJob(job!.jobId);

    const stored = await prisma.auditJob.findUniqueOrThrow({ where: { auditId: audit.id } });
    expect(stored.status).toBe(JobStatus.COMPLETED);
    expect(stored.progress).toBe(100);
    expect(stored.lockedBy).toBeNull();
  });

  it('cancels a queued job and returns the credit', async () => {
    const user = await createTestUser({ credits: 1 });
    const audit = await createQueuedAudit(user.id);
    await reserveAuditCredit(user.id, audit.id);

    const canceled = await cancelJob(audit.id);
    expect(canceled).toBe(true);

    const [stored, record] = await Promise.all([
      prisma.audit.findUniqueOrThrow({ where: { id: audit.id } }),
      prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
    ]);
    expect(stored.status).toBe(AuditStatus.CANCELED);
    expect(record.oneTimeCredits).toBe(1);
  });

  it('refuses to cancel a job that is already running', async () => {
    const user = await createTestUser({ credits: 1 });
    const audit = await createQueuedAudit(user.id);
    await claimNextJob('worker-running');

    expect(await cancelJob(audit.id)).toBe(false);
  });

  it('requeues a failed job without refunding the credit again', async () => {
    const user = await createTestUser({ credits: 1 });
    const audit = await createQueuedAudit(user.id);
    await reserveAuditCredit(user.id, audit.id);

    const job = await claimNextJob('worker-requeue');
    await failJob({
      jobId: job!.jobId,
      auditId: audit.id,
      code: 'DNS_FAILURE',
      message: 'Not found',
      refundable: true,
      retryable: false,
    });

    let record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(record.oneTimeCredits).toBe(1);

    expect(await retryJob(audit.id)).toBe(true);

    const requeued = await prisma.auditJob.findUniqueOrThrow({ where: { auditId: audit.id } });
    expect(requeued.status).toBe(JobStatus.QUEUED);
    // creditRestored stays true so a second failure cannot refund twice.
    expect(requeued.creditRestored).toBe(true);

    record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(record.oneTimeCredits).toBe(1);
  });
});

describe('free live preview', () => {
  it('analyzes a single page and caps the findings at five', async () => {
    const result = await runFreePreview(FIXTURE_ORIGIN);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.findings.length).toBeLessThanOrEqual(5);
    expect(result.checkedCount).toBeGreaterThan(5);
    expect(result.previewScore).toBeGreaterThanOrEqual(0);
    expect(result.previewScore).toBeLessThanOrEqual(100);
    expect(result.title).toContain('Northbridge');
  });

  it('returns a friendly error for a blocked address', async () => {
    const result = await runFreePreview('http://10.0.0.1/');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('private or reserved network');
    }
  });

  it('rejects a reserved internal suffix before any DNS lookup', async () => {
    const result = await runFreePreview('https://definitely-not-real-rankinai-preview.invalid');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('BLOCKED_HOSTNAME');
    }
  });

  it('returns a friendly error for a domain that does not resolve', async () => {
    const result = await runFreePreview(
      'https://rankinai-preview-nonexistent-a7f3c91b2e.example.com',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('DNS_FAILURE');
      // The user-facing message must not leak a Node error code.
      expect(result.message).not.toContain('ENOTFOUND');
      expect(result.message).toContain('could not find');
    }
  });
});
