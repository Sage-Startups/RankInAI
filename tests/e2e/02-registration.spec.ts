import {
  STRONG_PASSWORD,
  completeOnboarding,
  expect,
  signIn,
  signOut,
  signUp,
  test,
  uniqueEmail,
} from './helpers';

/**
 * Journey 2 — registration and authentication.
 */
test.describe('Journey 2: registration and authentication', () => {
  test('create an account, complete onboarding, sign out and sign back in', async ({ page }) => {
    // 1. Create a user.
    const email = await signUp(page, { name: 'Journey Two User' });
    await expect(page).toHaveURL(/\/onboarding/);

    // 2. Complete onboarding.
    await expect(
      page.getByRole('heading', { name: /Tell us a little about your work/i }),
    ).toBeVisible();
    await page.getByLabel(/^Company name/).fill('Journey Two Ltd');
    await page.getByLabel(/^Company website/).fill('journeytwo.example.com');
    await completeOnboarding(page);

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /Welcome back, Journey/i })).toBeVisible();

    // A brand-new account sees the empty state, not fabricated numbers.
    await expect(page.getByText('Run your first audit')).toBeVisible();
    await expect(page.getByText('No completed audits yet')).toBeVisible();

    // 3. Sign out.
    await signOut(page);
    await expect(page.getByText('You have been signed out.')).toBeVisible();

    // 4. Sign back in.
    await signIn(page, email);

    // 5. Open the dashboard.
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
  });

  test('onboarding can be skipped', async ({ page }) => {
    await signUp(page, { name: 'Skipper User' });
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.waitForURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /Welcome back, Skipper/i })).toBeVisible();
  });

  test('a duplicate email address is rejected without revealing anything else', async ({
    page,
  }) => {
    const email = uniqueEmail('duplicate');
    await signUp(page, { email });
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.waitForURL(/\/dashboard/);
    await page.goto('/signout');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL(/\/signin/);

    await page.goto('/signup');
    await page.getByLabel(/^Full name/).fill('Duplicate Attempt');
    await page.getByLabel(/^Work email/).fill(email);
    await page.getByLabel(/^Password/).fill(STRONG_PASSWORD);
    await page.getByLabel(/^Confirm password/).fill(STRONG_PASSWORD);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(
      page.getByText(/An account already exists for that email address/i).first(),
    ).toBeVisible();
  });

  test('weak passwords are rejected with specific guidance', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel(/^Full name/).fill('Weak Password User');
    await page.getByLabel(/^Work email/).fill(uniqueEmail('weak'));
    await page.getByLabel(/^Password/).fill('short');
    await page.getByLabel(/^Confirm password/).fill('short');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText(/Use at least 10 characters/i)).toBeVisible();
  });

  test('mismatched passwords are rejected', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel(/^Full name/).fill('Mismatch User');
    await page.getByLabel(/^Work email/).fill(uniqueEmail('mismatch'));
    await page.getByLabel(/^Password/).fill(STRONG_PASSWORD);
    await page.getByLabel(/^Confirm password/).fill(`${STRONG_PASSWORD}-different`);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });

  test('an invalid sign-in gives an identical message regardless of whether the account exists', async ({
    page,
  }) => {
    const existing = uniqueEmail('enumeration');
    await signUp(page, { email: existing });
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.waitForURL(/\/dashboard/);
    await page.goto('/signout');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL(/\/signin/);

    // Wrong password for a real account.
    await page.goto('/signin');
    await page.getByLabel(/^Email/).fill(existing);
    await page.getByLabel(/^Password/).fill('Definitely-Wrong-Password-1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    const realAccountMessage = await page.locator('main').getByRole('alert').first().innerText();

    // A non-existent account.
    await page.goto('/signin');
    await page.getByLabel(/^Email/).fill(uniqueEmail('missing'));
    await page.getByLabel(/^Password/).fill('Definitely-Wrong-Password-1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    const missingAccountMessage = await page.locator('main').getByRole('alert').first().innerText();

    expect(realAccountMessage).toBe(missingAccountMessage);
    expect(realAccountMessage).toContain('Invalid email or password');
  });

  test('the password reset request never reveals whether an account exists', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByLabel(/^Email/).fill(uniqueEmail('nonexistent'));
    await page.getByRole('button', { name: 'Send reset link' }).click();

    await expect(page.getByText(/If an account exists for that email address/i)).toBeVisible();
  });

  test('an unauthenticated visitor is redirected away from the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/signin\?callbackUrl=%2Fdashboard/);
  });

  test('the reset-password page rejects a missing token', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByText(/This reset link is incomplete/i)).toBeVisible();
  });
});
