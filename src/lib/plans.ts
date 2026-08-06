import { PlanTier } from '@prisma/client';

/**
 * Single source of truth for pricing, entitlements and crawl limits.
 *
 * Stripe price IDs are read from the environment at call time — never hardcoded
 * here — so the same build works against test and live Stripe accounts.
 */

export type ProductKey = 'ONE_TIME_AUDIT' | 'STARTER_MONTHLY' | 'GROWTH_MONTHLY' | 'AGENCY_MONTHLY';

export interface PlanEntitlements {
  /** Audits included per monthly billing period. 0 for the one-time product. */
  auditsPerPeriod: number;
  /** Maximum pages the crawler may fetch for one audit. */
  pageLimit: number;
  /** Maximum competitor URLs accepted per audit. */
  competitorLimit: number;
  historicalTracking: boolean;
  advancedRecommendations: boolean;
  whiteLabelReports: boolean;
  csvExport: boolean;
  priorityQueue: boolean;
  supportLevel: 'Community' | 'Email' | 'Priority';
}

export interface PricedProduct {
  key: ProductKey;
  name: string;
  tagline: string;
  priceCents: number;
  interval: 'one_time' | 'month';
  plan: PlanTier;
  envVar: string;
  mostPopular?: boolean;
  features: string[];
  entitlements: PlanEntitlements;
}

export const FREE_ENTITLEMENTS: PlanEntitlements = {
  auditsPerPeriod: 0,
  pageLimit: 1,
  competitorLimit: 0,
  historicalTracking: false,
  advancedRecommendations: false,
  whiteLabelReports: false,
  csvExport: false,
  priorityQueue: false,
  supportLevel: 'Community',
};

export const ONE_TIME_ENTITLEMENTS: PlanEntitlements = {
  auditsPerPeriod: 0,
  pageLimit: 10,
  competitorLimit: 1,
  historicalTracking: false,
  advancedRecommendations: false,
  whiteLabelReports: false,
  csvExport: false,
  priorityQueue: false,
  supportLevel: 'Email',
};

export const PRODUCTS: Record<ProductKey, PricedProduct> = {
  ONE_TIME_AUDIT: {
    key: 'ONE_TIME_AUDIT',
    name: 'One-Time Full Audit',
    tagline: 'A single complete audit, no subscription.',
    priceCents: 4900,
    interval: 'one_time',
    plan: PlanTier.FREE,
    envVar: 'STRIPE_PRICE_ONE_TIME_AUDIT',
    features: [
      'One complete website audit',
      'Overall AI Visibility Score',
      'Up to 10 crawled pages',
      'Technical GEO checks',
      'Content and entity analysis',
      'Prioritized recommendations',
      'Competitor comparison for one competitor',
      'PDF report',
      'Audit remains available in your account',
    ],
    entitlements: ONE_TIME_ENTITLEMENTS,
  },
  STARTER_MONTHLY: {
    key: 'STARTER_MONTHLY',
    name: 'Starter',
    tagline: 'For a single website you want to keep improving.',
    priceCents: 2900,
    interval: 'month',
    plan: PlanTier.STARTER,
    envVar: 'STRIPE_PRICE_STARTER_MONTHLY',
    features: [
      '3 full audits per monthly billing period',
      'Up to 10 pages per audit',
      'One competitor per audit',
      'PDF reports',
      'Saved audit history',
      'Email support',
    ],
    entitlements: {
      auditsPerPeriod: 3,
      pageLimit: 10,
      competitorLimit: 1,
      historicalTracking: false,
      advancedRecommendations: false,
      whiteLabelReports: false,
      csvExport: false,
      priorityQueue: false,
      supportLevel: 'Email',
    },
  },
  GROWTH_MONTHLY: {
    key: 'GROWTH_MONTHLY',
    name: 'Growth',
    tagline: 'For marketing teams tracking visibility over time.',
    priceCents: 7900,
    interval: 'month',
    plan: PlanTier.GROWTH,
    envVar: 'STRIPE_PRICE_GROWTH_MONTHLY',
    mostPopular: true,
    features: [
      '15 full audits per monthly billing period',
      'Up to 25 pages per audit',
      'Up to three competitors',
      'Advanced recommendations',
      'Historical score tracking',
      'Exportable reports',
      'Priority support',
    ],
    entitlements: {
      auditsPerPeriod: 15,
      pageLimit: 25,
      competitorLimit: 3,
      historicalTracking: true,
      advancedRecommendations: true,
      whiteLabelReports: false,
      csvExport: true,
      priorityQueue: false,
      supportLevel: 'Priority',
    },
  },
  AGENCY_MONTHLY: {
    key: 'AGENCY_MONTHLY',
    name: 'Agency',
    tagline: 'For agencies and consultants auditing client websites.',
    priceCents: 19900,
    interval: 'month',
    plan: PlanTier.AGENCY,
    envVar: 'STRIPE_PRICE_AGENCY_MONTHLY',
    features: [
      '60 full audits per monthly billing period',
      'Up to 50 pages per audit',
      'Up to five competitors',
      'White-label PDF reports',
      'Client name and logo support',
      'Agency report branding',
      'Priority audit queue',
      'CSV export',
      'Team-ready database architecture',
    ],
    entitlements: {
      auditsPerPeriod: 60,
      pageLimit: 50,
      competitorLimit: 5,
      historicalTracking: true,
      advancedRecommendations: true,
      whiteLabelReports: true,
      csvExport: true,
      priorityQueue: true,
      supportLevel: 'Priority',
    },
  },
};

export const SUBSCRIPTION_PRODUCTS: PricedProduct[] = [
  PRODUCTS.STARTER_MONTHLY,
  PRODUCTS.GROWTH_MONTHLY,
  PRODUCTS.AGENCY_MONTHLY,
];

export const ALL_PRODUCTS: PricedProduct[] = [PRODUCTS.ONE_TIME_AUDIT, ...SUBSCRIPTION_PRODUCTS];

const PLAN_TO_PRODUCT: Record<PlanTier, ProductKey | null> = {
  [PlanTier.FREE]: null,
  [PlanTier.STARTER]: 'STARTER_MONTHLY',
  [PlanTier.GROWTH]: 'GROWTH_MONTHLY',
  [PlanTier.AGENCY]: 'AGENCY_MONTHLY',
};

export function entitlementsForPlan(plan: PlanTier): PlanEntitlements {
  const key = PLAN_TO_PRODUCT[plan];
  return key ? PRODUCTS[key].entitlements : FREE_ENTITLEMENTS;
}

export function productForPlan(plan: PlanTier): PricedProduct | null {
  const key = PLAN_TO_PRODUCT[plan];
  return key ? PRODUCTS[key] : null;
}

export function planLabel(plan: PlanTier): string {
  switch (plan) {
    case PlanTier.STARTER:
      return 'Starter';
    case PlanTier.GROWTH:
      return 'Growth';
    case PlanTier.AGENCY:
      return 'Agency';
    default:
      return 'Free';
  }
}

export function isProductKey(value: string): value is ProductKey {
  // Object.hasOwn rather than `in`, so inherited keys such as "__proto__" or
  // "constructor" cannot be smuggled through as a product key.
  return Object.hasOwn(PRODUCTS, value);
}

/**
 * Resolve the configured Stripe price ID for a product.
 * Returns null when the environment variable has not been set yet.
 */
export function stripePriceIdFor(key: ProductKey): string | null {
  const value = process.env[PRODUCTS[key].envVar];
  return value && value.trim().length > 0 ? value.trim() : null;
}

export function productForStripePriceId(priceId: string): PricedProduct | null {
  return (
    ALL_PRODUCTS.find((p) => {
      const configured = stripePriceIdFor(p.key);
      return configured != null && configured === priceId;
    }) ?? null
  );
}

/**
 * Crawl limits used by the free anonymous preview. Deliberately one page.
 */
export const FREE_PREVIEW_PAGE_LIMIT = 1;
export const FREE_PREVIEW_MAX_FINDINGS = 5;

/**
 * Feature comparison matrix rendered on the pricing and features pages.
 */
export interface ComparisonRow {
  label: string;
  oneTime: string | boolean;
  starter: string | boolean;
  growth: string | boolean;
  agency: string | boolean;
}

export const COMPARISON_ROWS: ComparisonRow[] = [
  { label: 'Price', oneTime: '$49 once', starter: '$29/mo', growth: '$79/mo', agency: '$199/mo' },
  {
    label: 'Audits included',
    oneTime: '1 audit',
    starter: '3 / month',
    growth: '15 / month',
    agency: '60 / month',
  },
  { label: 'Pages crawled per audit', oneTime: '10', starter: '10', growth: '25', agency: '50' },
  { label: 'Competitors per audit', oneTime: '1', starter: '1', growth: '3', agency: '5' },
  {
    label: 'Overall AI Visibility Score',
    oneTime: true,
    starter: true,
    growth: true,
    agency: true,
  },
  { label: 'All seven audit categories', oneTime: true, starter: true, growth: true, agency: true },
  { label: 'Prioritized action plan', oneTime: true, starter: true, growth: true, agency: true },
  { label: 'PDF report', oneTime: true, starter: true, growth: true, agency: true },
  { label: 'Saved audit history', oneTime: true, starter: true, growth: true, agency: true },
  { label: 'Advanced recommendations', oneTime: false, starter: false, growth: true, agency: true },
  {
    label: 'Historical score tracking',
    oneTime: false,
    starter: false,
    growth: true,
    agency: true,
  },
  { label: 'CSV export', oneTime: false, starter: false, growth: true, agency: true },
  { label: 'White-label PDF reports', oneTime: false, starter: false, growth: false, agency: true },
  {
    label: 'Client name and logo branding',
    oneTime: false,
    starter: false,
    growth: false,
    agency: true,
  },
  { label: 'Priority audit queue', oneTime: false, starter: false, growth: false, agency: true },
  { label: 'Support', oneTime: 'Email', starter: 'Email', growth: 'Priority', agency: 'Priority' },
];
