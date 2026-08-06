import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { getEnv } from '@/lib/env';

/**
 * Hashing helpers for values that must be stored but never recovered:
 * password-reset tokens, IP addresses and rate-limit identifiers.
 *
 * The application secret is mixed in so that a database leak alone does not
 * allow an attacker to confirm whether a given email or IP appears in the logs.
 */

function pepper(): string {
  return getEnv().authSecret;
}

/** One-way hash of an opaque token. Stored instead of the token itself. */
export function hashToken(token: string): string {
  return createHash('sha256').update(`${pepper()}:${token}`).digest('hex');
}

/** One-way, peppered hash used for IPs and rate-limit identifiers. */
export function hashIdentifier(value: string): string {
  return createHash('sha256').update(`${pepper()}:id:${value.trim().toLowerCase()}`).digest('hex');
}

/** URL-safe random token for password reset / email verification links. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Constant-time string comparison for secrets supplied over HTTP. */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so the timing profile is flat.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** Stable non-reversible key derived from an incoming request's client IP. */
export function clientIpHash(headers: Headers): string {
  return hashIdentifier(clientIp(headers));
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip') ?? headers.get('cf-connecting-ip') ?? 'unknown';
}
