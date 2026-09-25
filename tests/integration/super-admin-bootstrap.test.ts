import { createRequire } from 'node:module';

import { AccountStatus, Role } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  cleanupTestData,
  createTestUser,
  disconnect,
  prisma,
  testEmail,
  useTestScope,
} from '../helpers/db';

useTestScope('adminboot');

const require = createRequire(import.meta.url);
const { ensureSuperAdmin } = require('../../scripts/ensure-super-admin.js') as {
  ensureSuperAdmin: (input: {
    prisma: unknown;
    email?: string;
    log?: (level: string, fields: Record<string, unknown>) => void;
  }) => Promise<{ action: string; reason?: string; from?: { role: string; status: string } }>;
};

/**
 * The boot-time reconciliation of `SUPER_ADMIN_EMAIL`, against a real database.
 *
 * The unit test covers the decision with a fake client. This one is here for
 * the part a fake cannot prove: that the writes are valid against the actual
 * schema — the right column names, real enum values, a foreign key on the audit
 * row that resolves — because a silent failure here means the owner of a live
 * deployment is locked out of their own admin area.
 */

beforeAll(async () => {
  await cleanupTestData();
});

afterAll(async () => {
  await cleanupTestData();
  await disconnect();
});

describe('boot-time super-admin reconciliation', () => {
  it('promotes the configured address and records it in the audit trail', async () => {
    const user = await createTestUser({ role: Role.USER });

    const result = await ensureSuperAdmin({ prisma, email: user.email.toUpperCase() });
    expect(result.action).toBe('reconciled');
    expect(result.from).toEqual({ role: 'USER', status: 'ACTIVE' });

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { role: true, status: true },
    });
    expect(after.role).toBe(Role.SUPER_ADMIN);
    expect(after.status).toBe(AccountStatus.ACTIVE);

    const trail = await prisma.adminActivity.findMany({
      where: { targetId: user.id, action: 'user.role_change' },
    });
    expect(trail).toHaveLength(1);
    expect(trail[0]?.summary).toContain(user.email.toLowerCase());

    // Running again on an already-correct row writes nothing, so a restarting
    // service does not fill the audit trail with duplicates.
    expect((await ensureSuperAdmin({ prisma, email: user.email })).action).toBe('unchanged');
    expect(await prisma.adminActivity.count({ where: { targetId: user.id } })).toBe(1);
  });

  it('lifts a suspension, because a suspended admin is still locked out', async () => {
    const user = await createTestUser({ role: Role.SUPER_ADMIN, status: AccountStatus.SUSPENDED });
    await prisma.user.update({
      where: { id: user.id },
      data: { suspendedAt: new Date(), suspendedReason: 'integration test' },
    });

    expect((await ensureSuperAdmin({ prisma, email: user.email })).action).toBe('reconciled');

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { status: true, suspendedAt: true, suspendedReason: true },
    });
    expect(after).toEqual({
      status: AccountStatus.ACTIVE,
      suspendedAt: null,
      suspendedReason: null,
    });
  });

  it('leaves a soft-deleted account deleted and unprivileged', async () => {
    const user = await createTestUser({ role: Role.USER });
    await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });

    expect((await ensureSuperAdmin({ prisma, email: user.email })).action).toBe('skipped');

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { role: true, deletedAt: true },
    });
    expect(after.role).toBe(Role.USER);
    expect(after.deletedAt).not.toBeNull();
  });

  it('creates nothing for an address that has no account', async () => {
    const email = testEmail('never-registered');

    expect((await ensureSuperAdmin({ prisma, email })).action).toBe('absent');
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it('promotes nobody when the variable is unset', async () => {
    const user = await createTestUser({ role: Role.USER });

    expect((await ensureSuperAdmin({ prisma })).action).toBe('skipped');
    expect((await ensureSuperAdmin({ prisma, email: '   ' })).action).toBe('skipped');

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { role: true },
    });
    expect(after.role).toBe(Role.USER);
  });
});
