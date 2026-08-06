import { redirect } from 'next/navigation';
import { AccountStatus, Role, type User } from '@prisma/client';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export { canUseAdminArea, canUsePlatform, isActive, isAdmin, isSuspended } from '@/lib/auth/roles';

/**
 * Server-side authorization helpers.
 *
 * The JWT carries a role claim for fast middleware checks, but every guard here
 * re-reads the user row so that a suspension, role change or deletion takes
 * effect immediately rather than at the next token refresh.
 */

export type SessionUser = Pick<
  User,
  'id' | 'email' | 'name' | 'role' | 'status' | 'image' | 'oneTimeCredits' | 'stripeCustomerId' | 'emailVerified' | 'createdAt'
>;

const SESSION_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  image: true,
  oneTimeCredits: true,
  stripeCustomerId: true,
  emailVerified: true,
  createdAt: true,
} as const;

/** Returns the authenticated user, or null. Never throws. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: SESSION_USER_SELECT,
  });

  if (!user) return null;
  return user;
}

/** Redirects unauthenticated visitors to sign-in, preserving the target path. */
export async function requireUser(callbackPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = callbackPath ? `?callbackUrl=${encodeURIComponent(callbackPath)}` : '';
    redirect(`/signin${target}`);
  }
  if (user.status === AccountStatus.SUSPENDED) {
    redirect('/auth-error?error=AccountSuspended');
  }
  return user;
}

/** Redirects anyone who is not a super admin. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser('/admin');
  if (user.role !== Role.SUPER_ADMIN) {
    // Deliberately a 404-style redirect rather than a 403 page so the admin
    // area's existence is not confirmed to ordinary users.
    redirect('/dashboard?denied=admin');
  }
  return user;
}

/**
 * API-route variant. Returns a discriminated result instead of redirecting so
 * route handlers can emit proper JSON status codes.
 */
export type ApiAuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; status: 401 | 403; message: string };

export async function requireApiUser(): Promise<ApiAuthResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, status: 401, message: 'Authentication required.' };
  }
  if (user.status === AccountStatus.SUSPENDED) {
    return { ok: false, status: 403, message: 'This account has been suspended.' };
  }
  return { ok: true, user };
}

export async function requireApiAdmin(): Promise<ApiAuthResult> {
  const result = await requireApiUser();
  if (!result.ok) return result;
  if (result.user.role !== Role.SUPER_ADMIN) {
    return { ok: false, status: 403, message: 'Administrator access is required.' };
  }
  return result;
}
