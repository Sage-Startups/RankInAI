import { PRODUCTS } from '@/lib/plans';

/**
 * June–July 2026 demonstration dataset: three one-time Full Audits, one
 * Starter subscription started in June, and one Growth subscription started
 * in July.
 *
 * EVERY figure here is fabricated for product demonstration. It exists so the
 * admin revenue surfaces can be shown with a small, honest mix of one-time and
 * recurring revenue in them — not to represent real trading performance.
 *
 * Prices are read from `@/lib/plans` rather than repeated, so a pricing change
 * cannot leave this dataset quoting a figure the product no longer charges.
 *
 * Every total is DERIVED from the transaction rows below, never written down
 * twice — daily revenue included. That is the whole reason the numbers on the
 * page can be trusted to agree with the table underneath them.
 */

export const SUMMER_2026_WINDOW = {
  from: new Date('2026-06-01T00:00:00.000Z'),
  to: new Date('2026-07-31T23:59:59.999Z'),
} as const;

export const ONE_TIME_PRICE_CENTS = PRODUCTS.ONE_TIME_AUDIT.priceCents;
export const STARTER_PRICE_CENTS = PRODUCTS.STARTER_MONTHLY.priceCents;
export const GROWTH_PRICE_CENTS = PRODUCTS.GROWTH_MONTHLY.priceCents;

/* -------------------------------------------------------------------------- */
/* Transactions — the source of truth for every revenue figure                */
/* -------------------------------------------------------------------------- */

export type SummerTransactionKind = 'ONE_TIME' | 'SUBSCRIPTION';

export interface SummerTransaction {
  /** ISO date, YYYY-MM-DD, inside the window above. */
  date: string;
  customerLabel: string;
  email: string;
  kind: SummerTransactionKind;
  product: string;
  /** What the charge was for, in a customer's words. */
  description: string;
  amountCents: number;
  /** Credits the charge granted. A subscription grants a period allowance. */
  creditsGranted: number;
}

export const SUMMER_TRANSACTIONS: SummerTransaction[] = [
  {
    date: '2026-06-04',
    customerLabel: 'Demo customer 1',
    email: 'demo.customer1@example.invalid',
    kind: 'ONE_TIME',
    product: PRODUCTS.ONE_TIME_AUDIT.name,
    description: 'Single complete audit',
    amountCents: ONE_TIME_PRICE_CENTS,
    creditsGranted: 1,
  },
  {
    date: '2026-06-17',
    customerLabel: 'Demo customer 2',
    email: 'demo.customer2@example.invalid',
    kind: 'SUBSCRIPTION',
    product: `${PRODUCTS.STARTER_MONTHLY.name} — monthly`,
    description: 'First month',
    amountCents: STARTER_PRICE_CENTS,
    creditsGranted: PRODUCTS.STARTER_MONTHLY.entitlements.auditsPerPeriod,
  },
  {
    date: '2026-06-25',
    customerLabel: 'Demo customer 3',
    email: 'demo.customer3@example.invalid',
    kind: 'ONE_TIME',
    product: PRODUCTS.ONE_TIME_AUDIT.name,
    description: 'Single complete audit',
    amountCents: ONE_TIME_PRICE_CENTS,
    creditsGranted: 1,
  },
  {
    date: '2026-07-08',
    customerLabel: 'Demo customer 5',
    email: 'demo.customer5@example.invalid',
    kind: 'SUBSCRIPTION',
    product: `${PRODUCTS.GROWTH_MONTHLY.name} — monthly`,
    description: 'First month',
    amountCents: GROWTH_PRICE_CENTS,
    creditsGranted: PRODUCTS.GROWTH_MONTHLY.entitlements.auditsPerPeriod,
  },
  {
    date: '2026-07-14',
    customerLabel: 'Demo customer 4',
    email: 'demo.customer4@example.invalid',
    kind: 'ONE_TIME',
    product: PRODUCTS.ONE_TIME_AUDIT.name,
    description: 'Single complete audit',
    amountCents: ONE_TIME_PRICE_CENTS,
    creditsGranted: 1,
  },
  {
    date: '2026-07-17',
    customerLabel: 'Demo customer 2',
    email: 'demo.customer2@example.invalid',
    kind: 'SUBSCRIPTION',
    product: `${PRODUCTS.STARTER_MONTHLY.name} — monthly`,
    description: 'Renewal, second month',
    amountCents: STARTER_PRICE_CENTS,
    creditsGranted: PRODUCTS.STARTER_MONTHLY.entitlements.auditsPerPeriod,
  },
];

/* -------------------------------------------------------------------------- */
/* The two subscriptions                                                      */
/* -------------------------------------------------------------------------- */

export interface SummerSubscription {
  customerLabel: string;
  email: string;
  planName: string;
  priceCents: number;
  startedOn: string;
  /** Most recent billing after the first, or null if only billed once so far. */
  renewedOn: string | null;
  nextRenewalOn: string;
  status: 'Active';
  periodsBilled: number;
  auditsIncludedPerPeriod: number;
  /** Audits used in each billed period, oldest first. */
  auditsUsedByPeriod: number[];
}

export const SUMMER_SUBSCRIPTIONS: SummerSubscription[] = [
  {
    customerLabel: 'Demo customer 2',
    email: 'demo.customer2@example.invalid',
    planName: PRODUCTS.STARTER_MONTHLY.name,
    priceCents: STARTER_PRICE_CENTS,
    startedOn: '2026-06-17',
    renewedOn: '2026-07-17',
    nextRenewalOn: '2026-08-17',
    status: 'Active',
    periodsBilled: 2,
    auditsIncludedPerPeriod: PRODUCTS.STARTER_MONTHLY.entitlements.auditsPerPeriod,
    auditsUsedByPeriod: [2, 3],
  },
  {
    customerLabel: 'Demo customer 5',
    email: 'demo.customer5@example.invalid',
    planName: PRODUCTS.GROWTH_MONTHLY.name,
    priceCents: GROWTH_PRICE_CENTS,
    startedOn: '2026-07-08',
    renewedOn: null,
    nextRenewalOn: '2026-08-08',
    status: 'Active',
    periodsBilled: 1,
    auditsIncludedPerPeriod: PRODUCTS.GROWTH_MONTHLY.entitlements.auditsPerPeriod,
    auditsUsedByPeriod: [6],
  },
];

/* -------------------------------------------------------------------------- */
/* Daily activity — signups, audit runs and funnel traffic                    */
/* -------------------------------------------------------------------------- */

export interface SummerDay {
  /** ISO date, YYYY-MM-DD, inside the window above. */
  date: string;
  signups: number;
  auditsCreated: number;
  auditsCompleted: number;
  demoRuns: number;
  previewRuns: number;
}

/**
 * Only days with something on them are listed; the charts read a series built
 * from this. Revenue is NOT stored here — it is derived per-day from
 * SUMMER_TRANSACTIONS, and a unit test asserts every charge date appears.
 */
export const SUMMER_DAYS: SummerDay[] = [
  {
    date: '2026-06-01',
    signups: 0,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 5,
    previewRuns: 2,
  },
  {
    date: '2026-06-02',
    signups: 1,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 6,
    previewRuns: 3,
  },
  {
    date: '2026-06-04',
    signups: 0,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 7,
    previewRuns: 3,
  },
  {
    date: '2026-06-08',
    signups: 0,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 5,
    previewRuns: 2,
  },
  {
    date: '2026-06-15',
    signups: 1,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 8,
    previewRuns: 4,
  },
  {
    date: '2026-06-17',
    signups: 0,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 6,
    previewRuns: 2,
  },
  {
    date: '2026-06-22',
    signups: 1,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 7,
    previewRuns: 3,
  },
  {
    date: '2026-06-25',
    signups: 0,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 9,
    previewRuns: 4,
  },
  {
    date: '2026-06-29',
    signups: 0,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 5,
    previewRuns: 2,
  },
  {
    date: '2026-07-02',
    signups: 0,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 6,
    previewRuns: 2,
  },
  {
    date: '2026-07-06',
    signups: 1,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 7,
    previewRuns: 3,
  },
  {
    date: '2026-07-08',
    signups: 0,
    auditsCreated: 2,
    auditsCompleted: 2,
    demoRuns: 8,
    previewRuns: 3,
  },
  {
    date: '2026-07-10',
    signups: 0,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 6,
    previewRuns: 2,
  },
  {
    date: '2026-07-13',
    signups: 1,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 8,
    previewRuns: 4,
  },
  {
    date: '2026-07-14',
    signups: 0,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 6,
    previewRuns: 3,
  },
  {
    date: '2026-07-16',
    signups: 0,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 5,
    previewRuns: 2,
  },
  {
    date: '2026-07-17',
    signups: 0,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 7,
    previewRuns: 2,
  },
  {
    date: '2026-07-21',
    signups: 0,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 6,
    previewRuns: 2,
  },
  {
    date: '2026-07-23',
    signups: 0,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 5,
    previewRuns: 2,
  },
  {
    date: '2026-07-27',
    signups: 0,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 6,
    previewRuns: 3,
  },
  {
    date: '2026-07-28',
    signups: 0,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 5,
    previewRuns: 2,
  },
  {
    date: '2026-07-31',
    signups: 0,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 5,
    previewRuns: 2,
  },
];

/* -------------------------------------------------------------------------- */
/* Derived figures                                                            */
/* -------------------------------------------------------------------------- */

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function transactionsOn(date: string): SummerTransaction[] {
  return SUMMER_TRANSACTIONS.filter((t) => t.date === date);
}

function revenueOf(transactions: SummerTransaction[]): number {
  return sum(transactions.map((t) => t.amountCents));
}

/* -------------------------------------------------------------------------- */
/* Simulated processing fees                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Standard US card pricing — 2.9% + 30¢ per successful charge — applied to
 * the fabricated charges above so the demonstration can show what a payment
 * processor would keep. These fees are SIMULATED: no processor was involved,
 * and real fees exist only in a real Stripe account's own reporting.
 */
export const SIMULATED_FEE_PERCENT = 2.9;
export const SIMULATED_FEE_FLAT_CENTS = 30;

export function simulatedFeeCents(amountCents: number): number {
  return Math.round((amountCents * SIMULATED_FEE_PERCENT) / 100) + SIMULATED_FEE_FLAT_CENTS;
}

function feesOf(transactions: SummerTransaction[]): number {
  return sum(transactions.map((t) => simulatedFeeCents(t.amountCents)));
}

export interface SummerMonth {
  key: '2026-06' | '2026-07';
  label: string;
  days: SummerDay[];
  signups: number;
  oneTimeSales: number;
  subscriptionInvoices: number;
  oneTimeRevenueCents: number;
  subscriptionRevenueCents: number;
  grossRevenueCents: number;
  simulatedFeeCents: number;
  netRevenueCents: number;
  auditsCompleted: number;
}

function buildMonth(key: SummerMonth['key'], label: string): SummerMonth {
  const days = SUMMER_DAYS.filter((day) => day.date.startsWith(key));
  const transactions = SUMMER_TRANSACTIONS.filter((t) => t.date.startsWith(key));
  const oneTime = transactions.filter((t) => t.kind === 'ONE_TIME');
  const recurring = transactions.filter((t) => t.kind === 'SUBSCRIPTION');

  return {
    key,
    label,
    days,
    signups: sum(days.map((day) => day.signups)),
    oneTimeSales: oneTime.length,
    subscriptionInvoices: recurring.length,
    oneTimeRevenueCents: revenueOf(oneTime),
    subscriptionRevenueCents: revenueOf(recurring),
    grossRevenueCents: revenueOf(transactions),
    simulatedFeeCents: feesOf(transactions),
    netRevenueCents: revenueOf(transactions) - feesOf(transactions),
    auditsCompleted: sum(days.map((day) => day.auditsCompleted)),
  };
}

export const SUMMER_MONTHS: SummerMonth[] = [
  buildMonth('2026-06', 'June 2026'),
  buildMonth('2026-07', 'July 2026'),
];

const ONE_TIME_TRANSACTIONS = SUMMER_TRANSACTIONS.filter((t) => t.kind === 'ONE_TIME');
const SUBSCRIPTION_TRANSACTIONS = SUMMER_TRANSACTIONS.filter((t) => t.kind === 'SUBSCRIPTION');

export const SUMMER_TOTALS = {
  signups: sum(SUMMER_DAYS.map((day) => day.signups)),
  oneTimeSales: ONE_TIME_TRANSACTIONS.length,
  subscriptionInvoices: SUBSCRIPTION_TRANSACTIONS.length,
  activeSubscriptions: SUMMER_SUBSCRIPTIONS.length,
  oneTimeRevenueCents: revenueOf(ONE_TIME_TRANSACTIONS),
  subscriptionRevenueCents: revenueOf(SUBSCRIPTION_TRANSACTIONS),
  grossRevenueCents: revenueOf(SUMMER_TRANSACTIONS),
  simulatedFeeCents: feesOf(SUMMER_TRANSACTIONS),
  netRevenueCents: revenueOf(SUMMER_TRANSACTIONS) - feesOf(SUMMER_TRANSACTIONS),
  auditsCreated: sum(SUMMER_DAYS.map((day) => day.auditsCreated)),
  auditsCompleted: sum(SUMMER_DAYS.map((day) => day.auditsCompleted)),
  demoRuns: sum(SUMMER_DAYS.map((day) => day.demoRuns)),
  previewRuns: sum(SUMMER_DAYS.map((day) => day.previewRuns)),
  /** Recurring revenue in force on the last day of the window. Not annualized. */
  recurringAtWindowEndCents: sum(SUMMER_SUBSCRIPTIONS.map((s) => s.priceCents)),
} as const;

/** The series shape the admin charts read. Revenue comes from the charges. */
export const SUMMER_SERIES = SUMMER_DAYS.map((day) => ({
  date: day.date,
  revenueCents: revenueOf(transactionsOn(day.date)),
  signups: day.signups,
  audits: day.auditsCreated,
}));

export const SUMMER_SNAPSHOT_BANNER =
  'DEMONSTRATION DATA — FOR PRODUCT PRESENTATION ONLY. THESE ARE NOT REAL SALES, REAL CUSTOMERS OR VERIFIED REVENUE.';

export const SUMMER_SNAPSHOT_NOTES = [
  {
    heading: 'What this two-month window shows',
    body: 'Three one-time Full Audits and two subscriptions: a Starter that began in June and renewed in July, and a Growth that began in July. Six charges, five customers, two of them recurring. July grosses more than June because the recurring layer compounds — the Starter billed again and the Growth arrived on top of it.',
  },
  {
    heading: 'Why the mix matters more than the total',
    body: 'One-time revenue arrives once and has to be won again. The subscriptions billed without any further selling, and each carries an audit allowance that gives the customer a reason to come back inside the product every month. A window this small proves the mechanism works end to end; it does not establish a rate.',
  },
  {
    heading: 'What is deliberately not shown',
    body: 'No annualized run rate, no projection, and no conversion percentage. Two months and two subscribers cannot support any of those, and presenting them would be misleading.',
  },
  {
    heading: 'Where real figures come from',
    body: 'Genuine performance lives in the Stripe dashboard and in this platform’s non-demo records, visible across the admin area with the demo toggle off. Any due-diligence request should be answered with Stripe exports and read-only admin access — never with this page.',
  },
];
