import { AccountStatus, Role } from '@prisma/client';

/**
 * Pure role/status predicates.
 *
 * Kept free of Auth.js and Prisma-client imports so they can be unit-tested and
 * reused anywhere, including the edge runtime.
 */

export function isAdmin(user: { role: Role } | null | undefined): boolean {
  return user?.role === Role.SUPER_ADMIN;
}

export function isActive(user: { status: AccountStatus } | null | undefined): boolean {
  return user?.status === AccountStatus.ACTIVE;
}

export function isSuspended(user: { status: AccountStatus } | null | undefined): boolean {
  return user?.status === AccountStatus.SUSPENDED;
}

/**
 * Can this user act on the platform at all?
 * A suspended super admin has the role but no access.
 */
export function canUsePlatform(
  user: { role: Role; status: AccountStatus; deletedAt?: Date | null } | null | undefined,
): boolean {
  if (!user) return false;
  if (user.deletedAt) return false;
  return user.status === AccountStatus.ACTIVE;
}

export function canUseAdminArea(
  user: { role: Role; status: AccountStatus; deletedAt?: Date | null } | null | undefined,
): boolean {
  return canUsePlatform(user) && isAdmin(user);
}
