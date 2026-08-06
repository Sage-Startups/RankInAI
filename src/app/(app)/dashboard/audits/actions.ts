'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { AuditStatus, CreditSource, JobStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/guards';
import { clientIp } from '@/lib/crypto';
import { RATE_LIMITS, consumeRateLimit, rateLimitMessage } from '@/lib/rate-limit';
import {
  InsufficientCreditsError,
  effectiveAuditLimits,
  getEntitlements,
  reserveAuditCredit,
} from '@/lib/credits';
import { validateAuditUrl, registrableDomain } from '@/lib/audit/url-safety';
import { trackEvent } from '@/lib/analytics';
import { getSettings } from '@/lib/settings';
import {
  createAuditSchema,
  formChecked,
  formValue,
  optionalFormValue,
  zodFieldErrors,
  type ActionResult,
} from '@/lib/validation';

/**
 * Audit lifecycle actions.
 *
 * The credit is reserved atomically at creation time and restored by the worker
 * if the job fails before producing results.
 */

export async function createAuditAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser('/dashboard/audits/new');

  const competitorUrls = formData
    .getAll('competitorUrls')
    .map((v) => String(v).trim())
    .filter(Boolean);

  const parsed = createAuditSchema.safeParse({
    websiteUrl: formValue(formData, 'websiteUrl'),
    businessName: formValue(formData, 'businessName'),
    industry: optionalFormValue(formData, 'industry'),
    targetCountry: optionalFormValue(formData, 'targetCountry') ?? 'United States',
    targetAudience: optionalFormValue(formData, 'targetAudience') ?? '',
    primaryServices: optionalFormValue(formData, 'primaryServices') ?? '',
    businessLocation: optionalFormValue(formData, 'businessLocation') ?? '',
    competitorUrls,
    brandingName: optionalFormValue(formData, 'brandingName') ?? '',
    brandingLogoUrl: optionalFormValue(formData, 'brandingLogoUrl') ?? '',
    whiteLabel: formChecked(formData, 'whiteLabel'),
    consentConfirmed: formValue(formData, 'consentConfirmed'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please correct the highlighted fields.',
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const headerList = await headers();
  const limit = await consumeRateLimit(RATE_LIMITS.auditCreate, `user:${user.id}`);
  if (!limit.allowed) {
    return { ok: false, message: rateLimitMessage(limit) };
  }
  void clientIp(headerList);

  const [entitlements, settings] = await Promise.all([getEntitlements(user.id), getSettings()]);

  if (!entitlements.canCreateAudit) {
    return {
      ok: false,
      message:
        'You have no audits remaining. Buy a one-time audit or upgrade your plan from the billing page.',
    };
  }

  const limits = effectiveAuditLimits(entitlements);
  const pageLimit = Math.min(limits.pageLimit, settings.maxCrawlPagesHardLimit);

  // Validate and de-duplicate competitor URLs against the plan's limit.
  const validCompetitors: string[] = [];
  const seenCompetitors = new Set<string>();
  for (const raw of competitorUrls) {
    const validated = validateAuditUrl(raw);
    if (!validated.ok) {
      return {
        ok: false,
        message: `Competitor URL problem: ${validated.message}`,
        fieldErrors: { competitorUrls: [validated.message] },
      };
    }
    const key = validated.domain;
    if (seenCompetitors.has(key)) continue;
    seenCompetitors.add(key);
    validCompetitors.push(validated.normalized);
  }

  if (validCompetitors.length > limits.competitorLimit) {
    return {
      ok: false,
      message: `Your plan allows up to ${limits.competitorLimit} ${
        limits.competitorLimit === 1 ? 'competitor' : 'competitors'
      } per audit.`,
      fieldErrors: { competitorUrls: ['Too many competitor URLs for your current plan.'] },
    };
  }

  const site = validateAuditUrl(parsed.data.websiteUrl);
  if (!site.ok) {
    return { ok: false, message: site.message, fieldErrors: { websiteUrl: [site.message] } };
  }

  const whiteLabel = limits.whiteLabel && parsed.data.whiteLabel;

  const audit = await prisma.audit.create({
    data: {
      userId: user.id,
      websiteUrl: site.normalized,
      normalizedDomain: registrableDomain(site.hostname),
      businessName: parsed.data.businessName,
      industry: parsed.data.industry ?? null,
      targetCountry: parsed.data.targetCountry || 'United States',
      targetAudience: parsed.data.targetAudience || null,
      primaryServices: parsed.data.primaryServices || null,
      businessLocation: parsed.data.businessLocation || null,
      status: AuditStatus.DRAFT,
      planAtCreation: entitlements.plan,
      pageLimit,
      competitorLimit: limits.competitorLimit,
      brandingName: whiteLabel ? parsed.data.brandingName || null : null,
      brandingLogoUrl: whiteLabel ? parsed.data.brandingLogoUrl || null : null,
      whiteLabel,
      consentConfirmed: true,
      isDemo: false,
      competitors: {
        create: validCompetitors.map((url) => ({ url })),
      },
    },
    select: { id: true },
  });

  // Reserve the credit before queueing. If this throws, the draft audit is
  // removed so it cannot be run without payment.
  let creditSource: CreditSource;
  try {
    const used = await reserveAuditCredit(user.id, audit.id, false);
    creditSource =
      used === 'ONE_TIME_CREDIT'
        ? CreditSource.ONE_TIME_CREDIT
        : CreditSource.SUBSCRIPTION_ALLOWANCE;
  } catch (error) {
    await prisma.audit.delete({ where: { id: audit.id } });
    if (error instanceof InsufficientCreditsError) {
      return {
        ok: false,
        message:
          'You have no audits remaining. Buy a one-time audit or upgrade your plan from the billing page.',
      };
    }
    throw error;
  }

  await prisma.$transaction([
    prisma.audit.update({
      where: { id: audit.id },
      data: { status: AuditStatus.QUEUED, creditSource },
    }),
    prisma.auditJob.create({
      data: {
        auditId: audit.id,
        status: JobStatus.QUEUED,
        progressMessage: 'Waiting for an available worker',
        isDemo: false,
      },
    }),
  ]);

  await trackEvent({
    name: 'audit_created',
    userId: user.id,
    properties: { auditId: audit.id, plan: entitlements.plan, pageCount: pageLimit },
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/audits');
  redirect(`/dashboard/audits/${audit.id}`);
}

export async function archiveAuditAction(auditId: string): Promise<ActionResult> {
  const user = await requireUser('/dashboard/audits');

  const audit = await prisma.audit.findFirst({
    where: { id: auditId, userId: user.id, deletedAt: null },
    select: { id: true, archivedAt: true },
  });
  if (!audit) return { ok: false, message: 'Audit not found.' };

  await prisma.audit.update({
    where: { id: audit.id },
    data: { archivedAt: audit.archivedAt ? null : new Date() },
  });

  revalidatePath('/dashboard/audits');
  revalidatePath(`/dashboard/audits/${auditId}`);
  return {
    ok: true,
    message: audit.archivedAt ? 'Audit restored.' : 'Audit archived.',
  };
}

export async function deleteAuditAction(auditId: string): Promise<ActionResult> {
  const user = await requireUser('/dashboard/audits');

  const audit = await prisma.audit.findFirst({
    where: { id: auditId, userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!audit) return { ok: false, message: 'Audit not found.' };

  // Soft delete — the audit disappears from the customer's view but financial
  // and usage history remain intact.
  await prisma.audit.update({
    where: { id: audit.id },
    data: { deletedAt: new Date() },
  });

  revalidatePath('/dashboard/audits');
  revalidatePath('/dashboard');
  return { ok: true, message: 'Audit deleted.' };
}

/**
 * Re-run an audit: creates a fresh audit with the same inputs and consumes a
 * new credit. The original is kept so the score history is preserved.
 */
export async function rerunAuditAction(auditId: string): Promise<ActionResult> {
  const user = await requireUser('/dashboard/audits');

  const original = await prisma.audit.findFirst({
    where: { id: auditId, userId: user.id, deletedAt: null },
    include: { competitors: { select: { url: true } } },
  });
  if (!original) return { ok: false, message: 'Audit not found.' };

  const [entitlements, settings] = await Promise.all([getEntitlements(user.id), getSettings()]);
  if (!entitlements.canCreateAudit) {
    return {
      ok: false,
      message:
        'You have no audits remaining. Buy a one-time audit or upgrade your plan to re-run this audit.',
    };
  }

  const limits = effectiveAuditLimits(entitlements);
  const pageLimit = Math.min(limits.pageLimit, settings.maxCrawlPagesHardLimit);

  const audit = await prisma.audit.create({
    data: {
      userId: user.id,
      websiteUrl: original.websiteUrl,
      normalizedDomain: original.normalizedDomain,
      businessName: original.businessName,
      industry: original.industry,
      targetCountry: original.targetCountry,
      targetAudience: original.targetAudience,
      primaryServices: original.primaryServices,
      businessLocation: original.businessLocation,
      status: AuditStatus.DRAFT,
      planAtCreation: entitlements.plan,
      pageLimit,
      competitorLimit: limits.competitorLimit,
      brandingName: original.brandingName,
      brandingLogoUrl: original.brandingLogoUrl,
      whiteLabel: limits.whiteLabel && original.whiteLabel,
      consentConfirmed: true,
      isDemo: false,
      competitors: {
        create: original.competitors.slice(0, limits.competitorLimit).map((c) => ({ url: c.url })),
      },
    },
    select: { id: true },
  });

  let creditSource: CreditSource;
  try {
    const used = await reserveAuditCredit(user.id, audit.id, false);
    creditSource =
      used === 'ONE_TIME_CREDIT'
        ? CreditSource.ONE_TIME_CREDIT
        : CreditSource.SUBSCRIPTION_ALLOWANCE;
  } catch (error) {
    await prisma.audit.delete({ where: { id: audit.id } });
    if (error instanceof InsufficientCreditsError) {
      return { ok: false, message: 'You have no audits remaining.' };
    }
    throw error;
  }

  await prisma.$transaction([
    prisma.audit.update({
      where: { id: audit.id },
      data: { status: AuditStatus.QUEUED, creditSource },
    }),
    prisma.auditJob.create({
      data: {
        auditId: audit.id,
        status: JobStatus.QUEUED,
        progressMessage: 'Waiting for an available worker',
      },
    }),
  ]);

  await trackEvent({ name: 'audit_created', userId: user.id, properties: { source: 'rerun' } });

  revalidatePath('/dashboard/audits');
  redirect(`/dashboard/audits/${audit.id}`);
}
