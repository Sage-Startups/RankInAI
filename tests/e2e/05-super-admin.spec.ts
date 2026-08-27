import type { Page } from '@playwright/test';

import { SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, expect, signIn, test } from './helpers';

/**
 * Journey 5 — super admin.
 *
 * The central guarantee under test: seeded demonstration records are excluded
 * from every real metric unless an administrator explicitly asks for them, and
 * when they are included the interface says so in plain language.
 *
 * Assertions are written as deltas between the toggle's two states rather than
 * absolute totals. The E2E database accumulates across runs and the earlier
 * journeys create genuine (non-demo) payments, so an absolute figure would be
 * asserting the order tests happen to run in — not the behavior.
 */

/** The seeded April 2026 demonstration dataset: 5 sales of $49. */
const DEMO_SALES = 5;
const DEMO_GROSS_CENTS = 24_500;

function parseUsd(text: string): number {
  // `formatUsd` omits the cents for whole-dollar amounts, so both forms occur.
  const match = text.match(/\$([\d,]+)(?:\.(\d{2}))?/);
  if (!match) throw new Error(`No dollar amount found in ${JSON.stringify(text)}`);
  return Number(match[1].replace(/,/g, '')) * 100 + Number(match[2] ?? 0);
}

/** Read a stat card's value by its label. */
async function statValue(page: Page, label: string): Promise<string> {
  return page
    .getByText(label, { exact: true })
    .locator('xpath=../following-sibling::p[1]')
    .innerText();
}

test.describe('Journey 5: super admin', () => {
  test.describe.configure({ timeout: 240_000 });

  test('real metrics exclude demo revenue until the toggle is turned on', async ({ page }) => {
    await signIn(page, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);

    // 1. The admin area is reachable and lands on the overview.
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Admin overview' })).toBeVisible();
    await expect(
      page.getByText('Real business metrics. Demonstration data is excluded by default.'),
    ).toBeVisible();

    // 2. Off by default, and it says so.
    const toggle = page.getByRole('switch', { name: /Include demo data/i });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(
      page.getByText('Showing real records only. Seeded demonstration data is excluded.'),
    ).toBeVisible();

    const realGross = parseUsd(await statValue(page, 'Gross revenue'));
    const realOneTime = Number((await statValue(page, 'One-time audit sales')).replace(/\D/g, ''));

    // 3. Turning the toggle on surfaces the seeded figures — behind a warning.
    await toggle.click();
    await page.waitForURL(/\/admin\?demo=1/);
    await expect(page.getByRole('switch', { name: /Include demo data/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByText('Demo data is included in these figures')).toBeVisible();
    await expect(
      page.getByText(/must never be presented to a buyer as genuine financial results/i),
    ).toBeVisible();

    const withDemoGross = parseUsd(await statValue(page, 'Gross revenue'));
    const withDemoOneTime = Number(
      (await statValue(page, 'One-time audit sales')).replace(/\D/g, ''),
    );

    // 4. The difference is exactly the seeded April 2026 dataset.
    expect(withDemoGross - realGross).toBe(DEMO_GROSS_CENTS);
    expect(withDemoOneTime - realOneTime).toBe(DEMO_SALES);
  });

  test('demo payments are hidden from the payments list by default', async ({ page }) => {
    await signIn(page, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);

    await page.goto('/admin/payments');
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();

    // Seeded demonstration customers must not appear in the real ledger.
    await expect(page.getByText('demo.customer1@example.invalid')).toHaveCount(0);

    // The header summary aggregates every matching payment, while the table
    // below it shows only the most recent 60. Assert on the summary: it is
    // exact, and it cannot silently pass because a row fell off the first page.
    const summary = page.getByText(/successful payments totalling/);
    const realTotal = parseUsd(await summary.innerText());

    await page.getByRole('switch', { name: /Include demo data/i }).click();
    await page.waitForURL(/demo=1/);

    const withDemoTotal = parseUsd(
      await page.getByText(/successful payments totalling/).innerText(),
    );
    expect(withDemoTotal - realTotal).toBe(DEMO_GROSS_CENTS);
  });

  test('an admin can grant a credit with a recorded reason', async ({ page }) => {
    await signIn(page, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);

    // Find a seeded demo customer through the users list's search.
    await page.goto('/admin/users?demo=1&q=demo.customer1');
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
    await page
      .getByRole('row', { name: /demo\.customer1@example\.invalid/ })
      .getByRole('link')
      .first()
      .click();
    await page.waitForURL(/\/admin\/users\/[^/?]+/);

    await expect(page.getByRole('heading', { name: 'Adjust audit credits' })).toBeVisible();
    await page.getByLabel(/^Amount/).fill('2');
    await page
      .getByLabel(/^Reason \(recorded in the audit trail\)/)
      .fill('E2E journey: goodwill credit after a support issue');
    await page.getByRole('button', { name: 'Apply credit adjustment' }).click();

    await expect(page.getByText(/Credit balance updated\. New balance: \d+\./)).toBeVisible();

    // The action is written to the admin audit trail, naming the target.
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Recent admin activity' })).toBeVisible();
    await expect(
      page.getByText(/Granted 2 credit\(s\) for demo\.customer1@example\.invalid/).first(),
    ).toBeVisible();
  });

  test('every admin screen loads and defaults to real data', async ({ page }) => {
    await signIn(page, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);

    const screens: Array<[string, string]> = [
      ['/admin/jobs', 'Worker queue'],
      ['/admin/audits', 'Audits'],
      ['/admin/users', 'Users'],
      ['/admin/payments', 'Payments'],
      ['/admin/subscriptions', 'Subscriptions'],
      ['/admin/analytics', 'Analytics'],
      ['/admin/contacts', 'Contact submissions'],
      ['/admin/settings', 'System settings'],
      ['/admin/demo-data', 'Demonstration data'],
      ['/admin/demo-snapshot', 'Demonstration revenue snapshot'],
      ['/admin/system', 'System'],
    ];

    for (const [path, heading] of screens) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();

      const toggle = page.getByRole('switch', { name: /Include demo data/i });
      if ((await toggle.count()) > 0) {
        await expect(toggle).toHaveAttribute('aria-checked', 'false');
      }
    }
  });

  test('the buyer preview is watermarked, disclaimed and not indexable', async ({ page }) => {
    const response = await page.goto('/business-snapshot');
    expect(response?.status()).toBe(200);
    expect(response?.headers()['x-robots-tag']).toContain('noindex');

    const banner = page.getByText(
      'DEMO BUSINESS DATA — FOR PRODUCT PRESENTATION ONLY. THIS IS NOT VERIFIED REVENUE OR ACTUAL HISTORICAL PERFORMANCE.',
    );
    // Once at the top of the page and once as a footer watermark, so the
    // disclaimer survives a screenshot of any part of the page.
    await expect(banner).toHaveCount(2);
    await expect(page.getByRole('alert').getByText(/DEMO BUSINESS DATA/)).toBeVisible();

    // The April 2026 dataset, exactly as specified: $245 across 5 sales.
    await expect(page.getByText('$245').first()).toBeVisible();

    // The page is not reachable from the public navigation.
    await page.goto('/');
    await expect(page.getByRole('link', { name: /business snapshot/i })).toHaveCount(0);
  });

  test('the demo revenue snapshot shows three one-time audits and two subscriptions', async ({
    page,
  }) => {
    await signIn(page, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
    await page.goto('/admin/demo-snapshot');

    // $147 of one-time revenue and $137 of subscription revenue (Starter $29
    // billed twice + Growth $79 billed once). The figures are asserted here
    // rather than only in the unit test because the page composes them from
    // three different derived shapes — cards, month table, charge table — and
    // they have to agree on screen, not just in the module.
    await expect(page.getByText('$284', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('$147', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('$137', { exact: true }).first()).toBeVisible();

    // Simulated processing fees and the resulting net, labeled as simulated.
    await expect(page.getByText('−$10.03', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('$273.97', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText(/Fees are simulated at standard card pricing/).first(),
    ).toBeVisible();

    // Six charges: three one-time, three recurring invoices.
    await expect(page.getByRole('cell', { name: 'One-time', exact: true })).toHaveCount(3);
    await expect(page.getByRole('cell', { name: 'Recurring', exact: true })).toHaveCount(3);

    // Both subscriptions are listed by plan, and both are active.
    await expect(page.getByRole('cell', { name: /Starter/ }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: /Growth/ }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Active', exact: true })).toHaveCount(2);

    // Both months are represented.
    await expect(page.getByRole('rowheader', { name: 'June 2026' })).toBeVisible();
    await expect(page.getByRole('rowheader', { name: 'July 2026' })).toBeVisible();

    // One demonstration banner, stated once and unmissably, with no control
    // that removes it. The buyer preview repeats its disclaimer because it is
    // shown to outsiders; this page is behind the admin guard and says it once.
    const banner = page.getByText(
      'DEMONSTRATION DATA — FOR PRODUCT PRESENTATION ONLY. THESE ARE NOT REAL SALES, REAL CUSTOMERS OR VERIFIED REVENUE.',
    );
    await expect(banner).toHaveCount(1);
    await expect(page.getByRole('alert').getByText(/DEMONSTRATION DATA/)).toBeVisible();
  });
});
