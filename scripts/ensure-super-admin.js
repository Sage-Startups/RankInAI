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

/**
 * @returns one of:
 *   { action: 'skipped',    reason }  nothing to do, and nothing was read
 *   { action: 'absent',     email }   no account holds the address yet
 *   { action: 'unchanged',  email }   already an active super admin
 *   { action: 'reconciled', email, from: { role, status } }
 */
async function ensureSuperAdmin({ prisma, email, log = () => {} }) {
  const address = normalizeEmail(email);

  if (!address) {
    return { action: 'skipped', reason: 'SUPER_ADMIN_EMAIL is not set' };
  }
  if (!looksLikeEmail(address)) {
    return { action: 'skipped', reason: `SUPER_ADMIN_EMAIL is not an email address: ${address}` };
  }

  const existing = await prisma.user.findUnique({
    where: { email: address },
    select: { id: true, role: true, status: true, deletedAt: true },
  });

  if (!existing) {
    log('info', {
      message: 'Owner address has no account yet — it becomes an admin when it registers',
      email: address,
    });
    return { action: 'absent', email: address };
  }

  if (existing.deletedAt) {
    return {
      action: 'skipped',
      reason: `the account for ${address} is deleted — not resurrecting it`,
    };
  }

  if (existing.role === SUPER_ADMIN && existing.status === ACTIVE) {
    return { action: 'unchanged', email: address };
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

  return { action: 'reconciled', email: address, from };
}

module.exports = { ensureSuperAdmin, normalizeEmail, looksLikeEmail };
