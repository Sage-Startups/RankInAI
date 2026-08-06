/**
 * April 2026 buyer-preview dataset.
 *
 * EVERY figure here is fabricated for product demonstration. It exists so a
 * prospective buyer can see what the analytics surface looks like with data in
 * it — not to represent real trading performance.
 *
 * The exact totals are fixed by specification:
 *   - 3 demonstration sign-ups
 *   - 5 demonstration one-time Full Audit payments at $49
 *   - $245 demonstration gross revenue
 *   - $0 demonstration subscription revenue
 *   - 5 purchased audit credits
 *   - 5 completed demonstration audits
 */

export const APRIL_2026_WINDOW = {
  from: new Date('2026-04-01T00:00:00.000Z'),
  to: new Date('2026-04-30T23:59:59.999Z'),
} as const;

export const ONE_TIME_PRICE_CENTS = 4900;

export const DEMO_SNAPSHOT_TOTALS = {
  signups: 3,
  oneTimeSales: 5,
  grossRevenueCents: 5 * ONE_TIME_PRICE_CENTS, // $245.00
  subscriptionRevenueCents: 0,
  creditsPurchased: 5,
  auditsCompleted: 5,
} as const;

export interface DemoDay {
  /** ISO date, YYYY-MM-DD, inside April 2026. */
  date: string;
  signups: number;
  oneTimeSales: number;
  auditsCreated: number;
  auditsCompleted: number;
  demoRuns: number;
  previewRuns: number;
}

/**
 * Daily distribution. Sums exactly to the totals above.
 * Weekday-weighted so the charts look plausible rather than uniform.
 */
export const DEMO_DAYS: DemoDay[] = [
  {
    date: '2026-04-01',
    signups: 0,
    oneTimeSales: 0,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 4,
    previewRuns: 2,
  },
  {
    date: '2026-04-02',
    signups: 1,
    oneTimeSales: 1,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 7,
    previewRuns: 3,
  },
  {
    date: '2026-04-03',
    signups: 0,
    oneTimeSales: 0,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 5,
    previewRuns: 2,
  },
  {
    date: '2026-04-06',
    signups: 0,
    oneTimeSales: 0,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 6,
    previewRuns: 1,
  },
  {
    date: '2026-04-07',
    signups: 0,
    oneTimeSales: 1,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 8,
    previewRuns: 4,
  },
  {
    date: '2026-04-09',
    signups: 1,
    oneTimeSales: 0,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 6,
    previewRuns: 2,
  },
  {
    date: '2026-04-13',
    signups: 0,
    oneTimeSales: 1,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 9,
    previewRuns: 3,
  },
  {
    date: '2026-04-16',
    signups: 0,
    oneTimeSales: 0,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 5,
    previewRuns: 2,
  },
  {
    date: '2026-04-20',
    signups: 1,
    oneTimeSales: 1,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 7,
    previewRuns: 3,
  },
  {
    date: '2026-04-23',
    signups: 0,
    oneTimeSales: 0,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 4,
    previewRuns: 1,
  },
  {
    date: '2026-04-28',
    signups: 0,
    oneTimeSales: 1,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 6,
    previewRuns: 2,
  },
  {
    date: '2026-04-30',
    signups: 0,
    oneTimeSales: 0,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 5,
    previewRuns: 2,
  },
];

/** Fictional purchase rows shown in the buyer-preview table. */
export interface DemoPurchaseRow {
  date: string;
  customerLabel: string;
  email: string;
  product: string;
  amountCents: number;
  creditsGranted: number;
  auditDomain: string;
  auditScore: number;
}

export const DEMO_PURCHASES: DemoPurchaseRow[] = [
  {
    date: '2026-04-02',
    customerLabel: 'Demo customer 1',
    email: 'demo.customer1@example.invalid',
    product: 'One-Time Full Audit',
    amountCents: ONE_TIME_PRICE_CENTS,
    creditsGranted: 1,
    auditDomain: 'atlasroofingexteriors.example',
    auditScore: 72,
  },
  {
    date: '2026-04-07',
    customerLabel: 'Demo customer 2',
    email: 'demo.customer2@example.invalid',
    product: 'One-Time Full Audit',
    amountCents: ONE_TIME_PRICE_CENTS,
    creditsGranted: 1,
    auditDomain: 'frontrangedental.example',
    auditScore: 81,
  },
  {
    date: '2026-04-13',
    customerLabel: 'Demo customer 3',
    email: 'demo.customer3@example.invalid',
    product: 'One-Time Full Audit',
    amountCents: ONE_TIME_PRICE_CENTS,
    creditsGranted: 1,
    auditDomain: 'cascadelegalpartners.example',
    auditScore: 64,
  },
  {
    date: '2026-04-20',
    customerLabel: 'Demo customer 1',
    email: 'demo.customer1@example.invalid',
    product: 'One-Time Full Audit',
    amountCents: ONE_TIME_PRICE_CENTS,
    creditsGranted: 1,
    auditDomain: 'summitpeakroofing.example',
    auditScore: 68,
  },
  {
    date: '2026-04-28',
    customerLabel: 'Demo customer 2',
    email: 'demo.customer2@example.invalid',
    product: 'One-Time Full Audit',
    amountCents: ONE_TIME_PRICE_CENTS,
    creditsGranted: 1,
    auditDomain: 'harborviewaccounting.example',
    auditScore: 57,
  },
];

export const BUYER_PREVIEW_BANNER =
  'DEMO BUSINESS DATA — FOR PRODUCT PRESENTATION ONLY. THIS IS NOT VERIFIED REVENUE OR ACTUAL HISTORICAL PERFORMANCE.';

export const ONE_TIME_MODEL_EXPLANATION = [
  {
    heading: 'How the one-time purchase model works',
    body: 'A visitor runs the free demo or the homepage preview, sees a score for their own site, then buys a single complete audit for $49. No subscription is required, and the credit never expires. In the demonstration month above, all five purchases were one-time audits and none converted to a subscription.',
  },
  {
    heading: 'Why the one-time product exists',
    body: 'It removes the commitment objection at the point where the visitor is most motivated — immediately after seeing a problem on their own website. It also produces a customer record, a completed audit and a delivered report, which are the three things that make a later subscription upgrade plausible.',
  },
  {
    heading: 'Recurring-revenue potential',
    body: 'The same audit engine backs three monthly plans at $29, $79 and $199. Converting a single one-time buyer to the $79 Growth plan produces more revenue in one month than the original purchase, and roughly $948 over a year at that price. The demonstration month shows $0 subscription revenue because no subscription was seeded — it is deliberately not modeled as a projection.',
  },
  {
    heading: 'What is not being claimed',
    body: 'These figures are fabricated for demonstration. They are not a forecast, a track record, or a representation that any particular conversion rate has been achieved. Any real revenue figures must come from the Stripe account and the platform’s own non-demo records.',
  },
];
