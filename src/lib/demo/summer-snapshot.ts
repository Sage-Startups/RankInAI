import { PRODUCTS } from '@/lib/plans';

/**
 * June–July 2026 demonstration dataset: three one-time Full Audits and one
 * Starter subscription.
 *
 * EVERY figure here is fabricated for product demonstration. It exists so the
 * admin revenue surfaces can be shown with a small, honest mix of one-time and
 * recurring revenue in them — not to represent real trading performance.
 *
 * Prices are read from `@/lib/plans` rather than repeated, so a pricing change
 * cannot leave this dataset quoting a figure the product no longer charges.
 *
 * The totals are DERIVED from the rows below, never written down twice. That
 * is the whole reason the numbers on the page can be trusted to agree with the
 * table underneath them.
 */

export const SUMMER_2026_WINDOW = {
  from: new Date('2026-06-01T00:00:00.000Z'),
  to: new Date('2026-07-31T23:59:59.999Z'),
} as const;

export const ONE_TIME_PRICE_CENTS = PRODUCTS.ONE_TIME_AUDIT.priceCents;
export const STARTER_PRICE_CENTS = PRODUCTS.STARTER_MONTHLY.priceCents;
export const STARTER_AUDITS_PER_PERIOD = PRODUCTS.STARTER_MONTHLY.entitlements.auditsPerPeriod;

/* -------------------------------------------------------------------------- */
/* Transactions                                                               */
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
    creditsGranted: STARTER_AUDITS_PER_PERIOD,
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
    creditsGranted: STARTER_AUDITS_PER_PERIOD,
  },
];

/* -------------------------------------------------------------------------- */
/* The single subscription                                                    */
/* -------------------------------------------------------------------------- */

export const SUMMER_SUBSCRIPTION = {
  customerLabel: 'Demo customer 2',
  email: 'demo.customer2@example.invalid',
  planName: PRODUCTS.STARTER_MONTHLY.name,
  priceCents: STARTER_PRICE_CENTS,
  startedOn: '2026-06-17',
  renewedOn: '2026-07-17',
  nextRenewalOn: '2026-08-17',
  status: 'Active',
  periodsBilled: 2,
  auditsIncludedPerPeriod: STARTER_AUDITS_PER_PERIOD,
  auditsUsedFirstPeriod: 2,
  auditsUsedSecondPeriod: 3,
} as const;

/* -------------------------------------------------------------------------- */
/* Daily activity                                                             */
/* -------------------------------------------------------------------------- */

export interface SummerDay {
  /** ISO date, YYYY-MM-DD, inside the window above. */
  date: string;
  signups: number;
  oneTimeSales: number;
  subscriptionInvoices: number;
  auditsCreated: number;
  auditsCompleted: number;
  demoRuns: number;
  previewRuns: number;
}

/**
 * Only days with something on them are listed; the charts read a continuous
 * series built from this. Every paid day corresponds to a row in
 * SUMMER_TRANSACTIONS, and a unit test holds the two in agreement.
 */
export const SUMMER_DAYS: SummerDay[] = [
  {
    date: '2026-06-01',
    signups: 0,
    oneTimeSales: 0,
    subscriptionInvoices: 0,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 5,
    previewRuns: 2,
  },
  {
    date: '2026-06-02',
    signups: 1,
    oneTimeSales: 0,
    subscriptionInvoices: 0,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 6,
    previewRuns: 3,
  },
  {
    date: '2026-06-04',
    signups: 0,
    oneTimeSales: 1,
    subscriptionInvoices: 0,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 7,
    previewRuns: 3,
  },
  {
    date: '2026-06-08',
    signups: 0,
    oneTimeSales: 0,
    subscriptionInvoices: 0,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 5,
    previewRuns: 2,
  },
  {
    date: '2026-06-15',
    signups: 1,
    oneTimeSales: 0,
    subscriptionInvoices: 0,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 8,
    previewRuns: 4,
  },
  {
    date: '2026-06-17',
    signups: 0,
    oneTimeSales: 0,
    subscriptionInvoices: 1,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 6,
    previewRuns: 2,
  },
  {
    date: '2026-06-22',
    signups: 1,
    oneTimeSales: 0,
    subscriptionInvoices: 0,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 7,
    previewRuns: 3,
  },
  {
    date: '2026-06-25',
    signups: 0,
    oneTimeSales: 1,
    subscriptionInvoices: 0,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 9,
    previewRuns: 4,
  },
  {
    date: '2026-06-29',
    signups: 0,
    oneTimeSales: 0,
    subscriptionInvoices: 0,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 5,
    previewRuns: 2,
  },
  {
    date: '2026-07-02',
    signups: 0,
    oneTimeSales: 0,
    subscriptionInvoices: 0,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 6,
    previewRuns: 2,
  },
  {
    date: '2026-07-09',
    signups: 0,
    oneTimeSales: 0,
    subscriptionInvoices: 0,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 7,
    previewRuns: 3,
  },
  {
    date: '2026-07-13',
    signups: 1,
    oneTimeSales: 0,
    subscriptionInvoices: 0,
    auditsCreated: 0,
    auditsCompleted: 0,
    demoRuns: 8,
    previewRuns: 4,
  },
  {
    date: '2026-07-14',
    signups: 0,
    oneTimeSales: 1,
    subscriptionInvoices: 0,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 6,
    previewRuns: 3,
  },
  {
    date: '2026-07-17',
    signups: 0,
    oneTimeSales: 0,
    subscriptionInvoices: 1,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 7,
    previewRuns: 2,
  },
  {
    date: '2026-07-23',
    signups: 0,
    oneTimeSales: 0,
    subscriptionInvoices: 0,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 5,
    previewRuns: 2,
  },
  {
    date: '2026-07-28',
    signups: 0,
    oneTimeSales: 0,
    subscriptionInvoices: 0,
    auditsCreated: 1,
    auditsCompleted: 1,
    demoRuns: 6,
    previewRuns: 3,
  },
  {
    date: '2026-07-31',
    signups: 0,
    oneTimeSales: 0,
    subscriptionInvoices: 0,
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

function dayRevenueCents(day: SummerDay): number {
  return day.oneTimeSales * ONE_TIME_PRICE_CENTS + day.subscriptionInvoices * STARTER_PRICE_CENTS;
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
  auditsCompleted: number;
}

function buildMonth(key: SummerMonth['key'], label: string): SummerMonth {
  const days = SUMMER_DAYS.filter((day) => day.date.startsWith(key));
  const oneTimeSales = sum(days.map((day) => day.oneTimeSales));
  const subscriptionInvoices = sum(days.map((day) => day.subscriptionInvoices));
  const oneTimeRevenueCents = oneTimeSales * ONE_TIME_PRICE_CENTS;
  const subscriptionRevenueCents = subscriptionInvoices * STARTER_PRICE_CENTS;

  return {
    key,
    label,
    days,
    signups: sum(days.map((day) => day.signups)),
    oneTimeSales,
    subscriptionInvoices,
    oneTimeRevenueCents,
    subscriptionRevenueCents,
    grossRevenueCents: oneTimeRevenueCents + subscriptionRevenueCents,
    auditsCompleted: sum(days.map((day) => day.auditsCompleted)),
  };
}

export const SUMMER_MONTHS: SummerMonth[] = [
  buildMonth('2026-06', 'June 2026'),
  buildMonth('2026-07', 'July 2026'),
];

export const SUMMER_TOTALS = {
  signups: sum(SUMMER_DAYS.map((day) => day.signups)),
  oneTimeSales: sum(SUMMER_DAYS.map((day) => day.oneTimeSales)),
  subscriptionInvoices: sum(SUMMER_DAYS.map((day) => day.subscriptionInvoices)),
  activeSubscriptions: 1,
  oneTimeRevenueCents: sum(SUMMER_DAYS.map((day) => day.oneTimeSales)) * ONE_TIME_PRICE_CENTS,
  subscriptionRevenueCents:
    sum(SUMMER_DAYS.map((day) => day.subscriptionInvoices)) * STARTER_PRICE_CENTS,
  grossRevenueCents: sum(SUMMER_DAYS.map(dayRevenueCents)),
  auditsCreated: sum(SUMMER_DAYS.map((day) => day.auditsCreated)),
  auditsCompleted: sum(SUMMER_DAYS.map((day) => day.auditsCompleted)),
  demoRuns: sum(SUMMER_DAYS.map((day) => day.demoRuns)),
  previewRuns: sum(SUMMER_DAYS.map((day) => day.previewRuns)),
  /** Recurring revenue in force on the last day of the window. Not annualized. */
  recurringAtWindowEndCents: STARTER_PRICE_CENTS,
} as const;

/** The series shape the admin charts read. */
export const SUMMER_SERIES = SUMMER_DAYS.map((day) => ({
  date: day.date,
  revenueCents: dayRevenueCents(day),
  signups: day.signups,
  audits: day.auditsCreated,
}));

export const SUMMER_SNAPSHOT_BANNER =
  'DEMONSTRATION DATA — FOR PRODUCT PRESENTATION ONLY. THESE ARE NOT REAL SALES, REAL CUSTOMERS OR VERIFIED REVENUE.';

export const SUMMER_SNAPSHOT_NOTES = [
  {
    heading: 'What this two-month window shows',
    body: 'Three one-time Full Audits and one Starter subscription, billed twice — once when it started in June and once when it renewed in July. That is the whole dataset: five charges, four customers, and one of them recurring.',
  },
  {
    heading: 'Why the mix matters more than the total',
    body: 'One-time revenue arrives once and has to be won again. The Starter subscription billed a second time without any further selling, and it carries an audit allowance that gives the customer a reason to come back inside the product each month. A window this small proves the mechanism works end to end; it does not establish a rate.',
  },
  {
    heading: 'What is deliberately not shown',
    body: 'No annualized run rate, no projection, and no conversion percentage. Two months and one subscriber cannot support any of those, and presenting them would be misleading.',
  },
  {
    heading: 'Where real figures come from',
    body: 'Genuine performance lives in the Stripe dashboard and in this platform’s non-demo records, visible across the admin area with the demo toggle off. Any due-diligence request should be answered with Stripe exports and read-only admin access — never with this page.',
  },
];
