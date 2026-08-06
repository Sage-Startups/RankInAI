'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { AccountStatus, ContactStatus, CreditReason, Role } from '@prisma/client';

import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/guards';
import { clientIpHash } from '@/lib/crypto';
import { grantCredits, revokeCredits } from '@/lib/credits';
import { cancelJob, retryJob } from '@/lib/queue';
import { logAdminAction } from '@/lib/admin-log';
import { invalidateSettingsCache, updateSettings } from '@/lib/settings';
import {
  adminCreditSchema,
  adminRoleSchema,
  adminSettingsSchema,
  adminSuspendSchema,
  formChecked,
  formValue,
  optionalFormValue,
  zodFieldErrors,
  type ActionResult,
} from '@/lib/validation';

/**
 * Super-admin actions.
 *
 * Every one of these re-checks the caller's role server-side through
 * `requireAdmin` and writes an entry to the admin audit trail.
 */

export async function adjustCreditsAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = adminCreditSchema.safeParse({
    userId: formValue(formData, 'userId'),
    amount: formValue(formData, 'amount'),
    reason: formValue(formData, 'reason'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please correct the highlighted fields.',
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, email: true, isDemo: true },
  });
  if (!target) return { ok: false, message: 'That user no longer exists.' };

  const balance =
    parsed.data.amount > 0
      ? await grantCredits({
          userId: target.id,
          amount: parsed.data.amount,
          reason: CreditReason.ADMIN_GRANT,
          note: parsed.data.reason,
          adminUserId: admin.id,
          isDemo: target.isDemo,
        })
      : await revokeCredits({
          userId: target.id,
          amount: Math.abs(parsed.data.amount),
          note: parsed.data.reason,
          adminUserId: admin.id,
        });

  await logAdminAction({
    adminUserId: admin.id,
    action: parsed.data.amount > 0 ? 'user.credits_grant' : 'user.credits_revoke',
    targetType: 'user',
    targetId: target.id,
    summary: `${parsed.data.amount > 0 ? 'Granted' : 'Revoked'} ${Math.abs(parsed.data.amount)} credit(s) for ${target.email}`,
    detail: { amount: parsed.data.amount, reason: parsed.data.reason, balanceAfter: balance },
    ipHash: clientIpHash(await headers()),
  });

  revalidatePath(`/admin/users/${target.id}`);
  revalidatePath('/admin/users');

  return {
    ok: true,
    message: `Credit balance updated. New balance: ${balance}.`,
  };
}

export async function setSuspensionAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = adminSuspendSchema.safeParse({
    userId: formValue(formData, 'userId'),
    suspend: formValue(formData, 'suspend') === 'true',
    reason: optionalFormValue(formData, 'reason') ?? '',
  });

  if (!parsed.success) {
    return { ok: false, message: 'That request was not valid.' };
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, email: true, role: true },
  });
  if (!target) return { ok: false, message: 'That user no longer exists.' };

  if (parsed.data.suspend && target.id === admin.id) {
    return { ok: false, message: 'You cannot suspend your own account.' };
  }

  await prisma.user.update({
    where: { id: target.id },
    data: parsed.data.suspend
      ? {
          status: AccountStatus.SUSPENDED,
          suspendedAt: new Date(),
          suspendedReason: parsed.data.reason || 'Suspended by an administrator',
        }
      : { status: AccountStatus.ACTIVE, suspendedAt: null, suspendedReason: null },
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: parsed.data.suspend ? 'user.suspend' : 'user.reactivate',
    targetType: 'user',
    targetId: target.id,
    summary: `${parsed.data.suspend ? 'Suspended' : 'Reactivated'} ${target.email}`,
    detail: { reason: parsed.data.reason || null },
    ipHash: clientIpHash(await headers()),
  });

  revalidatePath(`/admin/users/${target.id}`);
  revalidatePath('/admin/users');

  return {
    ok: true,
    message: parsed.data.suspend ? 'Account suspended.' : 'Account reactivated.',
  };
}

export async function changeRoleAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = adminRoleSchema.safeParse({
    userId: formValue(formData, 'userId'),
    role: formValue(formData, 'role'),
    confirm: formValue(formData, 'confirm'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please correct the highlighted fields.',
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, email: true, role: true },
  });
  if (!target) return { ok: false, message: 'That user no longer exists.' };

  if (target.id === admin.id && parsed.data.role !== Role.SUPER_ADMIN) {
    return { ok: false, message: 'You cannot remove your own administrator access.' };
  }

  // Never allow the last super admin to be demoted — that would lock everyone
  // out of the admin area permanently.
  if (target.role === Role.SUPER_ADMIN && parsed.data.role !== Role.SUPER_ADMIN) {
    const remaining = await prisma.user.count({
      where: { role: Role.SUPER_ADMIN, deletedAt: null, id: { not: target.id } },
    });
    if (remaining === 0) {
      return {
        ok: false,
        message: 'This is the only remaining super admin. Promote another account first.',
      };
    }
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: 'user.role_change',
    targetType: 'user',
    targetId: target.id,
    summary: `Changed role for ${target.email} from ${target.role} to ${parsed.data.role}`,
    detail: { from: target.role, to: parsed.data.role },
    ipHash: clientIpHash(await headers()),
  });

  revalidatePath(`/admin/users/${target.id}`);
  revalidatePath('/admin/users');

  return { ok: true, message: `Role updated to ${parsed.data.role}.` };
}

export async function retryAuditAction(auditId: string): Promise<ActionResult> {
  const admin = await requireAdmin();

  const ok = await retryJob(auditId);
  if (!ok) {
    return {
      ok: false,
      message: 'That audit could not be requeued. It may already be running.',
    };
  }

  await logAdminAction({
    adminUserId: admin.id,
    action: 'audit.retry',
    targetType: 'audit',
    targetId: auditId,
    summary: `Requeued audit ${auditId}`,
    ipHash: clientIpHash(await headers()),
  });

  revalidatePath('/admin/jobs');
  revalidatePath('/admin/audits');
  return { ok: true, message: 'Audit requeued.' };
}

export async function cancelAuditAction(auditId: string): Promise<ActionResult> {
  const admin = await requireAdmin();

  const ok = await cancelJob(auditId);
  if (!ok) {
    return {
      ok: false,
      message: 'Only queued audits can be canceled.',
    };
  }

  await logAdminAction({
    adminUserId: admin.id,
    action: 'audit.cancel',
    targetType: 'audit',
    targetId: auditId,
    summary: `Canceled queued audit ${auditId}`,
    ipHash: clientIpHash(await headers()),
  });

  revalidatePath('/admin/jobs');
  revalidatePath('/admin/audits');
  return { ok: true, message: 'Audit canceled and the credit returned.' };
}

export async function archiveAuditAdminAction(auditId: string): Promise<ActionResult> {
  const admin = await requireAdmin();

  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { id: true, archivedAt: true },
  });
  if (!audit) return { ok: false, message: 'Audit not found.' };

  await prisma.audit.update({
    where: { id: audit.id },
    data: { archivedAt: audit.archivedAt ? null : new Date() },
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: 'audit.archive',
    targetType: 'audit',
    targetId: audit.id,
    summary: `${audit.archivedAt ? 'Restored' : 'Archived'} audit ${audit.id}`,
    ipHash: clientIpHash(await headers()),
  });

  revalidatePath('/admin/audits');
  return { ok: true, message: audit.archivedAt ? 'Audit restored.' : 'Audit archived.' };
}

export async function setContactStatusAction(
  contactId: string,
  status: ContactStatus,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const contact = await prisma.contactSubmission.findUnique({
    where: { id: contactId },
    select: { id: true, email: true },
  });
  if (!contact) return { ok: false, message: 'Submission not found.' };

  await prisma.contactSubmission.update({
    where: { id: contact.id },
    data: {
      status,
      handledById: admin.id,
      handledAt: new Date(),
    },
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: 'contact.status_change',
    targetType: 'contact',
    targetId: contact.id,
    summary: `Marked contact submission as ${status.toLowerCase()}`,
    detail: { status },
    ipHash: clientIpHash(await headers()),
  });

  revalidatePath('/admin/contacts');
  return { ok: true, message: `Marked as ${status.toLowerCase()}.` };
}

export async function updateSettingsAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = adminSettingsSchema.safeParse({
    applicationName: formValue(formData, 'applicationName'),
    supportEmail: formValue(formData, 'supportEmail'),
    demoModeEnabled: formChecked(formData, 'demoModeEnabled'),
    freePreviewEnabled: formChecked(formData, 'freePreviewEnabled'),
    maxCrawlPagesHardLimit: formValue(formData, 'maxCrawlPagesHardLimit'),
    maintenanceBannerEnabled: formChecked(formData, 'maintenanceBannerEnabled'),
    maintenanceBannerText: optionalFormValue(formData, 'maintenanceBannerText') ?? '',
    llmEnhancementEnabled: formChecked(formData, 'llmEnhancementEnabled'),
    searchObservationsEnabled: formChecked(formData, 'searchObservationsEnabled'),
    legalTemplateWarningEnabled: formChecked(formData, 'legalTemplateWarningEnabled'),
    defaultReportFooter: optionalFormValue(formData, 'defaultReportFooter') ?? '',
    signupsEnabled: formChecked(formData, 'signupsEnabled'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please correct the highlighted fields.',
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  await updateSettings(
    {
      ...parsed.data,
      maintenanceBannerText: parsed.data.maintenanceBannerText || '',
      defaultReportFooter:
        parsed.data.defaultReportFooter ||
        'Generated by RankInAI — AI visibility and GEO audit platform.',
    },
    admin.id,
  );

  invalidateSettingsCache();

  await logAdminAction({
    adminUserId: admin.id,
    action: 'settings.update',
    targetType: 'settings',
    targetId: 'app.settings',
    summary: 'Updated system settings',
    detail: { keys: Object.keys(parsed.data) },
    ipHash: clientIpHash(await headers()),
  });

  revalidatePath('/admin/settings');
  revalidatePath('/', 'layout');

  return { ok: true, message: 'Settings saved.' };
}
