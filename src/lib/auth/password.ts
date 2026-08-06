import bcrypt from 'bcryptjs';
import { z } from 'zod';

/**
 * Password policy and hashing.
 *
 * bcrypt with cost 12 — roughly 250ms on modern hardware, which keeps online
 * guessing expensive without making sign-in feel slow.
 */
const BCRYPT_ROUNDS = 12;

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

/** Passwords seen constantly in credential-stuffing lists. */
const BANNED_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  'passw0rd',
  'qwerty123',
  'letmein123',
  '1234567890',
  'iloveyou1',
  'admin12345',
  'welcome123',
  'changeme123',
  'rankinai123',
]);

export interface PasswordCheckResult {
  valid: boolean;
  errors: string[];
  /** 0-4, suitable for a strength meter. */
  strength: number;
}

export function checkPasswordStrength(password: string): PasswordCheckResult {
  const errors: string[] = [];

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Use no more than ${MAX_PASSWORD_LENGTH} characters.`);
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Include at least one lowercase letter.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Include at least one uppercase letter.');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Include at least one number.');
  }
  if (BANNED_PASSWORDS.has(password.toLowerCase())) {
    errors.push('That password is too common. Choose something less predictable.');
  }
  if (/^(.)\1+$/.test(password)) {
    errors.push('Avoid repeating a single character.');
  }

  let strength = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) strength += 1;
  if (password.length >= 14) strength += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password)) strength += 1;
  if (/[^A-Za-z0-9]/.test(password)) strength += 1;
  if (errors.length > 0) strength = Math.min(strength, 1);

  return { valid: errors.length === 0, errors, strength };
}

/** Zod field usable in any sign-up / reset schema. */
export const passwordField = z
  .string()
  .min(1, 'Password is required')
  .superRefine((value, ctx) => {
    const result = checkPasswordStrength(value);
    if (!result.valid) {
      for (const message of result.errors) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message });
      }
    }
  });

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) {
    // Burn comparable time so a missing hash is not distinguishable by timing.
    await bcrypt.compare(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');
    return false;
  }
  return bcrypt.compare(password, hash);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
