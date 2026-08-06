import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { clientIp, clientIpHash, hashIdentifier } from '@/lib/crypto';
import { RATE_LIMITS, consumeRateLimit, rateLimitMessage } from '@/lib/rate-limit';
import { PREVIEW_DISCLAIMER, runFreePreview } from '@/lib/audit/preview';
import { freePreviewSchema } from '@/lib/validation';
import { getSettings } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Anonymous homepage preview.
 *
 * Protections: honeypot, per-IP rate limit, SSRF-safe fetch, single page only,
 * and only hashed operational metadata is persisted.
 */
export async function POST(request: Request) {
  const settings = await getSettings();
  if (!settings.freePreviewEnabled) {
    return NextResponse.json(
      { ok: false, error: 'The free preview is temporarily unavailable. Please try again later.' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }

  const parsed = freePreviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Enter a valid website address.',
      },
      { status: 400 },
    );
  }

  // Honeypot: a filled field means an automated submission. Respond as if it
  // succeeded-but-empty rather than revealing the trap.
  if (parsed.data.company && parsed.data.company.trim().length > 0) {
    return NextResponse.json(
      { ok: false, error: 'We could not analyze that website. Please try another address.' },
      { status: 400 },
    );
  }

  const ip = clientIp(request.headers);
  const limit = await consumeRateLimit(RATE_LIMITS.freePreview, ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: rateLimitMessage(limit), retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const result = await runFreePreview(parsed.data.url);

  const domain = (() => {
    try {
      return new URL(parsed.data.url).hostname.replace(/^www\./, '');
    } catch {
      return 'unknown';
    }
  })();

  // Store only the minimum operational metadata. No page content is retained.
  await prisma.freePreviewRun
    .create({
      data: {
        domain,
        domainHash: hashIdentifier(domain),
        ipHash: clientIpHash(request.headers),
        score: result.ok ? result.previewScore : null,
        findingCount: result.ok ? result.findings.length : 0,
        succeeded: result.ok,
        errorCode: result.ok ? null : result.code,
        durationMs: result.durationMs,
      },
    })
    .catch(() => undefined);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.message }, { status: 422 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      domain: result.domain,
      finalUrl: result.finalUrl,
      previewScore: result.previewScore,
      title: result.title,
      findings: result.findings.map((f) => ({
        categoryLabel: f.categoryLabel,
        title: f.title,
        severity: f.severity,
        detail: f.detail,
        passed: f.passed,
      })),
      checkedCount: result.checkedCount,
      totalIssuesFound: result.totalIssuesFound,
      disclaimer: PREVIEW_DISCLAIMER,
    },
  });
}
