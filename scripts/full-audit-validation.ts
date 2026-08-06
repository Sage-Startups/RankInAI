/**
 * Full audit validation.
 *
 * Runs one complete audit end to end — crawl, checks, scoring, findings,
 * recommendations, competitor comparison, PDF — against the controlled
 * fixture website, then writes FULL_AUDIT_TEST_REPORT.md from what actually
 * happened. Nothing in the report is written by hand.
 *
 * It also runs the audit twice and compares the scores, because "deterministic
 * scoring" is a claim the product makes and it should be checked rather than
 * asserted.
 *
 *   npm run audit:full-test
 *
 * Records it creates are removed afterwards, so this is safe to run against a
 * development database.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { AuditStatus, PlanTier, PrismaClient } from '@prisma/client';

import { runAudit } from '../src/lib/audit/engine';
import { buildReportData } from '../src/lib/report/build';
import { generateReportPdf } from '../src/lib/report/pdf';
import { CATEGORY_LABELS } from '../src/lib/audit/types';
import { FIXTURE_ORIGIN, writeTestEnvFile } from '../tests/test-env';
import { startFixtureServer } from '../tests/fixtures/server';

const prisma = new PrismaClient();

const MARKER = 'full-audit-validation';

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

async function createAudit(userId: string, withCompetitor: boolean) {
  return prisma.audit.create({
    data: {
      userId,
      websiteUrl: FIXTURE_ORIGIN,
      normalizedDomain: '127.0.0.1',
      businessName: 'Northbridge Plumbing Co.',
      industry: 'Home services',
      targetCountry: 'United States',
      targetAudience: 'Homeowners in the Northbridge area',
      primaryServices: 'Drain cleaning, water heater replacement, emergency plumbing',
      businessLocation: 'Northbridge, Massachusetts',
      status: AuditStatus.RUNNING,
      planAtCreation: PlanTier.GROWTH,
      pageLimit: 25,
      competitorLimit: withCompetitor ? 1 : 0,
      consentConfirmed: true,
      isDemo: false,
      competitors: withCompetitor
        ? { create: [{ url: `${FIXTURE_ORIGIN}/services/drain-cleaning` }] }
        : undefined,
    },
    include: { competitors: { select: { id: true, url: true } } },
  });
}

async function main() {
  writeTestEnvFile();
  process.env.ALLOW_TEST_FIXTURE_HOST = '127.0.0.1:4321';
  process.env.CRAWL_DELAY_MS = '0';

  console.log('Starting the fixture website…');
  const server = await startFixtureServer();

  const startedAt = new Date();
  const progressLog: Array<{ percent: number; message: string; step: string }> = [];

  const user = await prisma.user.create({
    data: {
      email: `${MARKER}-${Date.now()}@rankinai-validation.invalid`,
      name: 'Full Audit Validation',
      isDemo: false,
    },
  });

  try {
    // --- Run 1: with a competitor, the complete report ---------------------
    const audit = await createAudit(user.id, true);

    console.log('Running the audit…');
    const runStarted = Date.now();
    const result = await runAudit(audit, async (percent, message, step) => {
      progressLog.push({ percent, message, step: step ?? '' });
      console.log(`  ${String(percent).padStart(3)}%  ${message}`);
    });
    const runDuration = Date.now() - runStarted;

    if (!result.ok) {
      throw new Error(`The audit failed: ${result.failureCode} — ${result.failureMessage}`);
    }

    const [scores, findings, pages, competitors] = await Promise.all([
      prisma.auditScore.findMany({ where: { auditId: audit.id }, orderBy: { category: 'asc' } }),
      prisma.auditFinding.findMany({ where: { auditId: audit.id } }),
      prisma.auditPage.findMany({ where: { auditId: audit.id } }),
      prisma.auditCompetitor.findMany({ where: { auditId: audit.id } }),
    ]);

    // --- PDF ---------------------------------------------------------------
    console.log('Rendering the PDF…');
    const pdfStarted = Date.now();
    const reportData = await buildReportData(audit.id);
    if (!reportData) throw new Error('The report data could not be assembled.');
    const pdf = await generateReportPdf(reportData);
    const pdfDuration = Date.now() - pdfStarted;
    const pdfIsValid =
      pdf.subarray(0, 5).toString('latin1') === '%PDF-' &&
      pdf.subarray(-2048).toString('latin1').includes('%%EOF');

    // --- Run 2: determinism check -----------------------------------------
    console.log('Running the audit a second time to check determinism…');
    const repeat = await createAudit(user.id, true);
    const repeatResult = await runAudit(repeat, async () => {});
    const repeatScores = await prisma.auditScore.findMany({
      where: { auditId: repeat.id },
      orderBy: { category: 'asc' },
    });

    const scoreMatches =
      result.overallScore === repeatResult.overallScore &&
      scores.length === repeatScores.length &&
      scores.every((score, index) => score.score === repeatScores[index]?.score);

    // --- Run 3: no competitor, weight rebalancing --------------------------
    console.log('Running the audit without a competitor to check weight rebalancing…');
    const noCompetitor = await createAudit(user.id, false);
    const noCompetitorResult = await runAudit(noCompetitor, async () => {});
    const noCompetitorScores = await prisma.auditScore.findMany({
      where: { auditId: noCompetitor.id },
    });
    const competitiveScore = noCompetitorScores.find(
      (score) => score.category === 'COMPETITIVE_VISIBILITY',
    );

    const finishedAt = new Date();

    // --- Report ------------------------------------------------------------
    const statusCount = (status: string) =>
      findings.filter((finding) => finding.status === status).length;
    const severityCount = (severity: string) =>
      findings.filter((finding) => finding.severity === severity).length;

    const lines: string[] = [];
    const push = (line = '') => lines.push(line);

    push('# Full Audit Test Report');
    push();
    push(
      'Generated by `npm run audit:full-test`. Every number below is read back from ' +
        'the database after a real audit run — none of it is written by hand.',
    );
    push();
    push(`- **Run started:** ${startedAt.toISOString()}`);
    push(`- **Run finished:** ${finishedAt.toISOString()}`);
    push(
      `- **Target:** \`${FIXTURE_ORIGIN}\` (the controlled test fixture, Northbridge Plumbing Co.)`,
    );
    push(`- **Plan simulated:** Growth (25-page crawl limit, 1 competitor)`);
    push(
      `- **AI narrative enhancement:** ${process.env.OPENAI_API_KEY ? 'enabled' : 'disabled (no OPENAI_API_KEY) — deterministic templates used'}`,
    );
    push(
      `- **Public-web search observations:** ${process.env.SERPER_API_KEY ? 'enabled' : 'disabled (no SERPER_API_KEY)'}`,
    );
    push();

    push('## Result');
    push();
    push('| Measure | Value |');
    push('| --- | --- |');
    push(`| Audit completed | ${result.ok ? 'Yes' : 'No'} |`);
    push(`| Overall AI Visibility Score | ${result.overallScore ?? 'n/a'} / 100 |`);
    push(`| Pages crawled | ${result.pagesCrawled} |`);
    push(`| Findings recorded | ${result.findingCount} |`);
    push(`| Recommendations produced | ${result.recommendationCount} |`);
    push(`| Competitors compared | ${competitors.length} |`);
    push(`| Wall-clock duration | ${formatDuration(runDuration)} |`);
    push();

    push('## Category scores');
    push();
    push('| Category | Score | Available |');
    push('| --- | --- | --- |');
    for (const score of scores) {
      const label = CATEGORY_LABELS[score.category] ?? score.category;
      push(
        `| ${label} | ${score.available ? `${score.score} / 100` : '—'} | ${score.available ? 'Yes' : 'No'} |`,
      );
    }
    push();

    push('## Findings');
    push();
    push('| Breakdown | Count |');
    push('| --- | --- |');
    push(`| Passed | ${statusCount('PASS')} |`);
    push(`| Warnings | ${statusCount('WARN')} |`);
    push(`| Failed | ${statusCount('FAIL')} |`);
    push(`| Not applicable | ${statusCount('NOT_APPLICABLE')} |`);
    push(`| Critical severity | ${severityCount('CRITICAL')} |`);
    push(`| High severity | ${severityCount('HIGH')} |`);
    push(`| Medium severity | ${severityCount('MEDIUM')} |`);
    push(`| Low severity | ${severityCount('LOW')} |`);
    push();
    push(
      `Every finding carries its evidence source: ${
        findings.filter((f) => f.source === 'OBSERVED').length
      } observed directly from the website, ${
        findings.filter((f) => f.source !== 'OBSERVED').length
      } from another source.`,
    );
    push();

    push('## Pages crawled');
    push();
    push('| URL | Status | Words | Role |');
    push('| --- | --- | --- | --- |');
    for (const page of pages.slice(0, 30)) {
      push(
        `| \`${page.url.replace(FIXTURE_ORIGIN, '')}\` | ${page.statusCode ?? '—'} | ${page.wordCount ?? '—'} | ${page.role} |`,
      );
    }
    push();

    push('## Checks performed on this run');
    push();
    push('| Stage | Progress updates |');
    push('| --- | --- |');
    for (const step of [...new Set(progressLog.map((entry) => entry.step))].filter(Boolean)) {
      const count = progressLog.filter((entry) => entry.step === step).length;
      push(`| ${step} | ${count} |`);
    }
    push();

    push('## PDF report');
    push();
    push(`- Rendered in ${formatDuration(pdfDuration)}`);
    push(`- Size: ${(pdf.byteLength / 1024).toFixed(1)} KB`);
    push(
      `- Valid PDF structure (\`%PDF-\` header and \`%%EOF\` trailer): ${pdfIsValid ? 'Yes' : 'No'}`,
    );
    push('- Generated with PDFKit, so no headless browser is needed at runtime.');
    push();

    push('## Determinism');
    push();
    push(
      'The same website was audited twice in a row. Rule-based scoring must produce ' +
        'identical numbers, or the score cannot be used to track improvement over time.',
    );
    push();
    push('| Run | Overall score |');
    push('| --- | --- |');
    push(`| First | ${result.overallScore ?? 'n/a'} |`);
    push(`| Second | ${repeatResult.overallScore ?? 'n/a'} |`);
    push();
    push(`**Identical across all categories: ${scoreMatches ? 'Yes' : 'No'}**`);
    push();

    push('## Weight rebalancing without a competitor');
    push();
    push(
      'Competitive Visibility cannot be scored when no competitor is supplied. Its ' +
        'weight is redistributed across the remaining categories rather than scored as zero.',
    );
    push();
    push(
      `- Competitive Visibility marked available: ${competitiveScore?.available ? 'Yes' : 'No'}`,
    );
    push(`- Overall score with a competitor: ${result.overallScore ?? 'n/a'}`);
    push(`- Overall score without a competitor: ${noCompetitorResult.overallScore ?? 'n/a'}`);
    push();

    push('## What this run does not prove');
    push();
    push(
      '- The target is a controlled fixture, not a live commercial website. It exercises ' +
        'the engine deterministically; it is not a sample of real-world sites.',
    );
    push(
      '- Scores measure signals RankInAI can read from a website. They are not a measurement ' +
        'of whether ChatGPT, Perplexity, Gemini or Copilot actually mention a business, and ' +
        'no audit can establish that.',
    );
    push(
      `- AI narrative enhancement was ${process.env.OPENAI_API_KEY ? 'enabled' : 'disabled'} on this run. ` +
        'Scoring and evidence are rule-based either way; only the written explanations change.',
    );
    push();

    const outputPath = path.join(process.cwd(), 'FULL_AUDIT_TEST_REPORT.md');
    writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
    console.log(`\nWrote ${outputPath}`);

    if (!result.ok || !pdfIsValid || !scoreMatches) {
      console.error('\nValidation FAILED — see the report for details.');
      process.exitCode = 1;
    } else {
      console.log('Validation passed.');
    }
  } finally {
    // Remove everything this run created. Cascades handle the audit children.
    await prisma.audit.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
