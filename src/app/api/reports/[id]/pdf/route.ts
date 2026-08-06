import { NextResponse } from 'next/server';
import { AuditStatus, Role } from '@prisma/client';

import { prisma } from '@/lib/db';
import { requireApiUser } from '@/lib/auth/guards';
import { RATE_LIMITS, consumeRateLimit, rateLimitMessage } from '@/lib/rate-limit';
import { buildReportData } from '@/lib/report/build';
import { generateReportPdf } from '@/lib/report/pdf';
import { getSettings } from '@/lib/settings';
import { trackEvent } from '@/lib/analytics';
import { slugify } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// PDF generation for a large audit can take a few seconds.
export const maxDuration = 60;

/**
 * Download the PDF report for an audit.
 *
 * The generated PDF is cached in the database (no local disk dependency) and
 * regenerated only when the stored copy is missing.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { id } = await params;

  const limit = await consumeRateLimit(RATE_LIMITS.reportDownload, `user:${auth.user.id}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: rateLimitMessage(limit) },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const audit = await prisma.audit.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(auth.user.role === Role.SUPER_ADMIN ? {} : { userId: auth.user.id }),
    },
    select: {
      id: true,
      status: true,
      businessName: true,
      whiteLabel: true,
      brandingName: true,
      isDemo: true,
      completedAt: true,
    },
  });

  if (!audit) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  }

  if (audit.status !== AuditStatus.COMPLETED) {
    return NextResponse.json(
      { error: 'This audit has not completed yet, so there is no report to download.' },
      { status: 409 },
    );
  }

  const filename = `rankinai-audit-${slugify(audit.businessName) || 'report'}-${
    audit.completedAt ? audit.completedAt.toISOString().slice(0, 10) : 'report'
  }.pdf`;

  // Serve the cached copy when one exists.
  const cached = await prisma.report.findFirst({
    where: { auditId: audit.id },
    orderBy: { version: 'desc' },
  });

  if (cached?.pdfData && cached.pdfBytes > 0) {
    await prisma.report.update({
      where: { id: cached.id },
      data: { downloadCount: { increment: 1 } },
    });
    await trackEvent({
      name: 'report_downloaded',
      userId: auth.user.id,
      properties: { auditId: audit.id, result: 'cached' },
    });

    return new NextResponse(new Uint8Array(cached.pdfData), {
      headers: pdfHeaders(filename, cached.pdfBytes),
    });
  }

  const [data, settings] = await Promise.all([buildReportData(audit.id), getSettings()]);
  if (!data) {
    return NextResponse.json({ error: 'Report data could not be loaded.' }, { status: 500 });
  }

  try {
    const buffer = await generateReportPdf(data, { footerNote: settings.defaultReportFooter });
    // Normalize to a plain Uint8Array backed by a non-shared ArrayBuffer so it
    // satisfies both the Prisma Bytes field and the Response body type.
    const bytes = new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);

    await prisma.report.upsert({
      where: { auditId_version: { auditId: audit.id, version: 1 } },
      create: {
        auditId: audit.id,
        version: 1,
        brandingName: audit.whiteLabel ? audit.brandingName : null,
        whiteLabel: audit.whiteLabel,
        pdfData: bytes,
        pdfBytes: bytes.byteLength,
        generatedAt: new Date(),
        downloadCount: 1,
        isDemo: audit.isDemo,
        pdfError: null,
      },
      update: {
        pdfData: bytes,
        pdfBytes: bytes.byteLength,
        generatedAt: new Date(),
        downloadCount: { increment: 1 },
        pdfError: null,
      },
    });

    await trackEvent({
      name: 'report_downloaded',
      userId: auth.user.id,
      properties: { auditId: audit.id, result: 'generated' },
    });

    return new NextResponse(bytes, {
      headers: pdfHeaders(filename, bytes.byteLength),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown PDF generation error';
    // Record the failure for the admin view; never surface internals to the user.
    await prisma.report
      .upsert({
        where: { auditId_version: { auditId: audit.id, version: 1 } },
        create: {
          auditId: audit.id,
          version: 1,
          whiteLabel: audit.whiteLabel,
          pdfBytes: 0,
          pdfError: detail.slice(0, 500),
          isDemo: audit.isDemo,
        },
        update: { pdfError: detail.slice(0, 500) },
      })
      .catch(() => undefined);

    return NextResponse.json(
      {
        error:
          'We could not generate the PDF for this report. The online report is still available, and our team has been notified.',
      },
      { status: 500 },
    );
  }
}

function pdfHeaders(filename: string, length: number): HeadersInit {
  return {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': String(length),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  };
}
