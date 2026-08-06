import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';

/**
 * Audit trail for privileged actions.
 *
 * Every state-changing admin operation writes one row. `detail` must never
 * contain secrets, password hashes or full payment identifiers.
 */

export type AdminAction =
  | 'user.suspend'
  | 'user.reactivate'
  | 'user.role_change'
  | 'user.credits_grant'
  | 'user.credits_revoke'
  | 'audit.retry'
  | 'audit.cancel'
  | 'audit.archive'
  | 'contact.status_change'
  | 'settings.update';

export async function logAdminAction(params: {
  adminUserId: string;
  action: AdminAction;
  targetType?: string;
  targetId?: string;
  summary: string;
  detail?: Record<string, unknown>;
  ipHash?: string | null;
}): Promise<void> {
  await prisma.adminActivity.create({
    data: {
      adminUserId: params.adminUserId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      summary: params.summary.slice(0, 300),
      detail: (params.detail ?? {}) as unknown as Prisma.InputJsonValue,
      ipHash: params.ipHash ?? null,
    },
  });
}

export const ADMIN_ACTION_LABELS: Record<AdminAction, string> = {
  'user.suspend': 'Suspended account',
  'user.reactivate': 'Reactivated account',
  'user.role_change': 'Changed role',
  'user.credits_grant': 'Granted audit credits',
  'user.credits_revoke': 'Revoked audit credits',
  'audit.retry': 'Retried audit',
  'audit.cancel': 'Canceled audit',
  'audit.archive': 'Archived audit',
  'contact.status_change': 'Updated contact submission',
  'settings.update': 'Updated system settings',
};
