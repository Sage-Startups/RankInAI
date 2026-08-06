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
 * Journey 3 — one-time $49 audit purchase, credit consumption and report
 * download, all the way through the worker.
 */
test.describe('Journey 3: one-time audit purchase and full audit', () => {
  test.describe.configure({ timeout: 300_000 });

  test('buy a credit, run an audit, consume the credit once and download the PDF', async ({
    page,
  }) => {
    // 1. Select the $49 audit from pricing, which carries the plan through
    //    registration.
    await page.goto('/pricing');
    await page.getByRole('link', { name: /Buy one audit/i }).first().click();
    await page.waitForURL(/\/signup\?plan=ONE_TIME_AUDIT/);
    await expect(page.getByText(/One-Time Full Audit — \$49 once/)).toBeVisible();

    // 2. Register.
    await signUp(page, { name: 'Purchase Journey', plan: 'ONE_TIME_AUDIT' });
    await skipOnboarding(page);

    // The pending plan sends the user to the checkout bridge.
    await page.waitForURL(/\/checkout\/start\?plan=ONE_TIME_AUDIT/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'One-Time Full Audit' })).toBeVisible();
    await expect(page.getByText(/Billing test mode/i).first()).toBeVisible();

    // 3. Complete the (simulated) checkout.
    await page.getByRole('button', { name: /Complete simulated checkout/i }).click();

    // 4-5. Fulfillment runs through the same path the webhook uses; the success
    //      page shows one credit added.
    await page.waitForURL(/\/checkout\/success/, { timeout: 45_000 });
    await expect(page.getByRole('heading', { name: /Audit credit added/i })).toBeVisible();
    await expect(page.getByText('One-time credits')).toBeVisible();

    // 6. Create an audit against the controlled fixture.
    const auditId = await createAudit(page, { websiteUrl: FIXTURE_SITE });

    // 7. Confirm the credit was consumed exactly once.
    await page.goto('/dashboard/billing');
    await expect(page.getByText('One-time credits', { exact: true })).toBeVisible();
    const creditsCard = page.locator('dl', { hasText: 'One-time credits' }).first();
    await expect(creditsCard).toContainText('0');

    // The ledger shows one reservation, not two.
    await expect(page.getByText('Reserved for audit')).toHaveCount(1);

    // 8. The worker processes the job.
    const outcome = await waitForAuditCompletion(page, auditId, 180_000);
    expect(outcome.status).toBe('COMPLETED');
    expect(outcome.score).not.toBeNull();

    // 9. Open the report and confirm every section is present.
    await page.goto(`/dashboard/audits/${auditId}`);
    await expect(page.getByText('Completed').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Overall AI Visibility Score/i })).toBeVisible();

    for (const heading of [
      'Executive summary',
      'Category scores',
      'Key strengths and critical weaknesses',
      'Prioritized action plan',
      'Page-by-page observations',
      'Methodology',
      'Limitations and disclaimer',
    ]) {
      await expect(page.getByRole('heading', { name: new RegExp(heading, 'i') })).toBeVisible();
    }

    // The report shows evidence, not just conclusions.
    await expect(page.getByText('Evidence observed on your website').first()).toBeVisible();

    // Competitive Visibility is correctly marked unavailable.
    await expect(page.getByText(/No competitor was supplied for this audit/i)).toBeVisible();

    // 10. Download the PDF.
    const response = await page.request.get(`/api/reports/${auditId}/pdf`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('application/pdf');

    const body = await response.body();
    expect(body.byteLength).toBeGreaterThan(20_000);
    expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(body.subarray(-2048).toString('latin1')).toContain('%%EOF');
  });

  test('a user with no credits cannot start an audit', async ({ page }) => {
    await signUp(page, { name: 'No Credits User' });
    await skipOnboarding(page);

    await page.goto('/dashboard/audits/new');
    await expect(page.getByText('No audits remaining').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start audit' })).toBeDisabled();
  });

  test('the audit form rejects a private network address', async ({ page }) => {
    await signUp(page, { name: 'SSRF Attempt User' });
    await skipOnboarding(page);

    // Give the account a credit through the simulated checkout.
    await page.goto('/checkout/start?plan=ONE_TIME_AUDIT');
    await page.getByRole('button', { name: /Complete simulated checkout/i }).click();
    await page.waitForURL(/\/checkout\/success/, { timeout: 45_000 });

    await page.goto('/dashboard/audits/new');
    await page.getByLabel(/^Website URL/).fill('http://169.254.169.254/latest/meta-data/');
    await page.getByLabel(/^Business name/).fill('Metadata Probe');
    await page.getByLabel(/I confirm I own this website/).check();
    await page.getByRole('button', { name: 'Start audit' }).click();

    await expect(
      page.getByText(/private or reserved network/i).first(),
    ).toBeVisible();

    // No audit was created and the credit was not consumed.
    await page.goto('/dashboard/audits');
    await expect(page.getByText('No audits yet')).toBeVisible();
  });
});
