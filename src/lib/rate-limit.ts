import { prisma } from '@/lib/db';
import { hashIdentifier } from '@/lib/crypto';

/**
 * Database-backed sliding-window rate limiter.
 *
 * Using Postgres rather than in-process memory means the limit holds across the
 * web and worker services and survives a container restart — important on
 * Railway where instances are replaced freely.
 *
 * Identifiers are hashed before storage so the table never contains raw email
 * addresses or IP addresses.
 */

export interface RateLimitRule {
  bucket: string;
  /** Maximum attempts allowed inside the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export const RATE_LIMITS = {
  signIn: { bucket: 'auth:signin', limit: 8, windowSeconds: 15 * 60 },
  signUp: { bucket: 'auth:signup', limit: 10, windowSeconds: 60 * 60 },
  passwordResetRequest: { bucket: 'auth:reset-request', limit: 5, windowSeconds: 60 * 60 },
  passwordResetConfirm: { bucket: 'auth:reset-confirm', limit: 10, windowSeconds: 60 * 60 },
  contactForm: { bucket: 'contact:submit', limit: 5, windowSeconds: 60 * 60 },
  freePreview: { bucket: 'preview:run', limit: 6, windowSeconds: 60 * 60 },
  auditCreate: { bucket: 'audit:create', limit: 30, windowSeconds: 60 * 60 },
  reportDownload: { bucket: 'report:download', limit: 60, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Seconds until the window frees up. Only meaningful when blocked. */
  retryAfterSeconds: number;
}

/**
 * Record an attempt and report whether it is within the limit.
 * Call this *before* performing the protected action.
 */
export async function consumeRateLimit(
  rule: RateLimitRule,
  identifier: string,
): Promise<RateLimitResult> {
  const identifierHash = hashIdentifier(`${rule.bucket}:${identifier}`);
  const windowStart = new Date(Date.now() - rule.windowSeconds * 1000);

  const [count, oldest] = await Promise.all([
    prisma.rateLimitEvent.count({
      where: { bucket: rule.bucket, identifierHash, createdAt: { gte: windowStart } },
    }),
    prisma.rateLimitEvent.findFirst({
      where: { bucket: rule.bucket, identifierHash, createdAt: { gte: windowStart } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ]);

  if (count >= rule.limit) {
    const resetAt = oldest
      ? oldest.createdAt.getTime() + rule.windowSeconds * 1000
      : Date.now() + rule.windowSeconds * 1000;
    return {
      allowed: false,
      remaining: 0,
      limit: rule.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
    };
  }

  await prisma.rateLimitEvent.create({
    data: { bucket: rule.bucket, identifierHash },
  });

  return {
    allowed: true,
    remaining: Math.max(0, rule.limit - count - 1),
    limit: rule.limit,
    retryAfterSeconds: 0,
  };
}

/** Mark the most recent attempt in a bucket as successful (for audit trails). */
export async function markRateLimitSuccess(
  rule: RateLimitRule,
  identifier: string,
): Promise<void> {
  const identifierHash = hashIdentifier(`${rule.bucket}:${identifier}`);
  const latest = await prisma.rateLimitEvent.findFirst({
    where: { bucket: rule.bucket, identifierHash },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (latest) {
    await prisma.rateLimitEvent.update({
      where: { id: latest.id },
      data: { success: true },
    });
  }
}

/**
 * Clear a bucket for an identifier — used after a successful sign-in so a user
 * who mistyped their password a few times is not left throttled.
 */
export async function clearRateLimit(rule: RateLimitRule, identifier: string): Promise<void> {
  const identifierHash = hashIdentifier(`${rule.bucket}:${identifier}`);
  await prisma.rateLimitEvent.deleteMany({ where: { bucket: rule.bucket, identifierHash } });
}

/** Housekeeping: drop rate-limit rows older than a day. */
export async function pruneRateLimitEvents(olderThanHours = 24): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanHours * 3600 * 1000);
  const result = await prisma.rateLimitEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}

export function rateLimitMessage(result: RateLimitResult): string {
  const minutes = Math.ceil(result.retryAfterSeconds / 60);
  if (minutes <= 1) return 'Too many attempts. Please try again in a minute.';
  return `Too many attempts. Please try again in about ${minutes} minutes.`;
}
