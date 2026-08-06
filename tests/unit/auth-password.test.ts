import { AccountStatus, Role } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  MIN_PASSWORD_LENGTH,
  checkPasswordStrength,
  hashPassword,
  normalizeEmail,
  passwordField,
  verifyPassword,
} from '@/lib/auth/password';
import { canUseAdminArea, canUsePlatform, isAdmin } from '@/lib/auth/roles';

describe('checkPasswordStrength', () => {
  it('accepts a strong password', () => {
    const result = checkPasswordStrength('Correct-Horse-42');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.strength).toBeGreaterThanOrEqual(3);
  });

  it(`rejects passwords shorter than ${MIN_PASSWORD_LENGTH} characters`, () => {
    const result = checkPasswordStrength('Ab3xyz');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain(`${MIN_PASSWORD_LENGTH} characters`);
  });

  it('requires a lowercase letter', () => {
    const result = checkPasswordStrength('ABCDEFGH123');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('lowercase');
  });

  it('requires an uppercase letter', () => {
    const result = checkPasswordStrength('abcdefgh123');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('uppercase');
  });

  it('requires a number', () => {
    const result = checkPasswordStrength('abcdefghIJK');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('number');
  });

  it('rejects well-known weak passwords', () => {
    for (const weak of ['Password123', 'welcome123', 'RankInAI123']) {
      // Case-insensitive banned list; add a capital so only the ban trips.
      const result = checkPasswordStrength(weak);
      expect(result.valid).toBe(false);
    }
  });

  it('rejects a single repeated character', () => {
    const result = checkPasswordStrength('aaaaaaaaaaaa');
    expect(result.valid).toBe(false);
  });

  it('rejects excessively long passwords', () => {
    const result = checkPasswordStrength(`Aa1${'x'.repeat(400)}`);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('no more than');
  });

  it('caps the strength meter for an invalid password', () => {
    const result = checkPasswordStrength('short');
    expect(result.strength).toBeLessThanOrEqual(1);
  });
});

describe('passwordField (Zod)', () => {
  it('accepts a valid password', () => {
    expect(passwordField.safeParse('Correct-Horse-42').success).toBe(true);
  });

  it('reports every rule violation', () => {
    const result = passwordField.safeParse('abc');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(1);
    }
  });
});

describe('password hashing', () => {
  it('produces a bcrypt hash that is not the plaintext', async () => {
    const hash = await hashPassword('Correct-Horse-42');
    expect(hash).not.toContain('Correct-Horse-42');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('Correct-Horse-42');
    expect(await verifyPassword('Correct-Horse-42', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('Correct-Horse-42');
    expect(await verifyPassword('Wrong-Horse-42', hash)).toBe(false);
  });

  it('returns false rather than throwing when no hash exists', async () => {
    expect(await verifyPassword('anything', null)).toBe(false);
  });

  it('produces a different hash each time (salted)', async () => {
    const a = await hashPassword('Correct-Horse-42');
    const b = await hashPassword('Correct-Horse-42');
    expect(a).not.toBe(b);
    expect(await verifyPassword('Correct-Horse-42', a)).toBe(true);
    expect(await verifyPassword('Correct-Horse-42', b)).toBe(true);
  });
});

describe('normalizeEmail', () => {
  it.each([
    ['  User@Example.COM  ', 'user@example.com'],
    ['ADMIN@RANKINAI.COM', 'admin@rankinai.com'],
  ])('normalizes %j', (input, expected) => {
    expect(normalizeEmail(input)).toBe(expected);
  });
});

describe('role authorization', () => {
  it('recognizes a super admin', () => {
    expect(isAdmin({ role: Role.SUPER_ADMIN })).toBe(true);
  });

  it('rejects an ordinary user', () => {
    expect(isAdmin({ role: Role.USER })).toBe(false);
  });

  it('rejects null and undefined', () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  it('denies a suspended super admin access to the platform and admin area', () => {
    const suspendedAdmin = { role: Role.SUPER_ADMIN, status: AccountStatus.SUSPENDED };
    // The role is still SUPER_ADMIN...
    expect(isAdmin(suspendedAdmin)).toBe(true);
    // ...but suspension removes all access.
    expect(canUsePlatform(suspendedAdmin)).toBe(false);
    expect(canUseAdminArea(suspendedAdmin)).toBe(false);
  });

  it('denies a soft-deleted user', () => {
    expect(
      canUsePlatform({ role: Role.USER, status: AccountStatus.ACTIVE, deletedAt: new Date() }),
    ).toBe(false);
  });

  it('allows an active super admin into the admin area', () => {
    expect(
      canUseAdminArea({ role: Role.SUPER_ADMIN, status: AccountStatus.ACTIVE, deletedAt: null }),
    ).toBe(true);
  });

  it('denies an active ordinary user from the admin area', () => {
    expect(
      canUseAdminArea({ role: Role.USER, status: AccountStatus.ACTIVE, deletedAt: null }),
    ).toBe(false);
  });
});
