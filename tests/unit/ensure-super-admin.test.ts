import { createRequire } from 'node:module';

import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

type UserRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  deletedAt: Date | null;
  passwordHash?: string | null;
  suspendedAt?: Date | null;
  suspendedReason?: string | null;
};

type PasswordAction = 'none' | 'ignored' | 'unchanged' | 'set';

type Result = { password?: PasswordAction } & (
  | { action: 'skipped'; reason: string }
  | { action: 'absent'; email: string }
  | { action: 'unchanged'; email: string }
  | { action: 'reconciled'; email: string; from: { role: string; status: string } }
);

const { ensureSuperAdmin } = require('../../scripts/ensure-super-admin.js') as {
  ensureSuperAdmin: (input: {
    prisma: unknown;
    email?: string;
    password?: string;
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

  /**
   * A deployment with no email provider has no working password reset — this
   * file logs reset links outside production only — so an administrator with a
   * password nobody knows is locked out for good. The seed variable is the way
   * back in.
   */
  describe('SUPER_ADMIN_SEED_PASSWORD', () => {
    const PASSWORD = 'A-Strong-Passphrase-2026';

    it('sets a password on an account that has none', async () => {
      const prisma = fakePrisma([owner({ passwordHash: null })]);
      const result = await ensureSuperAdmin({
        prisma,
        email: 'owner@rankclear.ai',
        password: PASSWORD,
      });

      expect(result.password).toBe('set');
      const written = prisma.updates.find((u) => 'passwordHash' in u.data);
      expect(typeof written?.data.passwordHash).toBe('string');
      expect(await bcrypt.compare(PASSWORD, String(written?.data.passwordHash))).toBe(true);
    });

    it('applies it even when the role is already correct — that is the locked-out case', async () => {
      const prisma = fakePrisma([owner({ role: 'SUPER_ADMIN', passwordHash: null })]);
      const result = await ensureSuperAdmin({
        prisma,
        email: 'owner@rankclear.ai',
        password: PASSWORD,
      });

      expect(result).toMatchObject({ action: 'unchanged', password: 'set' });
      expect(prisma.updates).toHaveLength(1);
    });

    it('replaces a password that does not match the variable', async () => {
      const prisma = fakePrisma([
        owner({ passwordHash: await bcrypt.hash('something-else-entirely', 4) }),
      ]);

      expect(
        (await ensureSuperAdmin({ prisma, email: 'owner@rankclear.ai', password: PASSWORD }))
          .password,
      ).toBe('set');
    });

    it('writes nothing when the stored hash already matches, so a redeploy is silent', async () => {
      const prisma = fakePrisma([
        owner({ role: 'SUPER_ADMIN', passwordHash: await bcrypt.hash(PASSWORD, 4) }),
      ]);

      const result = await ensureSuperAdmin({
        prisma,
        email: 'owner@rankclear.ai',
        password: PASSWORD,
      });

      expect(result).toMatchObject({ action: 'unchanged', password: 'unchanged' });
      expect(prisma.updates).toEqual([]);
    });

    it('warns on every boot while the variable is set, since it overrides Settings', async () => {
      const lines: Record<string, unknown>[] = [];
      const prisma = fakePrisma([
        owner({ role: 'SUPER_ADMIN', passwordHash: await bcrypt.hash(PASSWORD, 4) }),
      ]);

      await ensureSuperAdmin({
        prisma,
        email: 'owner@rankclear.ai',
        password: PASSWORD,
        log: (_level, fields) => lines.push(fields),
      });

      expect(lines.some((l) => String(l.message).includes('remove it'))).toBe(true);
      // The password itself must never reach a log.
      expect(JSON.stringify(lines)).not.toContain(PASSWORD);
    });

    it('records the password change in the audit trail', async () => {
      const prisma = fakePrisma([owner({ role: 'SUPER_ADMIN' })]);
      await ensureSuperAdmin({ prisma, email: 'owner@rankclear.ai', password: PASSWORD });

      expect(prisma.activity.map((a) => a.action)).toEqual(['user.password_reset']);
    });

    it('ignores a password too short to be worth having, and still fixes the role', async () => {
      const prisma = fakePrisma([owner()]);
      const result = await ensureSuperAdmin({
        prisma,
        email: 'owner@rankclear.ai',
        password: 'short',
      });

      expect(result).toMatchObject({ action: 'reconciled', password: 'ignored' });
      expect(prisma.updates.some((u) => 'passwordHash' in u.data)).toBe(false);
    });

    it('leaves the password alone when the variable is unset', async () => {
      const prisma = fakePrisma([owner()]);
      const result = await ensureSuperAdmin({ prisma, email: 'owner@rankclear.ai' });

      expect(result.password).toBe('none');
      expect(prisma.updates.some((u) => 'passwordHash' in u.data)).toBe(false);
    });

    it('never sets a password on an account that does not exist', async () => {
      const prisma = fakePrisma([]);
      const result = await ensureSuperAdmin({
        prisma,
        email: 'nobody@rankclear.ai',
        password: PASSWORD,
      });

      expect(result).toMatchObject({ action: 'absent', password: 'none' });
      expect(prisma.updates).toEqual([]);
    });
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
