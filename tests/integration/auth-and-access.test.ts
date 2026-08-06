import { AccountStatus, ContactStatus, Role } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { hashPassword, normalizeEmail, verifyPassword } from '@/lib/auth/password';
import { canUseAdminArea, canUsePlatform } from '@/lib/auth/roles';
import { generateToken, hashIdentifier, hashToken, safeCompare } from '@/lib/crypto';
import {
  RATE_LIMITS,
  consumeRateLimit,
  clearRateLimit,
  pruneRateLimitEvents,
} from '@/lib/rate-limit';
import { clearCapturedEmails, lastEmailTo, sendPasswordResetEmail } from '@/lib/email';
import {
  cleanupTestData,
  createTestUser,
  disconnect,
  prisma,
  testEmail,
  useTestScope,
} from '../helpers/db';

useTestScope('auth');

describe('registration and account records', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnect();
  });

  it('stores a bcrypt hash rather than the plaintext password', async () => {
    const user = await createTestUser({ password: 'Registration-Test-99' });

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordHash).not.toContain('Registration-Test-99');
    expect(stored.passwordHash?.startsWith('$2')).toBe(true);
    expect(await verifyPassword('Registration-Test-99', stored.passwordHash)).toBe(true);
  });

  it('enforces a unique email address', async () => {
    const email = testEmail('duplicate');
    await createTestUser({ email });

    await expect(createTestUser({ email })).rejects.toThrow();
  });

  it('treats email addresses case-insensitively through normalization', async () => {
    const email = testEmail('case');
    await createTestUser({ email });

    const found = await prisma.user.findUnique({
      where: { email: normalizeEmail(email.toUpperCase()) },
    });
    expect(found).not.toBeNull();
  });

  it('creates a profile alongside the account', async () => {
    const user = await createTestUser();
    const profile = await prisma.userProfile.findUnique({ where: { userId: user.id } });
    expect(profile).not.toBeNull();
  });

  it('records created and last-login timestamps', async () => {
    const user = await createTestUser();
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.lastLoginAt).toBeNull();

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.lastLoginAt).toBeInstanceOf(Date);
  });
});

describe('role and status authorization', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('gives an ordinary user no admin access', async () => {
    const user = await createTestUser({ role: Role.USER });
    expect(canUseAdminArea(user)).toBe(false);
    expect(canUsePlatform(user)).toBe(true);
  });

  it('gives a super admin admin access', async () => {
    const admin = await createTestUser({ role: Role.SUPER_ADMIN });
    expect(canUseAdminArea(admin)).toBe(true);
  });

  it('removes all access from a suspended account, including a super admin', async () => {
    const admin = await createTestUser({ role: Role.SUPER_ADMIN });
    const suspended = await prisma.user.update({
      where: { id: admin.id },
      data: {
        status: AccountStatus.SUSPENDED,
        suspendedAt: new Date(),
        suspendedReason: 'Test suspension',
      },
    });

    expect(canUsePlatform(suspended)).toBe(false);
    expect(canUseAdminArea(suspended)).toBe(false);
  });

  it('restores access when an account is reactivated', async () => {
    const user = await createTestUser({ status: AccountStatus.SUSPENDED });
    const reactivated = await prisma.user.update({
      where: { id: user.id },
      data: { status: AccountStatus.ACTIVE, suspendedAt: null, suspendedReason: null },
    });
    expect(canUsePlatform(reactivated)).toBe(true);
  });

  it('removes access from a soft-deleted account', async () => {
    const user = await createTestUser();
    const deleted = await prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });
    expect(canUsePlatform(deleted)).toBe(false);
  });
});

describe('password reset tokens', () => {
  beforeEach(async () => {
    await cleanupTestData();
    clearCapturedEmails();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('stores only a hash of the reset token', async () => {
    const user = await createTestUser();
    const token = generateToken();

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    const stored = await prisma.passwordResetToken.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.tokenHash).toHaveLength(64);

    // Only the exact token reproduces the stored hash.
    expect(hashToken(token)).toBe(stored.tokenHash);
    expect(hashToken(`${token}x`)).not.toBe(stored.tokenHash);
  });

  it('marks an expired token as unusable', async () => {
    const user = await createTestUser();
    const token = generateToken();

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const stored = await prisma.passwordResetToken.findFirstOrThrow({
      where: { tokenHash: hashToken(token) },
    });
    expect(stored.expiresAt.getTime()).toBeLessThan(Date.now());
  });

  it('marks a token consumed so it cannot be reused', async () => {
    const user = await createTestUser();
    const token = generateToken();

    const created = await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    await prisma.passwordResetToken.update({
      where: { id: created.id },
      data: { usedAt: new Date() },
    });

    const stored = await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.usedAt).not.toBeNull();
  });

  it('captures the reset email in the console adapter with a usable link', async () => {
    const email = testEmail('reset');
    const url = 'http://localhost:3000/reset-password?token=abc123';

    const result = await sendPasswordResetEmail(email, url);
    expect(result.ok).toBe(true);
    expect(result.provider).toBe('console');

    const captured = lastEmailTo(email);
    expect(captured).toBeDefined();
    expect(captured?.subject).toContain('Reset your RankInAI password');
    expect(captured?.text).toContain(url);
    // The email must state the expiry so the user is not surprised.
    expect(captured?.text).toContain('60 minutes');
  });

  it('generates unpredictable tokens', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateToken()));
    expect(tokens.size).toBe(200);
    for (const token of tokens) {
      expect(token.length).toBeGreaterThanOrEqual(40);
    }
  });
});

describe('rate limiting', () => {
  const rule = { bucket: 'itest:auth:signin', limit: 3, windowSeconds: 60 };

  beforeEach(async () => {
    await prisma.rateLimitEvent.deleteMany({ where: { bucket: { startsWith: 'itest:' } } });
  });

  afterAll(async () => {
    await prisma.rateLimitEvent.deleteMany({ where: { bucket: { startsWith: 'itest:' } } });
  });

  it('allows attempts up to the limit and then blocks', async () => {
    const identifier = 'user@example.invalid';

    for (let i = 0; i < rule.limit; i += 1) {
      const result = await consumeRateLimit(rule, identifier);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(rule.limit - i - 1);
    }

    const blocked = await consumeRateLimit(rule, identifier);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('tracks identifiers independently', async () => {
    for (let i = 0; i < rule.limit; i += 1) {
      await consumeRateLimit(rule, 'first@example.invalid');
    }

    expect((await consumeRateLimit(rule, 'first@example.invalid')).allowed).toBe(false);
    expect((await consumeRateLimit(rule, 'second@example.invalid')).allowed).toBe(true);
  });

  it('never stores the raw identifier', async () => {
    await consumeRateLimit(rule, 'sensitive@example.invalid');

    const events = await prisma.rateLimitEvent.findMany({ where: { bucket: rule.bucket } });
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.identifierHash).not.toContain('sensitive');
      expect(event.identifierHash).not.toContain('@');
      expect(event.identifierHash).toHaveLength(64);
    }
  });

  it('clears a bucket after a successful sign-in', async () => {
    const identifier = 'clearme@example.invalid';
    for (let i = 0; i < rule.limit; i += 1) await consumeRateLimit(rule, identifier);
    expect((await consumeRateLimit(rule, identifier)).allowed).toBe(false);

    await clearRateLimit(rule, identifier);
    expect((await consumeRateLimit(rule, identifier)).allowed).toBe(true);
  });

  it('prunes old events', async () => {
    await prisma.rateLimitEvent.create({
      data: {
        bucket: 'itest:prune',
        identifierHash: hashIdentifier('old'),
        createdAt: new Date(Date.now() - 48 * 3600 * 1000),
      },
    });

    const pruned = await pruneRateLimitEvents(24);
    expect(pruned).toBeGreaterThanOrEqual(1);
  });

  it('configures sensible production limits', () => {
    expect(RATE_LIMITS.signIn.limit).toBeLessThanOrEqual(10);
    expect(RATE_LIMITS.signUp.limit).toBeLessThanOrEqual(10);
    expect(RATE_LIMITS.passwordResetRequest.limit).toBeLessThanOrEqual(10);
    expect(RATE_LIMITS.freePreview.limit).toBeLessThanOrEqual(10);
    expect(RATE_LIMITS.contactForm.limit).toBeLessThanOrEqual(10);
  });
});

describe('crypto helpers', () => {
  it('produces a stable, peppered, non-reversible identifier hash', () => {
    const a = hashIdentifier('192.0.2.44');
    const b = hashIdentifier('192.0.2.44');
    const c = hashIdentifier('192.0.2.45');

    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toContain('192.0.2');
    expect(a).toHaveLength(64);
  });

  it('normalizes case and whitespace before hashing', () => {
    expect(hashIdentifier('  User@Example.COM ')).toBe(hashIdentifier('user@example.com'));
  });

  it('compares secrets safely', () => {
    expect(safeCompare('abc123', 'abc123')).toBe(true);
    expect(safeCompare('abc123', 'abc124')).toBe(false);
    expect(safeCompare('abc123', 'longer-value')).toBe(false);
    expect(safeCompare('', '')).toBe(true);
  });
});

describe('contact submissions', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('stores a submission with a hashed IP and no raw address', async () => {
    const email = testEmail('contact');

    const submission = await prisma.contactSubmission.create({
      data: {
        name: 'Test Contact',
        email,
        company: 'Test Co',
        subject: 'Sales question',
        message: 'I would like to know more about the Agency plan and volume pricing.',
        ipHash: hashIdentifier('203.0.113.9'),
        userAgent: 'vitest',
        isDemo: false,
      },
    });

    expect(submission.status).toBe(ContactStatus.NEW);
    expect(submission.ipHash).not.toContain('203.0.113');
    expect(submission.ipHash).toHaveLength(64);
    expect(submission.isDemo).toBe(false);
  });

  it('supports the admin status workflow', async () => {
    const admin = await createTestUser({ role: Role.SUPER_ADMIN });
    const submission = await prisma.contactSubmission.create({
      data: {
        name: 'Test Contact',
        email: testEmail('workflow'),
        subject: 'Technical support',
        message: 'The audit for my website returned an unexpected result on one check.',
      },
    });

    const updated = await prisma.contactSubmission.update({
      where: { id: submission.id },
      data: { status: ContactStatus.RESPONDED, handledById: admin.id, handledAt: new Date() },
    });

    expect(updated.status).toBe(ContactStatus.RESPONDED);
    expect(updated.handledById).toBe(admin.id);
  });
});

describe('password hashing cost', () => {
  it('uses a work factor that makes offline guessing expensive', async () => {
    const hash = await hashPassword('Cost-Factor-Test-1');
    // bcrypt hashes encode the cost as $2<x>$<cost>$
    const cost = Number(hash.split('$')[2]);
    expect(cost).toBeGreaterThanOrEqual(12);
  });
});
