'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AccountStatus, Role } from '@prisma/client';
import { AuthError } from 'next-auth';

import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { signIn } from '@/lib/auth';
import { hashPassword, normalizeEmail } from '@/lib/auth/password';
import { clientIp, generateToken, hashToken } from '@/lib/crypto';
import { RATE_LIMITS, consumeRateLimit, rateLimitMessage } from '@/lib/rate-limit';
import { sendPasswordResetEmail, sendWelcomeEmail } from '@/lib/email';
import { trackEvent } from '@/lib/analytics';
import { getSettings } from '@/lib/settings';
import { isProductKey } from '@/lib/plans';
import {
  formValue,
  forgotPasswordSchema,
  optionalFormValue,
  resetPasswordSchema,
  signUpSchema,
  zodFieldErrors,
  type ActionResult,
} from '@/lib/validation';

const RESET_TOKEN_TTL_MINUTES = 60;

/** Only same-origin relative paths may be used as a post-sign-in redirect. */
function safeCallbackUrl(value: FormDataEntryValue | null): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
  return raw;
}

/* -------------------------------------------------------------------------- */
/* Sign up                                                                     */
/* -------------------------------------------------------------------------- */

export async function signUpAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const settings = await getSettings();
  if (!settings.signupsEnabled) {
    return {
      ok: false,
      message: 'New registrations are temporarily closed. Please check back soon.',
    };
  }

  const parsed = signUpSchema.safeParse({
    name: formValue(formData, 'name'),
    email: formValue(formData, 'email'),
    password: formValue(formData, 'password'),
    confirmPassword: formValue(formData, 'confirmPassword'),
    acceptTerms: formValue(formData, 'acceptTerms'),
    plan: optionalFormValue(formData, 'plan'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please correct the highlighted fields.',
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const headerList = await headers();
  const limit = await consumeRateLimit(RATE_LIMITS.signUp, clientIp(headerList));
  if (!limit.allowed) {
    return { ok: false, message: rateLimitMessage(limit) };
  }

  const email = normalizeEmail(parsed.data.email);
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (existing) {
    return {
      ok: false,
      message: 'An account already exists for that email address.',
      fieldErrors: {
        email: ['An account already exists for that email address. Try signing in instead.'],
      },
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const superAdminEmail = normalizeEmail(getEnv().SUPER_ADMIN_EMAIL);

  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash,
      // The configured super-admin address is promoted on first registration.
      role: email === superAdminEmail ? Role.SUPER_ADMIN : Role.USER,
      status: AccountStatus.ACTIVE,
      profile: {
        create: {
          fullName: parsed.data.name,
          pendingPlanSelection:
            parsed.data.plan && isProductKey(parsed.data.plan) ? parsed.data.plan : null,
        },
      },
    },
    select: { id: true, email: true, name: true },
  });

  await Promise.all([
    trackEvent({
      name: 'signup_completed',
      userId: user.id,
      properties: { plan: parsed.data.plan },
    }),
    sendWelcomeEmail(user.email, user.name),
  ]);

  // Sign the new user in immediately, then continue to onboarding.
  try {
    await signIn('credentials', {
      email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: true,
        message: 'Your account was created. Please sign in to continue.',
      };
    }
    throw error;
  }

  redirect('/onboarding');
}

/* -------------------------------------------------------------------------- */
/* Sign in                                                                     */
/* -------------------------------------------------------------------------- */

export async function signInAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');
  const callbackUrl = safeCallbackUrl(formData.get('callbackUrl'));

  if (!email || !password) {
    return { ok: false, message: 'Enter your email address and password.' };
  }

  const headerList = await headers();
  const limit = await consumeRateLimit(RATE_LIMITS.signIn, `ip:${clientIp(headerList)}`);
  if (!limit.allowed) {
    return { ok: false, message: rateLimitMessage(limit) };
  }

  try {
    await signIn('credentials', { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      const cause = (error.cause as { err?: Error } | undefined)?.err?.message ?? '';
      if (cause === 'ACCOUNT_SUSPENDED') {
        return {
          ok: false,
          message:
            'This account has been suspended. Contact support if you believe this is a mistake.',
        };
      }
      if (cause === 'RATE_LIMITED') {
        return {
          ok: false,
          message: 'Too many sign-in attempts for this account. Please try again shortly.',
        };
      }
      // Identical message for every credential failure — no user enumeration.
      return { ok: false, message: 'Invalid email or password.' };
    }
    throw error;
  }

  redirect(callbackUrl);
}

/* -------------------------------------------------------------------------- */
/* Password reset                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Always reports success, whether or not the address is registered. This is the
 * only safe behavior — anything else turns the form into an account oracle.
 */
export async function requestPasswordResetAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formValue(formData, 'email') });

  const genericSuccess: ActionResult = {
    ok: true,
    message:
      'If an account exists for that email address, we have sent a link to reset the password. Check your inbox and spam folder.',
  };

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Enter a valid email address.',
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const headerList = await headers();
  const limit = await consumeRateLimit(RATE_LIMITS.passwordResetRequest, clientIp(headerList));
  if (!limit.allowed) {
    return { ok: false, message: rateLimitMessage(limit) };
  }

  const email = normalizeEmail(parsed.data.email);
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, email: true, status: true },
  });

  if (!user || user.status === AccountStatus.SUSPENDED) {
    return genericSuccess;
  }

  // Invalidate any outstanding tokens so only the newest link works.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = generateToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
      requestIp: null,
    },
  });

  const appUrl = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  await sendPasswordResetEmail(user.email, `${appUrl}/reset-password?token=${token}`);

  return genericSuccess;
}

export async function resetPasswordAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    token: formValue(formData, 'token'),
    password: formValue(formData, 'password'),
    confirmPassword: formValue(formData, 'confirmPassword'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please correct the highlighted fields.',
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const headerList = await headers();
  const limit = await consumeRateLimit(RATE_LIMITS.passwordResetConfirm, clientIp(headerList));
  if (!limit.allowed) {
    return { ok: false, message: rateLimitMessage(limit) };
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
    include: { user: { select: { id: true, status: true, deletedAt: true } } },
  });

  if (
    !record ||
    record.usedAt ||
    record.expiresAt < new Date() ||
    record.user.deletedAt ||
    record.user.status === AccountStatus.SUSPENDED
  ) {
    return {
      ok: false,
      message:
        'That reset link is no longer valid. Request a new one — links expire after 60 minutes and can only be used once.',
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate any other outstanding tokens for this account.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  return {
    ok: true,
    message: 'Your password has been updated. You can now sign in with your new password.',
  };
}
