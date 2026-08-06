import { expect, test } from './helpers';

/**
 * Journey 1 — landing-page demo.
 *
 * A visitor must be able to see a complete audit report within seconds, with no
 * account, and every fabricated figure must be labeled as demo data.
 */
test.describe('Journey 1: landing-page demo', () => {
  test('a visitor runs the demo and reaches the full sample report', async ({ page }) => {
    // 1. Visit the home page.
    await page.goto('/');
    await expect(page).toHaveTitle(/RankInAI/);
    await expect(
      page.getByRole('heading', { name: /Find out whether AI can/i }),
    ).toBeVisible();

    // The primary and secondary CTAs are both present.
    await expect(page.getByRole('link', { name: 'Run the Free Demo' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View Sample Report' })).toBeVisible();

    // 2. Start the demo.
    const demoPanel = page.locator('#demo');
    await expect(demoPanel.getByText('Demo data').first()).toBeVisible();
    await demoPanel.getByRole('button', { name: /Run the free demo/i }).click();

    // The animated sequence shows its steps.
    await expect(demoPanel.getByText('Checking crawl access')).toBeVisible();

    // 3. Wait for the mini report (~5 seconds of animation).
    await expect(demoPanel.getByText(/scores 72 out of 100/i)).toBeVisible({ timeout: 20_000 });

    // 5. Demo labels are visible on the result.
    await expect(demoPanel.getByText('Demo data').first()).toBeVisible();
    await expect(
      demoPanel.getByText(/fictional demonstration data/i),
    ).toBeVisible();

    // The mini report contains the required sections.
    await expect(demoPanel.getByText('Three strengths')).toBeVisible();
    await expect(demoPanel.getByText('Three high-priority problems')).toBeVisible();
    await expect(demoPanel.getByText('Recommended next action')).toBeVisible();
    await expect(demoPanel.getByText('Competitor comparison')).toBeVisible();

    // Both CTAs from the finished demo are present.
    await expect(
      demoPanel.getByRole('link', { name: /Run an audit on your website/i }),
    ).toBeVisible();

    // 4. Open the full sample report.
    await demoPanel.getByRole('link', { name: /View the full demo report/i }).click();
    await page.waitForURL(/\/sample-report/);

    // 5. The full report is clearly marked as demonstration data.
    await expect(
      page.getByRole('heading', { name: /A complete audit report, start to finish/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/Interactive sample using fictional demonstration data/i).first(),
    ).toBeVisible();
    await expect(page.getByText('Atlas Roofing & Exteriors').first()).toBeVisible();

    // Every report section is rendered.
    for (const heading of [
      'Executive summary',
      'Category scores',
      'Key strengths and critical weaknesses',
      'Competitor comparison',
      'Prioritized action plan',
      'Page-by-page observations',
      'Methodology',
      'Limitations and disclaimer',
    ]) {
      await expect(page.getByRole('heading', { name: new RegExp(heading, 'i') })).toBeVisible();
    }

    // The report never claims a guaranteed AI mention.
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).not.toContain('guaranteed ranking');
    expect(body).toContain('no tool can guarantee');
  });

  test('the pricing CTA works and lists US dollar prices', async ({ page }) => {
    await page.goto('/');

    // 6. Confirm the pricing CTA works.
    await page.getByRole('link', { name: 'Pricing', exact: true }).first().click();
    await page.waitForURL(/\/pricing/);

    await expect(page.getByRole('heading', { name: /Straightforward pricing/i })).toBeVisible();

    for (const price of ['$49', '$29', '$79', '$199']) {
      await expect(page.getByText(price, { exact: false }).first()).toBeVisible();
    }

    await expect(page.getByText('Most Popular')).toBeVisible();

    // Selecting a plan sends the visitor to sign-up with the plan preserved.
    await page.getByRole('link', { name: /Choose Growth/i }).first().click();
    await page.waitForURL(/\/signup\?plan=GROWTH_MONTHLY/);
    await expect(page.getByText(/Growth — \$79\/month/)).toBeVisible();
  });

  test('sample testimonials are labeled as samples', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/These are sample testimonials/i)).toBeVisible();
    await expect(page.getByText('Sample', { exact: true }).first()).toBeVisible();
  });

  test('the demo can be replayed', async ({ page }) => {
    await page.goto('/demo');
    const panel = page.locator('main').getByText('Atlas Roofing & Exteriors').first();
    await expect(panel).toBeVisible();

    await page.getByRole('button', { name: /Run the free demo/i }).click();
    await expect(page.getByText(/scores 72 out of 100/i)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /Replay the demo/i }).click();
    await expect(page.getByText('Checking crawl access')).toBeVisible();
  });
});
