'use server';

import { redirect } from 'next/navigation';

import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/guards';
import { isProductKey } from '@/lib/plans';
import {
  formValue,
  onboardingSchema,
  optionalFormValue,
  zodFieldErrors,
  type ActionResult,
} from '@/lib/validation';

/**
 * Onboarding.
 *
 * A plan selected before registration is preserved on the profile and, once
 * onboarding finishes, the user is sent straight to checkout for it.
 */
async function nextDestination(userId: string): Promise<string> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { pendingPlanSelection: true },
  });

  const pending = profile?.pendingPlanSelection;
  if (pending && isProductKey(pending)) {
    await prisma.userProfile.update({
      where: { userId },
      data: { pendingPlanSelection: null },
    });
    return `/checkout/start?plan=${pending}`;
  }

  return '/dashboard';
}

export async function completeOnboardingAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser('/onboarding');

  const parsed = onboardingSchema.safeParse({
    fullName: formValue(formData, 'fullName'),
    companyName: optionalFormValue(formData, 'companyName') ?? '',
    companyWebsite: optionalFormValue(formData, 'companyWebsite') ?? '',
    primaryUseCase: optionalFormValue(formData, 'primaryUseCase'),
    businessType: optionalFormValue(formData, 'businessType'),
    auditingOwnWebsite: optionalFormValue(formData, 'auditingOwnWebsite'),
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
      data: { name: parsed.data.fullName },
    }),
    prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        fullName: parsed.data.fullName,
        companyName: parsed.data.companyName || null,
        companyWebsite: parsed.data.companyWebsite || null,
        primaryUseCase: parsed.data.primaryUseCase ?? null,
        businessType: parsed.data.businessType ?? null,
        auditingOwnWebsite:
          parsed.data.auditingOwnWebsite === 'client'
            ? false
            : parsed.data.auditingOwnWebsite
              ? true
              : null,
        onboardingCompleted: true,
      },
      update: {
        fullName: parsed.data.fullName,
        companyName: parsed.data.companyName || null,
        companyWebsite: parsed.data.companyWebsite || null,
        primaryUseCase: parsed.data.primaryUseCase ?? null,
        businessType: parsed.data.businessType ?? null,
        auditingOwnWebsite:
          parsed.data.auditingOwnWebsite === 'client'
            ? false
            : parsed.data.auditingOwnWebsite
              ? true
              : null,
        onboardingCompleted: true,
      },
    }),
  ]);

  redirect(await nextDestination(user.id));
}

export async function skipOnboardingAction(): Promise<never> {
  const user = await requireUser('/onboarding');

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, onboardingSkipped: true },
    update: { onboardingSkipped: true },
  });

  redirect(await nextDestination(user.id));
}
