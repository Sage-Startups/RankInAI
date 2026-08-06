import 'dotenv/config';

import {
  AuditStatus,
  CompetitorStatus,
  CreditReason,
  CreditSource,
  JobStatus,
  PaymentKind,
  PaymentStatus,
  PlanTier,
  Prisma,
  PrismaClient,
  Role,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

import {
  DEMO_BUSINESS,
  DEMO_CATEGORY_SCORES,
  DEMO_COMPETITOR,
  DEMO_FINDINGS,
  DEMO_PAGES,
  DEMO_RECOMMENDATIONS,
  DEMO_STRENGTHS,
  DEMO_WEAKNESSES,
} from '../src/lib/demo/sample-audit';
import {
  APRIL_2026_WINDOW,
  DEMO_DAYS,
  DEMO_PURCHASES,
  DEMO_SNAPSHOT_TOTALS,
  ONE_TIME_PRICE_CENTS,
} from '../src/lib/demo/buyer-snapshot';
import { CATEGORY_ORDER, CATEGORY_WEIGHTS } from '../src/lib/audit/scoring';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../src/lib/settings';

/**
 * Database seed.
 *
 * Idempotent by construction: every write is an upsert keyed on a stable
 * identifier, so running it repeatedly updates the same rows rather than
 * duplicating them.
 *
 * Seeds:
 *   1. system settings
 *   2. the super admin (password only when SUPER_ADMIN_SEED_PASSWORD is set)
 *   3. a demo customer (non-production only)
 *   4. the Atlas Roofing demonstration audit, fully populated
 *   5. the April 2026 buyer-preview dataset
 *
 * Everything in 3-5 carries isDemo: true.
 */

const prisma = new PrismaClient();

const DEMO_CUSTOMER_EMAIL = 'demo.customer@example.invalid';
const DEMO_AUDIT_ID = 'seed-demo-audit-atlas-roofing';

function log(message: string) {
  console.log(`[seed] ${message}`);
}

async function seedSettings() {
  await prisma.systemSetting.upsert({
    where: { key: SETTINGS_KEY },
    create: {
      key: SETTINGS_KEY,
      value: DEFAULT_SETTINGS as unknown as Prisma.InputJsonValue,
      description: 'Operator-editable application settings.',
    },
    // Never clobber operator changes on a re-seed.
    update: {},
  });
  log('System settings ensured.');
}

async function seedSuperAdmin(): Promise<string> {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? 'admin@rankinai.com').trim().toLowerCase();
  const seedPassword = process.env.SUPER_ADMIN_SEED_PASSWORD;

  const passwordHash = seedPassword ? await bcrypt.hash(seedPassword, 12) : undefined;

  const admin = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: 'RankInAI Administrator',
      role: Role.SUPER_ADMIN,
      emailVerified: new Date(),
      isDemo: false,
      ...(passwordHash ? { passwordHash } : {}),
      profile: {
        create: {
          fullName: 'RankInAI Administrator',
          companyName: 'RankInAI',
          onboardingCompleted: true,
        },
      },
    },
    update: {
      role: Role.SUPER_ADMIN,
      // Only reset the password when one was supplied — a re-seed must not
      // silently overwrite a password the operator has since changed.
      ...(passwordHash ? { passwordHash } : {}),
    },
    select: { id: true, email: true, passwordHash: true },
  });

  if (passwordHash) {
    log(`Super admin ready: ${admin.email} (password set from SUPER_ADMIN_SEED_PASSWORD)`);
  } else if (admin.passwordHash) {
    log(`Super admin ready: ${admin.email} (existing password preserved)`);
  } else {
    log(
      `Super admin ready: ${admin.email} — NO PASSWORD SET. Use the forgot-password flow to set one.`,
    );
  }

  return admin.id;
}

async function seedDemoCustomer(): Promise<string> {
  const passwordHash = await bcrypt.hash('DemoCustomer-2026!', 12);

  const user = await prisma.user.upsert({
    where: { email: DEMO_CUSTOMER_EMAIL },
    create: {
      email: DEMO_CUSTOMER_EMAIL,
      name: 'Dana Reyes (demo)',
      passwordHash,
      role: Role.USER,
      emailVerified: new Date('2026-04-02T09:00:00Z'),
      isDemo: true,
      oneTimeCredits: 0,
      createdAt: new Date('2026-04-02T09:00:00Z'),
      profile: {
        create: {
          fullName: 'Dana Reyes (demo)',
          companyName: 'Atlas Roofing & Exteriors (demo)',
          companyWebsite: DEMO_BUSINESS.websiteUrl,
          primaryUseCase: 'Improve my own website',
          businessType: 'Local service business',
          auditingOwnWebsite: true,
          onboardingCompleted: true,
        },
      },
    },
    update: { isDemo: true },
    select: { id: true },
  });

  log('Demo customer ensured.');
  return user.id;
}

async function seedDemoAudit(userId: string) {
  const completedAt = new Date('2026-04-18T14:30:00Z');

  const audit = await prisma.audit.upsert({
    where: { id: DEMO_AUDIT_ID },
    create: {
      id: DEMO_AUDIT_ID,
      userId,
      websiteUrl: DEMO_BUSINESS.websiteUrl,
      normalizedDomain: DEMO_BUSINESS.displayDomain,
      businessName: DEMO_BUSINESS.name,
      industry: DEMO_BUSINESS.industry,
      targetCountry: DEMO_BUSINESS.targetCountry,
      targetAudience: DEMO_BUSINESS.audience,
      primaryServices: DEMO_BUSINESS.services,
      businessLocation: DEMO_BUSINESS.location,
      status: AuditStatus.COMPLETED,
      planAtCreation: PlanTier.FREE,
      creditSource: CreditSource.DEMO,
      pageLimit: 10,
      competitorLimit: 1,
      overallScore: DEMO_BUSINESS.overallScore,
      previousScore: 65,
      consentConfirmed: true,
      isDemo: true,
      createdAt: new Date('2026-04-18T14:22:00Z'),
      startedAt: new Date('2026-04-18T14:22:30Z'),
      completedAt,
      executiveSummary:
        'Atlas Roofing & Exteriors scores 72 out of 100 for AI visibility readiness, based on 10 pages crawled from www.atlasroofingexteriors.example. The site is technically sound and unusually strong on trust signals: complete contact details, a stated Colorado license number and a 2004 founding date all appear site-wide and match the LocalBusiness schema exactly. The limiting factor is structure rather than substance. Fourteen genuine question-and-answer pairs already exist across three pages but carry no FAQPage markup, so an answer engine has to infer them from headings. Service pages average 380 words with no pricing, process or outcome detail, and every page on the site is published anonymously. The three "Do first" actions below are all low or medium effort and address content that already exists — they make it machine-readable rather than requiring anything new to be written.',
      strengths: DEMO_STRENGTHS as unknown as Prisma.InputJsonValue,
      weaknesses: DEMO_WEAKNESSES as unknown as Prisma.InputJsonValue,
      robotsSummary: {
        found: true,
        blocksEverything: false,
        blockedAiAgents: [],
        sitemaps: [`${DEMO_BUSINESS.websiteUrl}/sitemap.xml`],
        sitemapFound: true,
        sitemapUrlCount: 24,
        llmsTxtFound: false,
      } as unknown as Prisma.InputJsonValue,
    },
    update: {
      overallScore: DEMO_BUSINESS.overallScore,
      status: AuditStatus.COMPLETED,
      completedAt,
      isDemo: true,
    },
    select: { id: true },
  });

  // Replace child rows so the demo audit always matches the shared dataset.
  await prisma.$transaction([
    prisma.auditPage.deleteMany({ where: { auditId: audit.id } }),
    prisma.auditFinding.deleteMany({ where: { auditId: audit.id } }),
    prisma.auditRecommendation.deleteMany({ where: { auditId: audit.id } }),
    prisma.auditScore.deleteMany({ where: { auditId: audit.id } }),
    prisma.auditCompetitor.deleteMany({ where: { auditId: audit.id } }),
  ]);

  await prisma.auditPage.createMany({
    data: DEMO_PAGES.map((page, index) => ({
      auditId: audit.id,
      url: page.url,
      finalUrl: page.url,
      role: page.role,
      depth: index === 0 ? 0 : 1,
      statusCode: page.statusCode,
      title: page.title,
      wordCount: page.wordCount,
      schemaTypes: page.schemaTypes as unknown as Prisma.InputJsonValue,
      hasQuestionHeadings: page.questionHeadings > 0,
      hasFaqSignals: page.role === 'FAQ',
      isHttps: true,
      fetchMs: 420 + index * 35,
      bytes: 42_000 + index * 3_100,
    })),
  });

  await prisma.auditFinding.createMany({
    data: DEMO_FINDINGS.map((finding, index) => ({
      auditId: audit.id,
      category: finding.category,
      checkId: finding.checkId,
      title: finding.title,
      status: finding.status,
      severity: finding.severity,
      evidence: finding.evidence as unknown as Prisma.InputJsonValue,
      explanation: finding.explanation,
      recommendedAction: finding.recommendedAction,
      effort: finding.effort,
      impact: finding.impact,
      pageUrl: finding.pageUrl,
      source: finding.source,
      pointsAwarded: finding.status === 'PASS' ? 8 : finding.status === 'WARN' ? 4 : 0,
      pointsPossible: 8,
      sortOrder: index,
    })),
  });

  await prisma.auditRecommendation.createMany({
    data: DEMO_RECOMMENDATIONS.map((rec) => ({
      auditId: audit.id,
      horizon: rec.horizon,
      priority: rec.priority,
      category: rec.category,
      title: rec.title,
      whyItMatters: rec.whyItMatters,
      recommendedChange: rec.recommendedChange,
      exampleImplementation: rec.exampleImplementation,
      expectedImpact: rec.expectedImpact,
      impact: rec.impact,
      effort: rec.effort,
    })),
  });

  await prisma.auditScore.createMany({
    data: CATEGORY_ORDER.map((category) => {
      const demo = DEMO_CATEGORY_SCORES.find((c) => c.category === category);
      return {
        auditId: audit.id,
        category,
        score: demo?.score ?? 0,
        available: demo != null,
        baseWeight: CATEGORY_WEIGHTS[category],
        effectiveWeight: CATEGORY_WEIGHTS[category],
        rawPoints: demo ? Math.round((demo.score / 100) * 60 * 10) / 10 : 0,
        maxPoints: 60,
        summary: demo?.summary ?? 'Not measured for this audit.',
      };
    }),
  });

  await prisma.auditCompetitor.create({
    data: {
      auditId: audit.id,
      url: DEMO_COMPETITOR.url,
      name: DEMO_COMPETITOR.name,
      status: CompetitorStatus.ANALYZED,
      overallScore: DEMO_COMPETITOR.overallScore,
      categoryScores: DEMO_COMPETITOR.categoryScores as unknown as Prisma.InputJsonValue,
      highlights: DEMO_COMPETITOR.highlights as unknown as Prisma.InputJsonValue,
      gaps: DEMO_COMPETITOR.gaps as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.auditJob.upsert({
    where: { auditId: audit.id },
    create: {
      auditId: audit.id,
      status: JobStatus.COMPLETED,
      progress: 100,
      progressMessage: 'Audit complete',
      currentStep: 'done',
      attempts: 1,
      startedAt: new Date('2026-04-18T14:22:30Z'),
      finishedAt: completedAt,
      isDemo: true,
    },
    update: { status: JobStatus.COMPLETED, progress: 100, isDemo: true },
  });

  log('Demo audit for Atlas Roofing & Exteriors ensured.');
}

/**
 * April 2026 buyer-preview dataset.
 *
 * Creates the exact figures documented in FLIPPA_HANDOVER.md:
 * 3 sign-ups, 5 one-time payments at $49, $245 gross, $0 subscription revenue,
 * 5 credits purchased, 5 completed audits — all marked isDemo.
 */
async function seedBuyerPreview() {
  // Daily aggregate rows backing /business-snapshot.
  for (const day of DEMO_DAYS) {
    const date = new Date(`${day.date}T00:00:00.000Z`);
    await prisma.demoAnalyticsRecord.upsert({
      where: { date },
      create: {
        date,
        signups: day.signups,
        oneTimeSales: day.oneTimeSales,
        revenueCents: day.oneTimeSales * ONE_TIME_PRICE_CENTS,
        auditsCreated: day.auditsCreated,
        auditsCompleted: day.auditsCompleted,
        demoRuns: day.demoRuns,
        previewRuns: day.previewRuns,
        isDemo: true,
        note: 'Fabricated demonstration data for product presentation. Not real performance.',
      },
      update: {
        signups: day.signups,
        oneTimeSales: day.oneTimeSales,
        revenueCents: day.oneTimeSales * ONE_TIME_PRICE_CENTS,
        auditsCreated: day.auditsCreated,
        auditsCompleted: day.auditsCompleted,
        demoRuns: day.demoRuns,
        previewRuns: day.previewRuns,
        isDemo: true,
      },
    });
  }

  // Three demonstration customers, matching the three sign-ups.
  const demoEmails = [...new Set(DEMO_PURCHASES.map((p) => p.email))];
  const signupDates = ['2026-04-02', '2026-04-09', '2026-04-20'];
  const userIds: string[] = [];

  for (const [index, email] of demoEmails.entries()) {
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: `Demo customer ${index + 1}`,
        role: Role.USER,
        isDemo: true,
        emailVerified: new Date(`${signupDates[index] ?? '2026-04-02'}T10:00:00Z`),
        createdAt: new Date(`${signupDates[index] ?? '2026-04-02'}T10:00:00Z`),
        profile: {
          create: {
            fullName: `Demo customer ${index + 1}`,
            onboardingCompleted: true,
          },
        },
      },
      update: { isDemo: true },
      select: { id: true },
    });
    userIds.push(user.id);
  }

  // Five demonstration one-time payments and purchases.
  for (const [index, purchase] of DEMO_PURCHASES.entries()) {
    const userId = userIds[demoEmails.indexOf(purchase.email)];
    if (!userId) continue;

    const sessionId = `demo_seed_session_${index + 1}`;
    const paidAt = new Date(`${purchase.date}T15:00:00.000Z`);

    const payment = await prisma.payment.upsert({
      where: { stripeCheckoutSessionId: sessionId },
      create: {
        userId,
        stripeCheckoutSessionId: sessionId,
        kind: PaymentKind.ONE_TIME_AUDIT,
        status: PaymentStatus.SUCCEEDED,
        amountCents: purchase.amountCents,
        currency: 'usd',
        description: 'One-Time Full Audit (demonstration record)',
        productKey: 'ONE_TIME_AUDIT',
        isDemo: true,
        paidAt,
        createdAt: paidAt,
      },
      update: { isDemo: true, status: PaymentStatus.SUCCEEDED, amountCents: purchase.amountCents },
      select: { id: true },
    });

    const existingPurchase = await prisma.purchase.findFirst({
      where: { paymentId: payment.id },
      select: { id: true },
    });

    if (!existingPurchase) {
      await prisma.purchase.create({
        data: {
          userId,
          paymentId: payment.id,
          productKey: 'ONE_TIME_AUDIT',
          creditsGranted: 1,
          amountCents: purchase.amountCents,
          isDemo: true,
          createdAt: paidAt,
        },
      });

      await prisma.auditCreditLedger.create({
        data: {
          userId,
          delta: 1,
          balanceAfter: 1,
          reason: CreditReason.SEED_DEMO,
          note: 'Demonstration one-time audit purchase (seeded, not a real payment)',
          isDemo: true,
          createdAt: paidAt,
        },
      });
    }

    // A completed demonstration audit for each purchase — the credit was used.
    const auditId = `seed-demo-audit-${index + 1}`;
    const completedAt = new Date(`${purchase.date}T15:20:00.000Z`);

    await prisma.audit.upsert({
      where: { id: auditId },
      create: {
        id: auditId,
        userId,
        websiteUrl: `https://www.${purchase.auditDomain}`,
        normalizedDomain: purchase.auditDomain,
        businessName: purchase.auditDomain
          .split('.')[0]!
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/^./, (c) => c.toUpperCase()),
        targetCountry: 'United States',
        status: AuditStatus.COMPLETED,
        planAtCreation: PlanTier.FREE,
        creditSource: CreditSource.ONE_TIME_CREDIT,
        pageLimit: 10,
        competitorLimit: 1,
        overallScore: purchase.auditScore,
        executiveSummary:
          'Demonstration audit record seeded for the buyer-preview dataset. Not a real audit of a real website.',
        consentConfirmed: true,
        isDemo: true,
        createdAt: new Date(`${purchase.date}T15:05:00.000Z`),
        completedAt,
      },
      update: { isDemo: true, overallScore: purchase.auditScore, status: AuditStatus.COMPLETED },
    });

    await prisma.auditJob.upsert({
      where: { auditId },
      create: {
        auditId,
        status: JobStatus.COMPLETED,
        progress: 100,
        progressMessage: 'Audit complete',
        attempts: 1,
        finishedAt: completedAt,
        isDemo: true,
      },
      update: { status: JobStatus.COMPLETED, isDemo: true },
    });

    // The credit was spent on the audit, so the balance nets to zero.
    await prisma.user.update({
      where: { id: userId },
      data: { oneTimeCredits: 0 },
    });
  }

  // Demonstration analytics events so the funnel renders with the toggle on.
  const existingDemoEvents = await prisma.analyticsEvent.count({ where: { isDemo: true } });
  if (existingDemoEvents === 0) {
    const events: Prisma.AnalyticsEventCreateManyInput[] = [];
    for (const day of DEMO_DAYS) {
      const at = new Date(`${day.date}T12:00:00.000Z`);
      for (let i = 0; i < day.demoRuns; i += 1) {
        events.push({ name: 'demo_started', isDemo: true, createdAt: at, path: '/' });
        events.push({ name: 'demo_completed', isDemo: true, createdAt: at, path: '/' });
      }
      for (let i = 0; i < day.previewRuns; i += 1) {
        events.push({ name: 'live_preview_requested', isDemo: true, createdAt: at, path: '/demo' });
      }
      for (let i = 0; i < day.signups; i += 1) {
        events.push({ name: 'signup_completed', isDemo: true, createdAt: at, path: '/signup' });
      }
      for (let i = 0; i < day.oneTimeSales; i += 1) {
        events.push({ name: 'checkout_started', isDemo: true, createdAt: at, path: '/pricing' });
        events.push({
          name: 'checkout_completed',
          isDemo: true,
          createdAt: at,
          path: '/checkout/success',
        });
      }
      for (let i = 0; i < day.auditsCompleted; i += 1) {
        events.push({ name: 'audit_created', isDemo: true, createdAt: at });
        events.push({ name: 'audit_completed', isDemo: true, createdAt: at });
      }
    }
    await prisma.analyticsEvent.createMany({ data: events });
    log(`Seeded ${events.length} demonstration analytics events.`);
  }

  log(
    `Buyer-preview dataset ensured: ${DEMO_SNAPSHOT_TOTALS.signups} sign-ups, ${DEMO_SNAPSHOT_TOTALS.oneTimeSales} one-time sales, $${(
      DEMO_SNAPSHOT_TOTALS.grossRevenueCents / 100
    ).toFixed(2)} demonstration gross revenue (all isDemo: true).`,
  );
}

async function main() {
  log(`Seeding database (${process.env.NODE_ENV ?? 'development'})…`);

  await seedSettings();
  const adminId = await seedSuperAdmin();

  // Demo content is intentionally seeded in every environment so the sample
  // report and buyer-preview page work on a fresh deployment. It is always
  // marked isDemo and excluded from real analytics by default.
  const demoUserId = await seedDemoCustomer();
  await seedDemoAudit(demoUserId);
  await seedBuyerPreview();

  const [users, audits, demoRecords] = await Promise.all([
    prisma.user.count(),
    prisma.audit.count(),
    prisma.demoAnalyticsRecord.count(),
  ]);

  log(
    `Done. ${users} users, ${audits} audits, ${demoRecords} buyer-preview day records. Admin user id: ${adminId}`,
  );
  log(
    `April ${APRIL_2026_WINDOW.from.getUTCFullYear()} demonstration figures are visible at /business-snapshot and /admin/demo-data.`,
  );
}

main()
  .catch((error) => {
    console.error('[seed] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
