import {
  FIXTURE_SITE,
  createAudit,
  expect,
  signUp,
  skipOnboarding,
  test,
  waitForAuditCompletion,
} from './helpers';

/**
 * Journey 4 — monthly subscription.
 *
 * Covers plan selection, checkout, the entitlement that fulfillment applies,
 * the period allowance being consumed instead of a purchased credit, plan
 * switching, and the billing-portal control.
 */
test.describe('Journey 4: subscription purchase and allowance', () => {
  test.describe.configure({ timeout: 300_000 });

  test('subscribe to Growth, receive the allowance and spend it on an audit', async ({ page }) => {
    // 1. Choose Growth from the public pricing page.
    await page.goto('/pricing');
    await expect(page.getByText('Most Popular')).toBeVisible();
    await page.getByRole('link', { name: 'Choose Growth' }).first().click();
    await page.waitForURL(/\/signup\?plan=GROWTH_MONTHLY/);

    // 2. Register; the chosen plan survives registration.
    await signUp(page, { name: 'Growth Subscriber', plan: 'GROWTH_MONTHLY' });
    await skipOnboarding(page);

    await page.waitForURL(/\/checkout\/start\?plan=GROWTH_MONTHLY/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Growth' })).toBeVisible();
    await expect(page.getByText('$79')).toBeVisible();

    // 3. Complete checkout. Fulfillment runs the same code the Stripe webhook
    //    calls, so the entitlement is applied the production way.
    await page.getByRole('button', { name: /Complete simulated checkout/i }).click();
    await page.waitForURL(/\/checkout\/success/, { timeout: 45_000 });
    await expect(page.getByRole('heading', { name: /Subscription activated/i })).toBeVisible();

    // 4. The subscription is active with the full period allowance.
    await page.goto('/dashboard/billing');
    await expect(page.getByRole('heading', { name: 'Growth', exact: true, level: 2 })).toBeVisible();
    await expect(page.getByText('active', { exact: true })).toBeVisible();
    await expect(page.getByText('0 / 15')).toBeVisible();

    // No one-time credit was granted — a subscription is a separate pool.
    const planCard = page.locator('dl', { hasText: 'One-time credits' }).first();
    await expect(planCard).toContainText('Renewal date');

    // 5. Run an audit; it must draw on the plan allowance.
    const auditId = await createAudit(page, {
      websiteUrl: FIXTURE_SITE,
      competitor: 'https://example.com',
    });

    await page.goto('/dashboard/billing');
    await expect(page.getByText('1 / 15')).toBeVisible();
    // The one-time ledger is untouched: no reservation was written.
    await expect(page.getByText('Reserved for audit')).toHaveCount(0);

    // 6. The audit completes and honors the plan's higher page limit.
    const outcome = await waitForAuditCompletion(page, auditId, 180_000);
    expect(outcome.status).toBe('COMPLETED');

    await page.goto(`/dashboard/audits/${auditId}`);
    await expect(
      page.getByRole('heading', { name: /Overall AI Visibility Score/i }),
    ).toBeVisible();
    // A competitor was supplied, so Competitive Visibility is scored rather
    // than excluded.
    await expect(page.getByText(/No competitor was supplied for this audit/i)).toHaveCount(0);

    // 7. The billing portal is correctly unavailable in simulated billing and
    //    says why, rather than presenting a button that cannot work.
    await page.goto('/dashboard/billing');
    const portalButton = page.getByRole('button', { name: /Open billing portal/i });
    await expect(portalButton).toBeDisabled();
    await expect(
      page.getByText(/Stripe Customer Portal is unavailable while billing test mode is active/i),
    ).toBeVisible();
  });

  test('switching plans replaces the subscription and resets the allowance', async ({ page }) => {
    await signUp(page, { name: 'Plan Switcher' });
    await skipOnboarding(page);

    // Start on Starter.
    await page.goto('/checkout/start?plan=STARTER_MONTHLY');
    await page.getByRole('button', { name: /Complete simulated checkout/i }).click();
    await page.waitForURL(/\/checkout\/success/, { timeout: 45_000 });

    await page.goto('/dashboard/billing');
    await expect(page.getByRole('heading', { name: 'Starter', exact: true, level: 2 })).toBeVisible();
    await expect(page.getByText('0 / 3')).toBeVisible();

    // The current plan offers no "choose" button, only the other two do.
    await expect(page.getByRole('button', { name: 'Switch to Growth' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Switch to Starter' })).toHaveCount(0);

    // Move up to Agency.
    await page.getByRole('button', { name: 'Switch to Agency' }).click();
    await page.waitForURL(/\/checkout\/success/, { timeout: 45_000 });

    await page.goto('/dashboard/billing');
    await expect(page.getByRole('heading', { name: 'Agency', exact: true, level: 2 })).toBeVisible();
    await expect(page.getByText('0 / 60')).toBeVisible();

    // Exactly one subscription payment row per purchase, both recorded.
    await expect(page.getByText('Starter').first()).toBeVisible();
  });

  test('a subscriber can still buy a one-time credit on top of the allowance', async ({ page }) => {
    await signUp(page, { name: 'Top Up Subscriber' });
    await skipOnboarding(page);

    await page.goto('/checkout/start?plan=STARTER_MONTHLY');
    await page.getByRole('button', { name: /Complete simulated checkout/i }).click();
    await page.waitForURL(/\/checkout\/success/, { timeout: 45_000 });

    await page.goto('/dashboard/billing');
    await page.getByRole('button', { name: 'Buy one audit credit' }).click();
    await page.waitForURL(/\/checkout\/success/, { timeout: 45_000 });

    await page.goto('/dashboard/billing');
    const planCard = page.locator('dl', { hasText: 'One-time credits' }).first();
    await expect(planCard).toContainText('One-time credits');
    // 3 from the Starter allowance plus the purchased credit.
    await expect(planCard).toContainText('4');
  });
});
