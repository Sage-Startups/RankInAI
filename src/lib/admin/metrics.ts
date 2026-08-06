import {
  AuditStatus,
  JobStatus,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';

import { prisma } from '@/lib/db';
import { entitlementsForPlan } from '@/lib/plans';
import { getFunnelCounts } from '@/lib/analytics';

/**
 * Admin metrics.
 *
 * Every query takes an explicit `includeDemo` flag which defaults to false.
 * Seeded demonstration records must never appear in real revenue or usage
 * figures unless an administrator deliberately turns the toggle on.
 */

export interface AdminOverview {
  includeDemo: boolean;
  users: { total: number; active: number; suspended: number; newLast30Days: number };
  subscriptions: {
    active: number;
    byPlan: Array<{ plan: string; count: number }>;
    mrrCents: number;
  };
  revenue: {
    grossCents: number;
    oneTimeCents: number;
    subscriptionCents: number;
    last30DaysCents: number;
    refundedCents: number;
    oneTimePurchases: number;
  };
  audits: {
    total: number;
    completed: number;
    processing: number;
    queued: number;
    failed: number;
    averageScore: number | null;
  };
  funnel: Awaited<ReturnType<typeof getFunnelCounts>>;
  contacts: { total: number; unread: number };
}

function demoFilter(includeDemo: boolean): { isDemo?: boolean } {
  return includeDemo ? {} : { isDemo: false };
}

export async function getAdminOverview(includeDemo = false): Promise<AdminOverview> {
  const demo = demoFilter(includeDemo);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers,
    suspendedUsers,
    newUsers,
    activeSubscriptions,
    subscriptionsByPlan,
    paymentAggregate,
    oneTimeAggregate,
    subscriptionAggregate,
    last30Aggregate,
    refundAggregate,
    oneTimePurchaseCount,
    totalAudits,
    completedAudits,
    processingAudits,
    queuedAudits,
    failedAudits,
    scoreAggregate,
    funnel,
    totalContacts,
    unreadContacts,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null, ...demo } }),
    prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE', ...demo } }),
    prisma.user.count({ where: { deletedAt: null, status: 'SUSPENDED', ...demo } }),
    prisma.user.count({ where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo }, ...demo } }),
    prisma.subscription.count({
      where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] }, ...demo },
    }),
    prisma.subscription.groupBy({
      by: ['plan'],
      where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] }, ...demo },
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: { status: PaymentStatus.SUCCEEDED, ...demo },
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({
      where: { status: PaymentStatus.SUCCEEDED, kind: 'ONE_TIME_AUDIT', ...demo },
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({
      where: { status: PaymentStatus.SUCCEEDED, kind: 'SUBSCRIPTION', ...demo },
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({
      where: { status: PaymentStatus.SUCCEEDED, paidAt: { gte: thirtyDaysAgo }, ...demo },
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({
      where: { ...demo },
      _sum: { refundedCents: true },
    }),
    prisma.purchase.count({ where: { ...demo } }),
    prisma.audit.count({ where: { deletedAt: null, ...demo } }),
    prisma.audit.count({ where: { deletedAt: null, status: AuditStatus.COMPLETED, ...demo } }),
    prisma.audit.count({ where: { deletedAt: null, status: AuditStatus.RUNNING, ...demo } }),
    prisma.audit.count({ where: { deletedAt: null, status: AuditStatus.QUEUED, ...demo } }),
    prisma.audit.count({ where: { deletedAt: null, status: AuditStatus.FAILED, ...demo } }),
    prisma.audit.aggregate({
      where: { deletedAt: null, status: AuditStatus.COMPLETED, ...demo },
      _avg: { overallScore: true },
    }),
    getFunnelCounts({ includeDemo }),
    prisma.contactSubmission.count({ where: { ...demo } }),
    prisma.contactSubmission.count({ where: { status: 'NEW', ...demo } }),
  ]);

  // MRR is derived from live plan pricing rather than stored amounts, so a
  // price change is reflected immediately.
  const planPrices: Record<string, number> = {
    STARTER: 2900,
    GROWTH: 7900,
    AGENCY: 19900,
    FREE: 0,
  };
  const mrrCents = subscriptionsByPlan.reduce(
    (sum, row) => sum + (planPrices[row.plan] ?? 0) * row._count._all,
    0,
  );

  return {
    includeDemo,
    users: {
      total: totalUsers,
      active: activeUsers,
      suspended: suspendedUsers,
      newLast30Days: newUsers,
    },
    subscriptions: {
      active: activeSubscriptions,
      byPlan: subscriptionsByPlan.map((row) => ({ plan: row.plan, count: row._count._all })),
      mrrCents,
    },
    revenue: {
      grossCents: paymentAggregate._sum.amountCents ?? 0,
      oneTimeCents: oneTimeAggregate._sum.amountCents ?? 0,
      subscriptionCents: subscriptionAggregate._sum.amountCents ?? 0,
      last30DaysCents: last30Aggregate._sum.amountCents ?? 0,
      refundedCents: refundAggregate._sum.refundedCents ?? 0,
      oneTimePurchases: oneTimePurchaseCount,
    },
    audits: {
      total: totalAudits,
      completed: completedAudits,
      processing: processingAudits,
      queued: queuedAudits,
      failed: failedAudits,
      averageScore:
        scoreAggregate._avg.overallScore != null
          ? Math.round(scoreAggregate._avg.overallScore)
          : null,
    },
    funnel,
    contacts: { total: totalContacts, unread: unreadContacts },
  };
}

/** Daily revenue and signup series for the admin analytics charts. */
export interface DailySeriesPoint {
  date: string;
  revenueCents: number;
  signups: number;
  audits: number;
}

export async function getDailySeries(options: {
  from: Date;
  to: Date;
  includeDemo?: boolean;
}): Promise<DailySeriesPoint[]> {
  const includeDemo = options.includeDemo ?? false;
  const demo = demoFilter(includeDemo);

  const [payments, users, audits] = await Promise.all([
    prisma.payment.findMany({
      where: {
        status: PaymentStatus.SUCCEEDED,
        paidAt: { gte: options.from, lte: options.to },
        ...demo,
      },
      select: { paidAt: true, amountCents: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: options.from, lte: options.to }, deletedAt: null, ...demo },
      select: { createdAt: true },
    }),
    prisma.audit.findMany({
      where: { createdAt: { gte: options.from, lte: options.to }, deletedAt: null, ...demo },
      select: { createdAt: true },
    }),
  ]);

  const buckets = new Map<string, DailySeriesPoint>();

  // Seed every day in the range so charts have no gaps.
  const cursor = new Date(
    Date.UTC(options.from.getUTCFullYear(), options.from.getUTCMonth(), options.from.getUTCDate()),
  );
  const end = new Date(
    Date.UTC(options.to.getUTCFullYear(), options.to.getUTCMonth(), options.to.getUTCDate()),
  );
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    buckets.set(key, { date: key, revenueCents: 0, signups: 0, audits: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  for (const payment of payments) {
    if (!payment.paidAt) continue;
    const key = payment.paidAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) bucket.revenueCents += payment.amountCents;
  }
  for (const user of users) {
    const key = user.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) bucket.signups += 1;
  }
  for (const audit of audits) {
    const key = audit.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) bucket.audits += 1;
  }

  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function getJobHealth(includeDemo = false) {
  const demo = demoFilter(includeDemo);
  const [queued, running, failed, completed, oldest, recentFailures] = await Promise.all([
    prisma.auditJob.count({ where: { status: JobStatus.QUEUED, ...demo } }),
    prisma.auditJob.count({ where: { status: JobStatus.RUNNING, ...demo } }),
    prisma.auditJob.count({ where: { status: JobStatus.FAILED, ...demo } }),
    prisma.auditJob.count({ where: { status: JobStatus.COMPLETED, ...demo } }),
    prisma.auditJob.findFirst({
      where: { status: JobStatus.QUEUED, ...demo },
      orderBy: { scheduledAt: 'asc' },
      select: { scheduledAt: true },
    }),
    prisma.auditJob.findMany({
      where: { status: JobStatus.FAILED, ...demo },
      orderBy: { finishedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        auditId: true,
        lastError: true,
        finishedAt: true,
        attempts: true,
        creditRestored: true,
      },
    }),
  ]);

  return { queued, running, failed, completed, oldestQueuedAt: oldest?.scheduledAt ?? null, recentFailures };
}

export type UserSearchResult = Prisma.UserGetPayload<{
  select: {
    id: true;
    email: true;
    name: true;
    role: true;
    status: true;
    oneTimeCredits: true;
    isDemo: true;
    createdAt: true;
    lastLoginAt: true;
    _count: { select: { audits: true; payments: true } };
  };
}>;

export async function searchUsers(options: {
  query?: string;
  includeDemo?: boolean;
  skip?: number;
  take?: number;
}): Promise<{ users: UserSearchResult[]; total: number }> {
  const includeDemo = options.includeDemo ?? false;
  const query = options.query?.trim();

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(includeDemo ? {} : { isDemo: false }),
    ...(query
      ? {
          OR: [
            { email: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: options.skip ?? 0,
      take: options.take ?? 25,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        oneTimeCredits: true,
        isDemo: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { audits: true, payments: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
}

/**
 * Aggregate the seeded April 2026 buyer-preview figures.
 * Always demo-only — this function never reads real records.
 */
export async function getDemoSnapshotTotals(from: Date, to: Date) {
  const records = await prisma.demoAnalyticsRecord.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: { date: 'asc' },
  });

  const totals = records.reduce(
    (acc, row) => ({
      signups: acc.signups + row.signups,
      oneTimeSales: acc.oneTimeSales + row.oneTimeSales,
      revenueCents: acc.revenueCents + row.revenueCents,
      auditsCreated: acc.auditsCreated + row.auditsCreated,
      auditsCompleted: acc.auditsCompleted + row.auditsCompleted,
      demoRuns: acc.demoRuns + row.demoRuns,
      previewRuns: acc.previewRuns + row.previewRuns,
    }),
    {
      signups: 0,
      oneTimeSales: 0,
      revenueCents: 0,
      auditsCreated: 0,
      auditsCompleted: 0,
      demoRuns: 0,
      previewRuns: 0,
    },
  );

  return { records, totals };
}

export { entitlementsForPlan };
