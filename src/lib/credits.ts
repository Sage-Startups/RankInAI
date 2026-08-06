import { CreditReason, type Prisma, SubscriptionStatus, PlanTier } from '@prisma/client';

import { prisma } from '@/lib/db';
import { entitlementsForPlan, type PlanEntitlements } from '@/lib/plans';

/**
 * Audit allowance accounting.
 *
 * Two independent pools:
 *   1. subscription allowance — N audits per billing period, reset by Stripe
 *      period boundaries
 *   2. one-time credits — purchased individually, never expire
 *
 * Subscription allowance is consumed first so purchased credits are preserved
 * for when a subscriber runs out.
 *
 * Every change to the one-time balance is written through `AuditCreditLedger`
 * inside the same transaction that changes `User.oneTimeCredits`, so the ledger
 * and the running balance can never diverge.
 */

export type CreditSourceUsed = 'SUBSCRIPTION_ALLOWANCE' | 'ONE_TIME_CREDIT';

export interface EntitlementSnapshot {
  plan: PlanTier;
  entitlements: PlanEntitlements;
  subscriptionActive: boolean;
  subscriptionId: string | null;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  auditsUsedThisPeriod: number;
  auditsRemainingThisPeriod: number;
  oneTimeCredits: number;
  totalAuditsAvailable: number;
  canCreateAudit: boolean;
}

const ACTIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE,
];

/** Read the user's current plan, allowance and credit balance. */
export async function getEntitlements(userId: string): Promise<EntitlementSnapshot> {
  const [user, subscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { oneTimeCredits: true },
    }),
    prisma.subscription.findFirst({
      where: { userId, status: { in: ACTIVE_STATUSES } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const plan = subscription?.plan ?? PlanTier.FREE;
  const entitlements = entitlementsForPlan(plan);
  const oneTimeCredits = user?.oneTimeCredits ?? 0;

  // PAST_DUE keeps access until Stripe cancels, but a canceled subscription
  // grants nothing.
  const subscriptionActive = subscription != null && ACTIVE_STATUSES.includes(subscription.status);

  const used = subscription?.auditsUsedThisPeriod ?? 0;
  const allowance = subscriptionActive ? entitlements.auditsPerPeriod : 0;
  const remaining = Math.max(0, allowance - used);

  return {
    plan,
    entitlements,
    subscriptionActive,
    subscriptionId: subscription?.id ?? null,
    periodEnd: subscription?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    auditsUsedThisPeriod: used,
    auditsRemainingThisPeriod: remaining,
    oneTimeCredits,
    totalAuditsAvailable: remaining + oneTimeCredits,
    canCreateAudit: remaining + oneTimeCredits > 0,
  };
}

/**
 * Effective limits for a new audit: the best of the subscription plan and the
 * one-time product, since a subscriber holding one-time credits should not be
 * downgraded by spending one.
 */
export function effectiveAuditLimits(snapshot: EntitlementSnapshot): {
  pageLimit: number;
  competitorLimit: number;
  whiteLabel: boolean;
} {
  const oneTime = entitlementsForPlan(PlanTier.FREE);
  const usingSubscription = snapshot.auditsRemainingThisPeriod > 0;

  if (usingSubscription) {
    return {
      pageLimit: snapshot.entitlements.pageLimit,
      competitorLimit: snapshot.entitlements.competitorLimit,
      whiteLabel: snapshot.entitlements.whiteLabelReports,
    };
  }

  // Spending a one-time credit: 10 pages / 1 competitor, unless the user also
  // holds a higher subscription tier.
  return {
    pageLimit: Math.max(
      10,
      snapshot.subscriptionActive ? snapshot.entitlements.pageLimit : oneTime.pageLimit,
    ),
    competitorLimit: Math.max(
      1,
      snapshot.subscriptionActive ? snapshot.entitlements.competitorLimit : 1,
    ),
    whiteLabel: snapshot.entitlements.whiteLabelReports,
  };
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super('No audits remaining on this account.');
    this.name = 'InsufficientCreditsError';
  }
}

/**
 * Atomically reserve one audit against the user's allowance.
 *
 * Runs inside a transaction with a conditional update, so two concurrent
 * requests cannot both consume the last credit.
 */
export async function reserveAuditCredit(
  userId: string,
  auditId: string,
  isDemo = false,
): Promise<CreditSourceUsed> {
  return prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.findFirst({
      where: { userId, status: { in: ACTIVE_STATUSES } },
      orderBy: { createdAt: 'desc' },
    });

    if (subscription) {
      const allowance = entitlementsForPlan(subscription.plan).auditsPerPeriod;
      if (subscription.auditsUsedThisPeriod < allowance) {
        // Conditional update guards against a concurrent reservation.
        const updated = await tx.subscription.updateMany({
          where: { id: subscription.id, auditsUsedThisPeriod: { lt: allowance } },
          data: { auditsUsedThisPeriod: { increment: 1 } },
        });
        if (updated.count === 1) {
          return 'SUBSCRIPTION_ALLOWANCE';
        }
      }
    }

    // Fall back to a one-time credit.
    const consumed = await tx.user.updateMany({
      where: { id: userId, oneTimeCredits: { gte: 1 } },
      data: { oneTimeCredits: { decrement: 1 } },
    });

    if (consumed.count !== 1) {
      throw new InsufficientCreditsError();
    }

    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { oneTimeCredits: true },
    });

    await tx.auditCreditLedger.create({
      data: {
        userId,
        delta: -1,
        balanceAfter: user.oneTimeCredits,
        reason: CreditReason.AUDIT_RESERVED,
        note: 'Reserved for audit',
        auditId,
        isDemo,
      },
    });

    return 'ONE_TIME_CREDIT';
  });
}

/**
 * Return a reserved audit credit after a permanent failure.
 *
 * Idempotent: the caller marks the job `creditRestored` in the same
 * transaction, and this function is a no-op once that flag is set.
 */
export async function restoreAuditCredit(
  auditId: string,
  reason = 'Audit failed before analysis could complete',
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const audit = await tx.audit.findUnique({
      where: { id: auditId },
      select: { id: true, userId: true, creditSource: true, isDemo: true },
    });
    if (!audit) return false;

    const job = await tx.auditJob.findUnique({
      where: { auditId },
      select: { id: true, creditRestored: true },
    });
    if (job?.creditRestored) return false;

    if (audit.creditSource === 'SUBSCRIPTION_ALLOWANCE') {
      const subscription = await tx.subscription.findFirst({
        where: { userId: audit.userId, status: { in: ACTIVE_STATUSES } },
        orderBy: { createdAt: 'desc' },
      });
      if (subscription && subscription.auditsUsedThisPeriod > 0) {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { auditsUsedThisPeriod: { decrement: 1 } },
        });
      }
    } else if (audit.creditSource === 'ONE_TIME_CREDIT') {
      const user = await tx.user.update({
        where: { id: audit.userId },
        data: { oneTimeCredits: { increment: 1 } },
        select: { oneTimeCredits: true },
      });
      await tx.auditCreditLedger.create({
        data: {
          userId: audit.userId,
          delta: 1,
          balanceAfter: user.oneTimeCredits,
          reason: CreditReason.AUDIT_REFUNDED,
          note: reason,
          auditId,
          isDemo: audit.isDemo,
        },
      });
    } else {
      return false;
    }

    if (job) {
      await tx.auditJob.update({
        where: { id: job.id },
        data: { creditRestored: true },
      });
    }

    return true;
  });
}

/** Grant one-time credits (Stripe purchase, admin action or seed). */
export async function grantCredits(params: {
  userId: string;
  amount: number;
  reason: CreditReason;
  note?: string;
  adminUserId?: string;
  isDemo?: boolean;
  tx?: Prisma.TransactionClient;
}): Promise<number> {
  const run = async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.update({
      where: { id: params.userId },
      data: { oneTimeCredits: { increment: params.amount } },
      select: { oneTimeCredits: true },
    });

    await tx.auditCreditLedger.create({
      data: {
        userId: params.userId,
        delta: params.amount,
        balanceAfter: user.oneTimeCredits,
        reason: params.reason,
        note: params.note,
        adminUserId: params.adminUserId,
        isDemo: params.isDemo ?? false,
      },
    });

    return user.oneTimeCredits;
  };

  if (params.tx) return run(params.tx);
  return prisma.$transaction(run);
}

/** Remove one-time credits, never dropping below zero. */
export async function revokeCredits(params: {
  userId: string;
  amount: number;
  note: string;
  adminUserId: string;
}): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findUniqueOrThrow({
      where: { id: params.userId },
      select: { oneTimeCredits: true },
    });

    const delta = -Math.min(params.amount, current.oneTimeCredits);
    if (delta === 0) return current.oneTimeCredits;

    const user = await tx.user.update({
      where: { id: params.userId },
      data: { oneTimeCredits: { increment: delta } },
      select: { oneTimeCredits: true },
    });

    await tx.auditCreditLedger.create({
      data: {
        userId: params.userId,
        delta,
        balanceAfter: user.oneTimeCredits,
        reason: CreditReason.ADMIN_REVOKE,
        note: params.note,
        adminUserId: params.adminUserId,
      },
    });

    return user.oneTimeCredits;
  });
}
