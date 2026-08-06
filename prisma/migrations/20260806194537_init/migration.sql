-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_DELETION');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'AGENCY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INCOMPLETE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'PAUSED');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('ONE_TIME_AUDIT', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "CreditReason" AS ENUM ('ONE_TIME_PURCHASE', 'ADMIN_GRANT', 'ADMIN_REVOKE', 'AUDIT_RESERVED', 'AUDIT_REFUNDED', 'SEED_DEMO');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('DRAFT', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "AuditCategory" AS ENUM ('TECHNICAL_ACCESSIBILITY', 'ENTITY_CLARITY', 'CONTENT_AUTHORITY', 'ANSWER_READINESS', 'STRUCTURED_DATA', 'TRUST_AND_EVIDENCE', 'COMPETITIVE_VISIBILITY');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('PASS', 'WARN', 'FAIL', 'INFO', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'PASSED', 'INFORMATIONAL');

-- CreateEnum
CREATE TYPE "EvidenceSource" AS ENUM ('OBSERVED', 'AI_ENHANCED', 'SEARCH_OBSERVATION', 'DEMO_DATA');

-- CreateEnum
CREATE TYPE "EffortLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ImpactLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RecommendationHorizon" AS ENUM ('DO_FIRST', 'NEXT_30_DAYS', 'LONGER_TERM');

-- CreateEnum
CREATE TYPE "CreditSource" AS ENUM ('ONE_TIME_CREDIT', 'SUBSCRIPTION_ALLOWANCE', 'ADMIN_GRANT', 'DEMO');

-- CreateEnum
CREATE TYPE "PageRole" AS ENUM ('HOME', 'ABOUT', 'CONTACT', 'SERVICE', 'PRODUCT', 'CATEGORY', 'BLOG_INDEX', 'ARTICLE', 'AUTHOR', 'FAQ', 'PRICING', 'CASE_STUDY', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'READ', 'RESPONDED', 'ARCHIVED', 'SPAM');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "CompetitorStatus" AS ENUM ('PENDING', 'ANALYZED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "name" TEXT,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripeCustomerId" TEXT,
    "oneTimeCredits" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "deletionRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestIp" TEXT,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT,
    "companyName" TEXT,
    "companyWebsite" TEXT,
    "primaryUseCase" TEXT,
    "businessType" TEXT,
    "auditingOwnWebsite" BOOLEAN,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingSkipped" BOOLEAN NOT NULL DEFAULT false,
    "pendingPlanSelection" TEXT,
    "brandingCompanyName" TEXT,
    "brandingLogoUrl" TEXT,
    "brandingAccentColor" TEXT,
    "emailProductUpdates" BOOLEAN NOT NULL DEFAULT true,
    "emailAuditComplete" BOOLEAN NOT NULL DEFAULT true,
    "emailMarketing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "stripePriceId" TEXT,
    "plan" "PlanTier" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "auditsUsedThisPeriod" INTEGER NOT NULL DEFAULT 0,
    "periodAnchor" TIMESTAMP(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeInvoiceId" TEXT,
    "stripeCustomerId" TEXT,
    "kind" "PaymentKind" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "description" TEXT,
    "productKey" TEXT,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT,
    "productKey" TEXT NOT NULL,
    "creditsGranted" INTEGER NOT NULL DEFAULT 0,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditCreditLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" "CreditReason" NOT NULL,
    "note" TEXT,
    "auditId" TEXT,
    "adminUserId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB,
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "normalizedDomain" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "industry" TEXT,
    "targetCountry" TEXT NOT NULL DEFAULT 'United States',
    "targetAudience" TEXT,
    "primaryServices" TEXT,
    "businessLocation" TEXT,
    "status" "AuditStatus" NOT NULL DEFAULT 'DRAFT',
    "planAtCreation" "PlanTier" NOT NULL DEFAULT 'FREE',
    "creditSource" "CreditSource" NOT NULL DEFAULT 'SUBSCRIPTION_ALLOWANCE',
    "pageLimit" INTEGER NOT NULL DEFAULT 10,
    "competitorLimit" INTEGER NOT NULL DEFAULT 1,
    "overallScore" INTEGER,
    "previousScore" INTEGER,
    "executiveSummary" TEXT,
    "strengths" JSONB,
    "weaknesses" JSONB,
    "brandingName" TEXT,
    "brandingLogoUrl" TEXT,
    "whiteLabel" BOOLEAN NOT NULL DEFAULT false,
    "consentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "llmEnhanced" BOOLEAN NOT NULL DEFAULT false,
    "llmModel" TEXT,
    "llmGeneratedAt" TIMESTAMP(3),
    "searchObserved" BOOLEAN NOT NULL DEFAULT false,
    "searchProvider" TEXT,
    "searchFindings" JSONB,
    "robotsSummary" JSONB,
    "failureMessage" TEXT,
    "failureCode" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditJob" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "progressMessage" TEXT,
    "currentStep" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "creditRestored" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditPage" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "finalUrl" TEXT,
    "role" "PageRole" NOT NULL DEFAULT 'OTHER',
    "depth" INTEGER NOT NULL DEFAULT 0,
    "statusCode" INTEGER,
    "redirectChain" JSONB,
    "contentType" TEXT,
    "title" TEXT,
    "metaDescription" TEXT,
    "canonical" TEXT,
    "robotsMeta" TEXT,
    "langAttr" TEXT,
    "viewport" TEXT,
    "h1" JSONB,
    "headings" JSONB,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "imagesWithAlt" INTEGER NOT NULL DEFAULT 0,
    "internalLinks" INTEGER NOT NULL DEFAULT 0,
    "externalLinks" INTEGER NOT NULL DEFAULT 0,
    "brokenLinks" JSONB,
    "schemaTypes" JSONB,
    "jsonLdSummary" JSONB,
    "openGraph" JSONB,
    "twitterCard" JSONB,
    "hasFaqSignals" BOOLEAN NOT NULL DEFAULT false,
    "hasQuestionHeadings" BOOLEAN NOT NULL DEFAULT false,
    "listCount" INTEGER NOT NULL DEFAULT 0,
    "tableCount" INTEGER NOT NULL DEFAULT 0,
    "publishedDate" TEXT,
    "modifiedDate" TEXT,
    "authors" JSONB,
    "isHttps" BOOLEAN NOT NULL DEFAULT false,
    "fetchMs" INTEGER NOT NULL DEFAULT 0,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "blockedByRobots" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditFinding" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "category" "AuditCategory" NOT NULL,
    "checkId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "FindingStatus" NOT NULL,
    "severity" "Severity" NOT NULL,
    "evidence" JSONB,
    "explanation" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "effort" "EffortLevel" NOT NULL DEFAULT 'MEDIUM',
    "impact" "ImpactLevel" NOT NULL DEFAULT 'MEDIUM',
    "pageUrl" TEXT,
    "source" "EvidenceSource" NOT NULL DEFAULT 'OBSERVED',
    "pointsAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pointsPossible" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditRecommendation" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "horizon" "RecommendationHorizon" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "category" "AuditCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "recommendedChange" TEXT NOT NULL,
    "exampleImplementation" TEXT,
    "expectedImpact" TEXT NOT NULL,
    "impact" "ImpactLevel" NOT NULL DEFAULT 'MEDIUM',
    "effort" "EffortLevel" NOT NULL DEFAULT 'MEDIUM',
    "relatedCheckIds" JSONB,
    "source" "EvidenceSource" NOT NULL DEFAULT 'OBSERVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditCompetitor" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "status" "CompetitorStatus" NOT NULL DEFAULT 'PENDING',
    "overallScore" INTEGER,
    "categoryScores" JSONB,
    "highlights" JSONB,
    "gaps" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditCompetitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditScore" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "category" "AuditCategory" NOT NULL,
    "score" INTEGER NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "baseWeight" DOUBLE PRECISION NOT NULL,
    "effectiveWeight" DOUBLE PRECISION NOT NULL,
    "rawPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "brandingName" TEXT,
    "whiteLabel" BOOLEAN NOT NULL DEFAULT false,
    "pdfData" BYTEA,
    "pdfBytes" INTEGER NOT NULL DEFAULT 0,
    "pdfError" TEXT,
    "generatedAt" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactSubmission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
    "ipHash" TEXT,
    "userAgent" TEXT,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitEvent" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "identifierHash" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminActivity" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "summary" TEXT NOT NULL,
    "detail" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "sessionKey" TEXT,
    "path" TEXT,
    "properties" JSONB,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoAnalyticsRecord" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "signups" INTEGER NOT NULL DEFAULT 0,
    "oneTimeSales" INTEGER NOT NULL DEFAULT 0,
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "auditsCreated" INTEGER NOT NULL DEFAULT 0,
    "auditsCompleted" INTEGER NOT NULL DEFAULT 0,
    "demoRuns" INTEGER NOT NULL DEFAULT 0,
    "previewRuns" INTEGER NOT NULL DEFAULT 0,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoAnalyticsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreePreviewRun" (
    "id" TEXT NOT NULL,
    "domainHash" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "score" INTEGER,
    "findingCount" INTEGER NOT NULL DEFAULT 0,
    "succeeded" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreePreviewRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_isDemo_idx" ON "User"("isDemo");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_isDemo_idx" ON "Subscription"("isDemo");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeCheckoutSessionId_key" ON "Payment"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeInvoiceId_key" ON "Payment"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_isDemo_idx" ON "Payment"("isDemo");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Purchase_userId_idx" ON "Purchase"("userId");

-- CreateIndex
CREATE INDEX "Purchase_isDemo_idx" ON "Purchase"("isDemo");

-- CreateIndex
CREATE INDEX "Purchase_createdAt_idx" ON "Purchase"("createdAt");

-- CreateIndex
CREATE INDEX "AuditCreditLedger_userId_idx" ON "AuditCreditLedger"("userId");

-- CreateIndex
CREATE INDEX "AuditCreditLedger_auditId_idx" ON "AuditCreditLedger"("auditId");

-- CreateIndex
CREATE INDEX "AuditCreditLedger_isDemo_idx" ON "AuditCreditLedger"("isDemo");

-- CreateIndex
CREATE INDEX "AuditCreditLedger_createdAt_idx" ON "AuditCreditLedger"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key" ON "StripeWebhookEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_type_idx" ON "StripeWebhookEvent"("type");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_status_idx" ON "StripeWebhookEvent"("status");

-- CreateIndex
CREATE INDEX "Audit_userId_idx" ON "Audit"("userId");

-- CreateIndex
CREATE INDEX "Audit_status_idx" ON "Audit"("status");

-- CreateIndex
CREATE INDEX "Audit_isDemo_idx" ON "Audit"("isDemo");

-- CreateIndex
CREATE INDEX "Audit_createdAt_idx" ON "Audit"("createdAt");

-- CreateIndex
CREATE INDEX "Audit_normalizedDomain_idx" ON "Audit"("normalizedDomain");

-- CreateIndex
CREATE UNIQUE INDEX "AuditJob_auditId_key" ON "AuditJob"("auditId");

-- CreateIndex
CREATE INDEX "AuditJob_status_scheduledAt_idx" ON "AuditJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "AuditJob_lockedAt_idx" ON "AuditJob"("lockedAt");

-- CreateIndex
CREATE INDEX "AuditPage_auditId_idx" ON "AuditPage"("auditId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditPage_auditId_url_key" ON "AuditPage"("auditId", "url");

-- CreateIndex
CREATE INDEX "AuditFinding_auditId_category_idx" ON "AuditFinding"("auditId", "category");

-- CreateIndex
CREATE INDEX "AuditFinding_severity_idx" ON "AuditFinding"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "AuditFinding_auditId_checkId_key" ON "AuditFinding"("auditId", "checkId");

-- CreateIndex
CREATE INDEX "AuditRecommendation_auditId_horizon_idx" ON "AuditRecommendation"("auditId", "horizon");

-- CreateIndex
CREATE INDEX "AuditCompetitor_auditId_idx" ON "AuditCompetitor"("auditId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditCompetitor_auditId_url_key" ON "AuditCompetitor"("auditId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "AuditScore_auditId_category_key" ON "AuditScore"("auditId", "category");

-- CreateIndex
CREATE INDEX "Report_auditId_idx" ON "Report"("auditId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_auditId_version_key" ON "Report"("auditId", "version");

-- CreateIndex
CREATE INDEX "ContactSubmission_status_idx" ON "ContactSubmission"("status");

-- CreateIndex
CREATE INDEX "ContactSubmission_createdAt_idx" ON "ContactSubmission"("createdAt");

-- CreateIndex
CREATE INDEX "RateLimitEvent_bucket_identifierHash_createdAt_idx" ON "RateLimitEvent"("bucket", "identifierHash", "createdAt");

-- CreateIndex
CREATE INDEX "RateLimitEvent_createdAt_idx" ON "RateLimitEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AdminActivity_adminUserId_idx" ON "AdminActivity"("adminUserId");

-- CreateIndex
CREATE INDEX "AdminActivity_createdAt_idx" ON "AdminActivity"("createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_name_createdAt_idx" ON "AnalyticsEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_isDemo_idx" ON "AnalyticsEvent"("isDemo");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

-- CreateIndex
CREATE INDEX "DemoAnalyticsRecord_date_idx" ON "DemoAnalyticsRecord"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DemoAnalyticsRecord_date_key" ON "DemoAnalyticsRecord"("date");

-- CreateIndex
CREATE INDEX "FreePreviewRun_ipHash_createdAt_idx" ON "FreePreviewRun"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "FreePreviewRun_createdAt_idx" ON "FreePreviewRun"("createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditCreditLedger" ADD CONSTRAINT "AuditCreditLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditCreditLedger" ADD CONSTRAINT "AuditCreditLedger_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditCreditLedger" ADD CONSTRAINT "AuditCreditLedger_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditJob" ADD CONSTRAINT "AuditJob_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditPage" ADD CONSTRAINT "AuditPage_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRecommendation" ADD CONSTRAINT "AuditRecommendation_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditCompetitor" ADD CONSTRAINT "AuditCompetitor_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditScore" ADD CONSTRAINT "AuditScore_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactSubmission" ADD CONSTRAINT "ContactSubmission_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminActivity" ADD CONSTRAINT "AdminActivity_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
