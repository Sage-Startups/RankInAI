import { NextResponse } from 'next/server';
import { AuditStatus, Role } from '@prisma/client';

import { prisma } from '@/lib/db';
import { requireApiUser } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lightweight progress endpoint polled by the audit detail page. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { id } = await params;

  const audit = await prisma.audit.findFirst({
    where: {
      id,
      deletedAt: null,
      // Owners see their own audits; super admins may inspect any audit.
      ...(auth.user.role === Role.SUPER_ADMIN ? {} : { userId: auth.user.id }),
    },
    select: {
      status: true,
      overallScore: true,
      failureMessage: true,
      job: { select: { progress: true, progressMessage: true, currentStep: true } },
    },
  });

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found.' }, { status: 404 });
  }

  const finished =
    audit.status === AuditStatus.COMPLETED ||
    audit.status === AuditStatus.FAILED ||
    audit.status === AuditStatus.CANCELED;

  return NextResponse.json(
    {
      status: audit.status,
      progress: finished ? 100 : (audit.job?.progress ?? 0),
      message: audit.job?.progressMessage ?? null,
      step: audit.job?.currentStep ?? null,
      score: audit.overallScore,
      failureMessage: audit.failureMessage,
      finished,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
