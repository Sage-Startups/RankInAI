'use server';

import { revalidatePath } from 'next/cache';
import { AccountStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/guards';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { generateToken, hashToken } from '@/lib/crypto';
import { getEnv } from '@/lib/env';
import { sendEmailVerification } from '@/lib/email';
import {
  brandingSchema,
  changePasswordSchema,
  emailPreferencesSchema,
  formChecked,
  formValue,
  optionalFormValue,
  profileSchema,
  zodFieldErrors,
  type ActionResult,
} from '@/lib/validation';

export async function updateProfileAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser('/dashboard/settings');

  const parsed = profileSchema.safeParse({
    name: formValue(formData, 'name'),
    companyName: optionalFormValue(formData, 'companyName') ?? '',
    companyWebsite: optionalFormValue(formData, 'companyWebsite') ?? '',
    businessType: optionalFormValue(formData, 'businessType') ?? '',
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please correct the highlighted fields.',
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { name: parsed.data.name },
    }),
    prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        fullName: parsed.data.name,
        companyName: parsed.data.companyName || null,
        companyWebsite: parsed.data.companyWebsite || null,
        businessType: parsed.data.businessType || null,
      },
      update: {
        fullName: parsed.data.name,
        companyName: parsed.data.companyName || null,
        companyWebsite: parsed.data.companyWebsite || null,
        businessType: parsed.data.businessType || null,
      },
    }),
  ]);

  revalidatePath('/dashboard/settings');
  return { ok: true, message: 'Profile updated.' };
}

export async function changePasswordAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser('/dashboard/settings');

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formValue(formData, 'currentPassword'),
    newPassword: formValue(formData, 'newPassword'),
    confirmPassword: formValue(formData, 'confirmPassword'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please correct the highlighted fields.',
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const record = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  const valid = await verifyPassword(parsed.data.currentPassword, record.passwordHash);
  if (!valid) {
    return {
      ok: false,
      message: 'Your current password is not correct.',
      fieldErrors: { currentPassword: ['That password is not correct.'] },
    };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(parsed.data.newPassword) },
    }),
    // Any outstanding reset links become invalid after a deliberate change.
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true, message: 'Password updated.' };
}

export async function updateEmailPreferencesAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser('/dashboard/settings');

  const parsed = emailPreferencesSchema.safeParse({
    emailProductUpdates: formChecked(formData, 'emailProductUpdates'),
    emailAuditComplete: formChecked(formData, 'emailAuditComplete'),
    emailMarketing: formChecked(formData, 'emailMarketing'),
  });

  if (!parsed.success) {
    return { ok: false, message: 'Those preferences could not be saved.' };
  }

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...parsed.data },
    update: parsed.data,
  });

  revalidatePath('/dashboard/settings');
  return { ok: true, message: 'Email preferences saved.' };
}

export async function updateBrandingAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser('/dashboard/settings');

  const parsed = brandingSchema.safeParse({
    brandingCompanyName: optionalFormValue(formData, 'brandingCompanyName') ?? '',
    brandingLogoUrl: optionalFormValue(formData, 'brandingLogoUrl') ?? '',
    brandingAccentColor: optionalFormValue(formData, 'brandingAccentColor') ?? '',
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please correct the highlighted fields.',
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      brandingCompanyName: parsed.data.brandingCompanyName || null,
      brandingLogoUrl: parsed.data.brandingLogoUrl || null,
      brandingAccentColor: parsed.data.brandingAccentColor || null,
    },
    update: {
      brandingCompanyName: parsed.data.brandingCompanyName || null,
      brandingLogoUrl: parsed.data.brandingLogoUrl || null,
      brandingAccentColor: parsed.data.brandingAccentColor || null,
    },
  });

  revalidatePath('/dashboard/settings');
  return { ok: true, message: 'Default report branding saved.' };
}

export async function sendVerificationEmailAction(
  _previous: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser('/dashboard/settings');

  if (user.emailVerified) {
    return { ok: true, message: 'Your email address is already verified.' };
  }

  await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = generateToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const appUrl = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  await sendEmailVerification(user.email, `${appUrl}/verify-email?token=${token}`);

  return {
    ok: true,
    message: 'Confirmation email sent. Check your inbox — the link expires in 24 hours.',
  };
}

/**
 * Account deletion request.
 *
 * Flags the account rather than hard-deleting immediately: financial records
 * must be retained, and a flagged account can be recovered by support if the
 * request was a mistake.
 */
export async function requestAccountDeletionAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser('/dashboard/settings');

  const confirmation = (formValue(formData, 'confirm') ?? '').trim();
  if (confirmation !== 'DELETE') {
    return {
      ok: false,
      message: 'Type DELETE to confirm you want your account removed.',
      fieldErrors: { confirm: ['Type DELETE exactly to confirm.'] },
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      deletionRequestedAt: new Date(),
      status: AccountStatus.PENDING_DELETION,
    },
  });

  revalidatePath('/dashboard/settings');
  return {
    ok: true,
    message:
      'Your deletion request has been recorded. Your personal data will be removed within 30 days. Financial records are retained where the law requires it. Contact support if you change your mind.',
  };
}
