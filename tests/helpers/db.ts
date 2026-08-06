import { AccountStatus, PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Integration-test helpers.
 *
 * Every test file claims its own namespace via `useTestScope('name')`. All
 * fixture users are created under `<scope>-…@rankinai-itest.invalid`, and
 * cleanup only removes rows in that namespace. Test files are therefore
 * independent of each other regardless of how Vitest schedules them.
 */

export const prisma = new PrismaClient();

export const TEST_EMAIL_DOMAIN = 'rankinai-itest.invalid';

let scope = 'default';
let counter = 0;

/** Call once at the top of each integration test file. */
export function useTestScope(name: string): string {
  scope = name.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'default';
  return scope;
}

export function currentScope(): string {
  return scope;
}

export function scopePrefix(): string {
  return `${scope}-`;
}

export function testEmail(label = 'user'): string {
  counter += 1;
  return `${scopePrefix()}${label}-${process.pid}-${counter}-${Date.now()}@${TEST_EMAIL_DOMAIN}`;
}

/** Namespaced Stripe-style identifier so webhook rows are cleanable per scope. */
export function testStripeId(kind: string, suffix = ''): string {
  counter += 1;
  return `${kind}_itest_${scope}_${process.pid}_${counter}${suffix ? `_${suffix}` : ''}`;
}

export const TEST_PASSWORD = 'Integration-Test-42';

export async function createTestUser(
  options: {
    email?: string;
    role?: Role;
    status?: AccountStatus;
    credits?: number;
    isDemo?: boolean;
    password?: string;
    createdAt?: Date;
  } = {},
) {
  const email = options.email ?? testEmail();
  // Cost 4 keeps the suite fast; production uses 12.
  const passwordHash = await bcrypt.hash(options.password ?? TEST_PASSWORD, 4);

  return prisma.user.create({
    data: {
      email,
      name: 'Integration Test User',
      passwordHash,
      role: options.role ?? Role.USER,
      status: options.status ?? AccountStatus.ACTIVE,
      oneTimeCredits: options.credits ?? 0,
      isDemo: options.isDemo ?? false,
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
      profile: { create: { fullName: 'Integration Test User', onboardingCompleted: true } },
    },
  });
}

/**
 * Remove only the rows this test file created.
 */
export async function cleanupTestData(): Promise<void> {
  const emailFilter = {
    startsWith: scopePrefix(),
    endsWith: `@${TEST_EMAIL_DOMAIN}`,
  } as const;

  const users = await prisma.user.findMany({
    where: { email: emailFilter },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  if (userIds.length > 0) {
    await prisma.auditCreditLedger.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.audit.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  await prisma.stripeWebhookEvent.deleteMany({
    where: { stripeEventId: { startsWith: `evt_itest_${scope}_` } },
  });
  await prisma.contactSubmission.deleteMany({ where: { email: emailFilter } });
  await prisma.rateLimitEvent.deleteMany({ where: { bucket: { startsWith: `itest:${scope}:` } } });
  await prisma.analyticsEvent.deleteMany({
    where: { sessionKey: { startsWith: `itest-${scope}-` } },
  });
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
