import { E2E_BASE_URL } from '../../playwright.config';

import {
  FIXTURE_SITE,
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD,
  createAudit,
  expect,
  signIn,
  signUp,
  skipOnboarding,
  test,
  uniqueEmail,
} from './helpers';

/**
 * Journey 6 — authorization.
 *
 * Every check here is server-side. Hiding a link is not access control, so the
 * assertions go straight at the routes and APIs rather than at the navigation.
 */
test.describe('Journey 6: authorization boundaries', () => {
  test.describe.configure({ timeout: 240_000 });

  test('an ordinary user is refused the admin area and its data', async ({ page }) => {
    await signUp(page, { name: 'Ordinary User' });
    await skipOnboarding(page);

    // No admin link is offered…
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /^Admin/ })).toHaveCount(0);

    // …and typing the URL is refused by the server, not merely hidden.
    for (const path of [
      '/admin',
      '/admin/users',
      '/admin/payments',
      '/admin/settings',
      '/admin/system',
      '/admin/demo-data',
    ]) {
      const response = await page.goto(path);
      // Either a hard 403/404 or a redirect away from /admin is acceptable;
      // rendering the page is not.
      expect(page.url()).not.toContain('/admin');
      expect(response?.status()).toBeLessThan(500);
      await expect(page).toHaveURL(/\/dashboard\?denied=admin/);
      await expect(page.getByRole('heading', { name: 'Admin overview' })).toHaveCount(0);
    }
  });

  test('a user cannot read or download another user’s audit', async ({ page, browser }) => {
    // Owner creates a completed-or-queued audit.
    await signUp(page, { name: 'Audit Owner' });
    await skipOnboarding(page);
    await page.goto('/checkout/start?plan=ONE_TIME_AUDIT');
    await page.getByRole('button', { name: /Complete simulated checkout/i }).click();
    await page.waitForURL(/\/checkout\/success/, { timeout: 45_000 });
    const auditId = await createAudit(page, { websiteUrl: FIXTURE_SITE });

    // A second, unrelated account in a separate browser context.
    const otherContext = await browser.newContext({
      baseURL: E2E_BASE_URL,
      extraHTTPHeaders: { 'x-forwarded-for': '100.65.7.7' },
    });
    const otherPage = await otherContext.newPage();
    try {
      await signUp(otherPage, { email: uniqueEmail('intruder'), name: 'Intruder' });
      await skipOnboarding(otherPage);

      // The report page must not render another account's audit.
      await otherPage.goto(`/dashboard/audits/${auditId}`);
      await expect(
        otherPage.getByRole('heading', { name: /Overall AI Visibility Score/i }),
      ).toHaveCount(0);

      // The JSON status API must not leak it either.
      const status = await otherPage.request.get(`/api/audits/${auditId}/status`);
      expect([403, 404]).toContain(status.status());

      // Nor the PDF.
      const pdf = await otherPage.request.get(`/api/reports/${auditId}/pdf`);
      expect([403, 404]).toContain(pdf.status());
    } finally {
      await otherContext.close();
    }
  });

  test('signed-out visitors are redirected away from every private route', async ({ page }) => {
    for (const path of [
      '/dashboard',
      '/dashboard/audits',
      '/dashboard/audits/new',
      '/dashboard/billing',
      '/dashboard/settings',
      '/onboarding',
      '/admin',
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/signin\?callbackUrl=/);
    }
  });

  test('private APIs reject unauthenticated callers', async ({ page }) => {
    const status = await page.request.get('/api/audits/some-audit-id/status');
    expect(status.status()).toBe(401);

    const pdf = await page.request.get('/api/reports/some-audit-id/pdf');
    expect(pdf.status()).toBe(401);
  });

  test('the Stripe webhook refuses unsigned requests', async ({ page }) => {
    const response = await page.request.post('/api/webhooks/stripe', {
      data: JSON.stringify({ id: 'evt_forged', type: 'checkout.session.completed' }),
      headers: { 'content-type': 'application/json' },
    });
    // 400 when Stripe is configured and the signature is missing, 503 when
    // Stripe is not configured at all. Never 200.
    expect([400, 503]).toContain(response.status());
  });

  test('a suspended account cannot use the platform', async ({ page, browser }) => {
    const email = uniqueEmail('suspended');
    await signUp(page, { email, name: 'To Be Suspended' });
    await skipOnboarding(page);

    // An admin suspends the account in a separate session.
    const adminContext = await browser.newContext({
      baseURL: E2E_BASE_URL,
      extraHTTPHeaders: { 'x-forwarded-for': '100.65.9.9' },
    });
    const adminPage = await adminContext.newPage();
    try {
      await signIn(adminPage, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
      await adminPage.goto(`/admin/users?q=${encodeURIComponent(email)}`);
      await adminPage.getByRole('row', { name: new RegExp(email) }).getByRole('link').first().click();
      await adminPage.waitForURL(/\/admin\/users\/[^/?]+/);
      await adminPage.getByRole('button', { name: /Suspend account/i }).click();
      await expect(adminPage.getByText('Account suspended.')).toBeVisible();
    } finally {
      await adminContext.close();
    }

    // The suspended user is stopped at the door — the guard re-reads the user
    // row, so the change takes effect without waiting for a token refresh.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth-error\?error=AccountSuspended/);
    await expect(page.getByText(/suspended/i).first()).toBeVisible();
  });
});
