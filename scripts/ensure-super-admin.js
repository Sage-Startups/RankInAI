#!/usr/bin/env node
/**
 * Reconcile the configured owner address with the SUPER_ADMIN role.
 *
 * `SUPER_ADMIN_EMAIL` is applied in two places already, and both of them are
 * one-shot:
 *
 *   - `prisma/seed.ts` upserts the address as a super admin — but only when
 *     someone runs the seed.
 *   - registration promotes the address when it signs up — but only at the
 *     moment the account is created.
 *
 * Neither helps the common case on a live deployment: the owner signed up
 * before the variable was set, so their row says `USER` and the admin area
 * answers with "access denied" forever. Changing the variable then has no
 * effect, which reads as a bug however carefully it is documented, and the
 * remedy — a shell on the production service — is the one thing a hosted
 * platform makes awkward.
 *
 * So the web entrypoint reconciles it on every boot. The authority is the same
 * as for `DATABASE_URL` and `AUTH_SECRET`: whoever sets the environment owns
 * the deployment. Nothing here reads from a request, and only the one exact
 * configured address is ever touched.
 *
 * It is deliberately narrow:
 *   - the variable must be set explicitly — there is no default, so an
 *     operator who has never set it sees no writes at all;
 *   - it promotes an existing account, and never creates one. A passwordless
 *     account nobody asked for is worse than an honest "sign up first", and
 *     registration already promotes this address;
 *   - a soft-deleted account is left alone;
 *   - it writes to the admin audit trail, because a role change is a state
 *     change worth a record no matter who made it.
 *
 * `SUPER_ADMIN_SEED_PASSWORD` is honored for the same account and for the same
 * reason — see `applySeedPassword` below. A role nobody can sign in to is not
 * access.
 */

const SUPER_ADMIN = 'SUPER_ADMIN';
const ACTIVE = 'ACTIVE';

function normalizeEmail(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const MIN_PASSWORD_LENGTH = 12;

/**
 * Apply `SUPER_ADMIN_SEED_PASSWORD` to the owner account.
 *
 * Without this, an administrator with no usable password has exactly one way
 * in — the forgot-password email — and this deployment logs reset links only
 * outside production, deliberately: a reset token in a platform's log is a
 * credential sitting in a place many people can read. So on a deployment with
 * no email provider configured the owner is simply locked out, with the
 * password they need sitting in a variable the seed would have honored.
 *
 * It rehashes only when the stored hash does not already match, so a redeploy
 * is silent, and it warns on every boot while the variable is set, because it
 * will keep overriding a password changed later in Settings. The password
 * itself is never logged.
 *
 * @returns 'none' | 'ignored' | 'unchanged' | 'set'
 */
async function applySeedPassword({ prisma, user, address, password, log }) {
  if (!password) return 'none';

  if (password.length < MIN_PASSWORD_LENGTH) {
    log('warn', {
      message: 'SUPER_ADMIN_SEED_PASSWORD ignored — too short',
      needs: `at least ${MIN_PASSWORD_LENGTH} characters`,
    });
    return 'ignored';
  }

  let bcrypt;
  try {
    bcrypt = require('bcryptjs');
  } catch (error) {
    log('warn', {
      message: 'SUPER_ADMIN_SEED_PASSWORD could not be applied — bcryptjs unavailable',
      error: error && error.message,
    });
    return 'ignored';
  }

  if (user.passwordHash && (await bcrypt.compare(password, user.passwordHash))) {
    log('warn', {
      message: 'SUPER_ADMIN_SEED_PASSWORD is still set — remove it now that you can sign in',
      why: 'while it is set it overrides this account’s password on every deploy',
      email: address,
    });
    return 'unchanged';
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  });

  log('warn', {
    message: 'Set the owner account’s password from SUPER_ADMIN_SEED_PASSWORD',
    email: address,
    next: 'Sign in, change it under Settings, then REMOVE the variable',
  });

  try {
    await prisma.adminActivity.create({
      data: {
        adminUserId: user.id,
        action: 'user.password_reset',
        targetType: 'User',
        targetId: user.id,
        summary: `Set the password for ${address} at web startup from SUPER_ADMIN_SEED_PASSWORD`,
      },
    });
  } catch {
    // Reported below by the caller's own audit-trail handling; a missing trail
    // row must not undo a password the operator asked for.
  }

  return 'set';
}

/**
 * @returns one of, each also carrying `password`:
 *   { action: 'skipped',    reason }  nothing to do, and nothing was read
 *   { action: 'absent',     email }   no account holds the address yet
 *   { action: 'unchanged',  email }   already an active super admin
 *   { action: 'reconciled', email, from: { role, status } }
 */
async function ensureSuperAdmin({ prisma, email, password, log = () => {} }) {
  const address = normalizeEmail(email);

  if (!address) {
    return { action: 'skipped', reason: 'SUPER_ADMIN_EMAIL is not set' };
  }
  if (!looksLikeEmail(address)) {
    return { action: 'skipped', reason: `SUPER_ADMIN_EMAIL is not an email address: ${address}` };
  }

  const existing = await prisma.user.findUnique({
    where: { email: address },
    select: { id: true, role: true, status: true, deletedAt: true, passwordHash: true },
  });

  if (!existing) {
    log('info', {
      message: 'Owner address has no account yet — it becomes an admin when it registers',
      email: address,
    });
    return { action: 'absent', email: address, password: 'none' };
  }

  if (existing.deletedAt) {
    return {
      action: 'skipped',
      reason: `the account for ${address} is deleted — not resurrecting it`,
    };
  }

  // The password is applied whatever the role turns out to be: an account that
  // already holds the role is precisely the one whose owner may be locked out
  // of it.
  const passwordAction = await applySeedPassword({
    prisma,
    user: existing,
    address,
    password,
    log,
  });

  if (existing.role === SUPER_ADMIN && existing.status === ACTIVE) {
    return { action: 'unchanged', email: address, password: passwordAction };
  }

  const from = { role: existing.role, status: existing.status };

  // A suspended account with an admin role is still locked out, so the
  // suspension is cleared too rather than granting a role that cannot be used.
  await prisma.user.update({
    where: { id: existing.id },
    data: {
      role: SUPER_ADMIN,
      status: ACTIVE,
      suspendedAt: null,
      suspendedReason: null,
    },
  });

  log('warn', {
    message: 'Granted SUPER_ADMIN to the configured owner address',
    email: address,
    was: from,
    why: 'SUPER_ADMIN_EMAIL names this address',
  });

  // There is no acting administrator when this runs at boot, so the record
  // names the grantee as the subject and says where it came from. The trail is
  // worth having but is not worth failing a boot over.
  try {
    await prisma.adminActivity.create({
      data: {
        adminUserId: existing.id,
        action: 'user.role_change',
        targetType: 'User',
        targetId: existing.id,
        summary:
          `Granted SUPER_ADMIN to ${address} at web startup because SUPER_ADMIN_EMAIL names it ` +
          `(was role ${from.role}, status ${from.status})`,
      },
    });
  } catch (error) {
    log('warn', {
      message: 'Role granted, but the audit-trail row could not be written',
      error: error && error.message,
    });
  }

  return { action: 'reconciled', email: address, from, password: passwordAction };
}

module.exports = { ensureSuperAdmin, normalizeEmail, looksLikeEmail };
