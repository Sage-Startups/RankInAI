import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

type UserRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  deletedAt: Date | null;
  suspendedAt?: Date | null;
  suspendedReason?: string | null;
};

type Result =
  | { action: 'skipped'; reason: string }
  | { action: 'absent'; email: string }
  | { action: 'unchanged'; email: string }
  | { action: 'reconciled'; email: string; from: { role: string; status: string } };

const { ensureSuperAdmin } = require('../../scripts/ensure-super-admin.js') as {
  ensureSuperAdmin: (input: {
    prisma: unknown;
    email?: string;
    log?: (level: string, fields: Record<string, unknown>) => void;
  }) => Promise<Result>;
};

/**
 * A stand-in for the Prisma client that records what was written. The real
 * thing is exercised by the integration and E2E suites; what matters here is
 * the decision — which accounts are touched, and with what.
 */
function fakePrisma(rows: UserRow[], options: { activityThrows?: boolean } = {}) {
  const updates: { id: string; data: Record<string, unknown> }[] = [];
  const activity: Record<string, unknown>[] = [];

  return {
    updates,
    activity,
    user: {
      findUnique: async ({ where }: { where: { email: string } }) =>
        rows.find((r) => r.email === where.email) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push({ id: where.id, data });
        const row = rows.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      },
    },
    adminActivity: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (options.activityThrows) throw new Error('audit table unavailable');
        activity.push(data);
        return data;
      },
    },
  };
}

const owner = (overrides: Partial<UserRow> = {}): UserRow => ({
  id: 'user_1',
  email: 'owner@rankclear.ai',
  role: 'USER',
  status: 'ACTIVE',
  deletedAt: null,
  ...overrides,
});

describe('ensureSuperAdmin', () => {
  it('does nothing at all when SUPER_ADMIN_EMAIL is not set', async () => {
    const prisma = fakePrisma([owner()]);
    const result = await ensureSuperAdmin({ prisma });

    expect(result.action).toBe('skipped');
    expect(prisma.updates).toEqual([]);
  });

  it('refuses a value that is not an email address', async () => {
    const prisma = fakePrisma([owner()]);
    const result = await ensureSuperAdmin({ prisma, email: 'not-an-email' });

    expect(result.action).toBe('skipped');
    expect(prisma.updates).toEqual([]);
  });

  it('promotes the configured address when its account is an ordinary user', async () => {
    const prisma = fakePrisma([owner()]);
    const result = await ensureSuperAdmin({ prisma, email: 'owner@rankclear.ai' });

    expect(result).toMatchObject({
      action: 'reconciled',
      email: 'owner@rankclear.ai',
      from: { role: 'USER', status: 'ACTIVE' },
    });
    expect(prisma.updates).toEqual([
      {
        id: 'user_1',
        data: { role: 'SUPER_ADMIN', status: 'ACTIVE', suspendedAt: null, suspendedReason: null },
      },
    ]);
  });

  it('matches the address case-insensitively and ignores surrounding space', async () => {
    const prisma = fakePrisma([owner()]);
    const result = await ensureSuperAdmin({ prisma, email: '  Owner@RankClear.AI ' });

    expect(result.action).toBe('reconciled');
    expect(prisma.updates).toHaveLength(1);
  });

  it('clears a suspension, because a suspended admin is still locked out', async () => {
    const prisma = fakePrisma([
      owner({
        role: 'SUPER_ADMIN',
        status: 'SUSPENDED',
        suspendedAt: new Date(),
        suspendedReason: 'billing',
      }),
    ]);

    const result = await ensureSuperAdmin({ prisma, email: 'owner@rankclear.ai' });

    expect(result).toMatchObject({ action: 'reconciled', from: { status: 'SUSPENDED' } });
    expect(prisma.updates[0]?.data).toMatchObject({ suspendedAt: null, suspendedReason: null });
  });

  it('writes the grant to the admin audit trail', async () => {
    const prisma = fakePrisma([owner()]);
    await ensureSuperAdmin({ prisma, email: 'owner@rankclear.ai' });

    expect(prisma.activity).toHaveLength(1);
    expect(prisma.activity[0]).toMatchObject({
      adminUserId: 'user_1',
      action: 'user.role_change',
      targetType: 'User',
      targetId: 'user_1',
    });
    expect(String(prisma.activity[0]?.summary)).toContain('owner@rankclear.ai');
  });

  it('still grants the role when the audit-trail write fails', async () => {
    const prisma = fakePrisma([owner()], { activityThrows: true });
    const result = await ensureSuperAdmin({ prisma, email: 'owner@rankclear.ai' });

    expect(result.action).toBe('reconciled');
    expect(prisma.updates).toHaveLength(1);
  });

  it('writes nothing when the address is already an active super admin', async () => {
    const prisma = fakePrisma([owner({ role: 'SUPER_ADMIN' })]);
    const result = await ensureSuperAdmin({ prisma, email: 'owner@rankclear.ai' });

    expect(result).toMatchObject({ action: 'unchanged' });
    expect(prisma.updates).toEqual([]);
    expect(prisma.activity).toEqual([]);
  });

  it('reports an address that has no account rather than creating one', async () => {
    const prisma = fakePrisma([]);
    const result = await ensureSuperAdmin({ prisma, email: 'nobody@rankclear.ai' });

    expect(result).toMatchObject({ action: 'absent' });
    expect(prisma.updates).toEqual([]);
  });

  it('leaves a soft-deleted account deleted', async () => {
    const prisma = fakePrisma([owner({ deletedAt: new Date() })]);
    const result = await ensureSuperAdmin({ prisma, email: 'owner@rankclear.ai' });

    expect(result.action).toBe('skipped');
    expect(prisma.updates).toEqual([]);
  });

  it('touches only the configured address, never another account', async () => {
    const prisma = fakePrisma([
      owner(),
      owner({ id: 'user_2', email: 'someone.else@example.com' }),
    ]);

    await ensureSuperAdmin({ prisma, email: 'owner@rankclear.ai' });

    expect(prisma.updates.map((u) => u.id)).toEqual(['user_1']);
  });
});
