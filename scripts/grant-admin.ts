import 'dotenv/config';

import { randomBytes } from 'node:crypto';

import { AccountStatus, PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Grant SUPER_ADMIN to an email address.
 *
 *   npm run admin:grant -- someone@example.com
 *   npm run admin:grant -- someone@example.com --password 'A-Strong-Passphrase'
 *
 * Promotes the account if it already exists, creates it if it does not. When it
 * creates one and no password was supplied, it generates a strong random
 * password and prints it ONCE — it is never stored in plaintext, never logged
 * anywhere else, and cannot be recovered afterwards. Rotate it after the first
 * sign-in.
 *
 * This runs on the server, against DATABASE_URL, and is the intended way to
 * bootstrap or add an administrator on a live deployment without reseeding.
 * Access is a state change worth a record, so it writes to the admin audit
 * trail like every other privileged action.
 */

const prisma = new PrismaClient();

function fail(message: string): never {
  console.error(`[grant-admin] ${message}`);
  process.exit(1);
}

/** A password strong enough that it need never be reused or guessed. */
function generatePassword(): string {
  return randomBytes(24).toString('base64url');
}

function parseArgs(argv: string[]): { email: string; password?: string } {
  const args = argv.slice(2);
  const email = args.find((a) => !a.startsWith('--'));
  if (!email) {
    fail('Usage: npm run admin:grant -- <email> [--password <password>]');
  }

  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    fail(`"${email}" does not look like an email address.`);
  }

  const flag = args.indexOf('--password');
  const password = flag === -1 ? undefined : args[flag + 1];
  if (flag !== -1 && (!password || password.length < 12)) {
    fail('--password needs at least 12 characters.');
  }

  return { email: normalized, password };
}

async function main() {
  const { email, password } = parseArgs(process.argv);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, status: true, name: true },
  });

  let generated: string | null = null;
  let userId: string;

  if (existing) {
    // An explicit --password is a request in its own right, so it is applied
    // even when the role needs no change — otherwise the one command that can
    // recover a locked-out administrator would silently do nothing.
    if (existing.role === Role.SUPER_ADMIN && existing.status === AccountStatus.ACTIVE) {
      if (!password) {
        console.log(`[grant-admin] ${email} is already an active super admin. Nothing to do.`);
        return;
      }

      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash: await bcrypt.hash(password, 12) },
      });
      console.log(
        `[grant-admin] ${email} was already an active super admin; password reset to the one supplied.`,
      );
      return;
    }

    // A suspended account with an admin role is still locked out, so clear the
    // suspension as well rather than granting a role that cannot be used.
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: Role.SUPER_ADMIN,
        status: AccountStatus.ACTIVE,
        suspendedAt: null,
        suspendedReason: null,
        ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
      },
    });
    userId = existing.id;
    console.log(`[grant-admin] Promoted existing account ${email} to SUPER_ADMIN.`);
    if (password) console.log('[grant-admin] Password reset to the one supplied.');
  } else {
    const plain = password ?? generatePassword();
    generated = password ? null : plain;

    const created = await prisma.user.create({
      data: {
        email,
        name: 'RankClear Administrator',
        role: Role.SUPER_ADMIN,
        status: AccountStatus.ACTIVE,
        // Verified on creation: this account is being provisioned by whoever
        // controls the server, so an email round-trip proves nothing extra.
        emailVerified: new Date(),
        passwordHash: await bcrypt.hash(plain, 12),
        isDemo: false,
        profile: {
          create: {
            fullName: 'RankClear Administrator',
            companyName: 'RankClear',
            onboardingCompleted: true,
          },
        },
      },
      select: { id: true },
    });
    userId = created.id;
    console.log(`[grant-admin] Created ${email} as SUPER_ADMIN.`);
  }

  // There is no acting administrator when this runs from a console, so the
  // record names the grantee as the subject and says where it came from.
  await prisma.adminActivity.create({
    data: {
      adminUserId: userId,
      action: 'user.role_change',
      targetType: 'User',
      targetId: userId,
      summary: `Granted SUPER_ADMIN to ${email} via scripts/grant-admin on the server`,
    },
  });

  if (generated) {
    console.log('');
    console.log('  Generated password (shown once, not recoverable):');
    console.log(`    ${generated}`);
    console.log('');
    console.log('  Sign in, then change it under Settings. Do not paste it into email or chat.');
  }
}

main()
  .catch((error) => {
    console.error('[grant-admin] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
