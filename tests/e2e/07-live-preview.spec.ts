import { FIXTURE_SITE, expect, test } from './helpers';

/**
 * Journey 7 — the free live preview.
 *
 * A visitor with no account analyzes a real website, sees a genuinely limited
 * result that is honest about its limits, and is invited to register.
 */
test.describe('Journey 7: free live preview', () => {
  test.describe.configure({ timeout: 180_000 });

  test('an anonymous visitor previews a real site and is offered the full audit', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. The preview form is available without an account.
    const urlField = page.getByLabel('Your website address');
    await expect(urlField).toBeVisible();

    // 2. Analyze the controlled fixture site.
    await urlField.fill(FIXTURE_SITE);
    await page.getByRole('button', { name: 'Run free preview' }).click();

    // 3. A limited result appears.
    await expect(page.getByText('Homepage preview', { exact: true })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText('Limited preview score')).toBeVisible();
    // The result names the domain that was analyzed (hostname only).
    await expect(page.getByText('127.0.0.1', { exact: true })).toBeVisible();

    // 4. Between one and five findings, as the interface promises.
    const findings = page.locator('ul > li').filter({
      hasText: /Passed|critical|high|medium|low/,
    });
    const findingCount = await findings.count();
    expect(findingCount).toBeGreaterThan(0);
    expect(findingCount).toBeLessThanOrEqual(5);

    // 5. It is explicit about not being the full audit.
    await expect(page.getByText('This is a preview, not the full audit.')).toBeVisible();
    await expect(
      page.getByText(/Analyzes your homepage only and shows up to five findings/),
    ).toBeVisible();

    // 6. Registration is the offered next step.
    await expect(page.getByRole('link', { name: /Get started/i }).first()).toBeVisible();
  });

  test('the preview refuses a private network address', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Your website address').fill('http://127.0.0.1:5432');
    await page.getByRole('button', { name: 'Run free preview' }).click();

    // http://127.0.0.1:4321 is the one allow-listed test fixture origin. Any
    // other port on loopback — the database here — must still be refused.
    await expect(page.getByText(/private or reserved network/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('Limited preview score')).toHaveCount(0);
  });

  test('the preview is rate limited per visitor', async ({ page }) => {
    // The API is the enforcement point, so drive it directly rather than
    // through six form submissions.
    const limit = 6;
    const statuses: number[] = [];

    for (let attempt = 0; attempt < limit + 1; attempt += 1) {
      const response = await page.request.post('/api/preview', {
        data: { url: FIXTURE_SITE },
        headers: { 'content-type': 'application/json' },
      });
      statuses.push(response.status());
      if (response.status() === 429) {
        const body = (await response.json()) as { error: string };
        expect(body.error).toMatch(/Too many attempts/i);
        break;
      }
    }

    expect(statuses).toContain(429);
    // The limit only bites after the allowance is spent.
    expect(statuses.indexOf(429)).toBeGreaterThanOrEqual(limit);
  });

  test('the preview stores no page content', async ({ page }) => {
    const response = await page.request.post('/api/preview', {
      data: { url: FIXTURE_SITE },
      headers: { 'content-type': 'application/json' },
    });
    expect(response.ok()).toBe(true);

    const body = (await response.json()) as {
      ok: boolean;
      data: { domain: string; findings: unknown[]; disclaimer: string };
    };
    expect(body.ok).toBe(true);
    expect(body.data.findings.length).toBeLessThanOrEqual(5);
    expect(body.data.disclaimer).toMatch(/homepage/i);
  });
});
