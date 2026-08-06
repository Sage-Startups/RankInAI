import { test as base, expect, type Page } from '@playwright/test';

/** Shared helpers for the end-to-end journeys. */

/**
 * Every test gets its own synthetic client IP.
 *
 * The application applies per-IP rate limits (sign-up, sign-in, contact form,
 * free preview) and those are deliberately tight. Without this, a full journey
 * run would look like a single address registering a dozen accounts in a few
 * minutes and the limiter would — correctly — start refusing. Each journey
 * represents a different visitor, so each test presents a different address.
 *
 * Addresses come from the 100.64.0.0/10 shared range, which never appears in
 * real traffic to a public deployment.
 */
let ipCounter = 0;

export function nextTestClientIp(): string {
  ipCounter += 1;
  const octet3 = Math.floor(ipCounter / 250) % 250;
  const octet4 = (ipCounter % 250) + 1;
  return `100.64.${octet3}.${octet4}`;
}

export const test = base.extend<{ clientIp: string }>({
  clientIp: async ({}, use) => {
    await use(nextTestClientIp());
  },
  context: async ({ context, clientIp }, use) => {
    await context.setExtraHTTPHeaders({ 'x-forwarded-for': clientIp });
    await use(context);
  },
});

export { expect };

export const FIXTURE_SITE = 'http://127.0.0.1:4321';
export const STRONG_PASSWORD = 'E2E-Journey-Test-42';
export const SUPER_ADMIN_EMAIL = 'admin@rankinai.com';
export const SUPER_ADMIN_PASSWORD = 'RankInAI-Dev-Admin-2026!';

let counter = 0;

export function uniqueEmail(label = 'journey'): string {
  counter += 1;
  return `e2e-${label}-${Date.now()}-${counter}@rankinai-e2e.invalid`;
}

export async function signUp(
  page: Page,
  options: { email?: string; name?: string; plan?: string } = {},
): Promise<string> {
  const email = options.email ?? uniqueEmail();
  const url = options.plan ? `/signup?plan=${options.plan}` : '/signup';

  await page.goto(url);
  await page.getByLabel(/^Full name/).fill(options.name ?? 'E2E Test User');
  await page.getByLabel(/^Work email/).fill(email);
  await page.getByLabel(/^Password/).fill(STRONG_PASSWORD);
  await page.getByLabel(/^Confirm password/).fill(STRONG_PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();

  // Registration lands on onboarding.
  await page.waitForURL(/\/onboarding|\/dashboard|\/checkout/, { timeout: 45_000 });
  return email;
}

export async function completeOnboarding(page: Page) {
  if (!page.url().includes('/onboarding')) return;
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL(/\/dashboard|\/checkout/, { timeout: 30_000 });
}

export async function skipOnboarding(page: Page) {
  if (!page.url().includes('/onboarding')) return;
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.waitForURL(/\/dashboard|\/checkout/, { timeout: 30_000 });
}

export async function signIn(page: Page, email: string, password = STRONG_PASSWORD) {
  await page.goto('/signin');
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/dashboard|\/admin|\/onboarding/, { timeout: 45_000 });
}

export async function signOut(page: Page) {
  await page.goto('/signout');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(/\/signin/, { timeout: 30_000 });
}

/**
 * Wait for a queued audit to finish. The worker runs as a separate process, so
 * this polls the same status endpoint the dashboard uses.
 */
export async function waitForAuditCompletion(
  page: Page,
  auditId: string,
  timeoutMs = 120_000,
): Promise<{ status: string; score: number | null }> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await page.request.get(`/api/audits/${auditId}/status`);
    if (response.ok()) {
      const data = (await response.json()) as {
        status: string;
        finished: boolean;
        score: number | null;
      };
      if (data.finished) return { status: data.status, score: data.score };
    }
    await page.waitForTimeout(2000);
  }

  throw new Error(`Audit ${auditId} did not finish within ${timeoutMs}ms`);
}

export function auditIdFromUrl(url: string): string {
  const match = url.match(/\/dashboard\/audits\/([^/?#]+)/);
  if (!match?.[1]) throw new Error(`Could not extract an audit id from ${url}`);
  return match[1];
}

/** Fill the new-audit form and submit it. */
export async function createAudit(
  page: Page,
  options: { websiteUrl?: string; businessName?: string; competitor?: string } = {},
): Promise<string> {
  await page.goto('/dashboard/audits/new');
  await page.getByLabel(/^Website URL/).fill(options.websiteUrl ?? FIXTURE_SITE);
  await page.getByLabel(/^Business name/).fill(options.businessName ?? 'Northbridge Plumbing Co.');
  await page.getByLabel(/^Main business location/).fill('Northbridge, Massachusetts');
  await page
    .getByLabel(/^Primary services or products/)
    .fill('Drain cleaning, water heater replacement, emergency plumbing');

  if (options.competitor) {
    await page.getByPlaceholder('https://competitor.com').first().fill(options.competitor);
  }

  await page.getByLabel(/I confirm I own this website/).check();
  await page.getByRole('button', { name: 'Start audit' }).click();

  // Deliberately excludes /dashboard/audits/new so a rejected submission is a
  // failure here rather than a confusing failure several assertions later.
  try {
    await page.waitForURL(/\/dashboard\/audits\/(?!new\b)[a-z0-9-]+/i, { timeout: 60_000 });
  } catch (error) {
    const alert = page.locator('main').getByRole('alert').first();
    const detail = (await alert.count()) > 0 ? await alert.innerText() : '(no error shown)';
    throw new Error(`The audit form did not submit. Page said: ${detail.trim()}`, { cause: error });
  }
  return auditIdFromUrl(page.url());
}

export async function expectNoConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return () => expect(errors, `Page errors: ${errors.join('; ')}`).toHaveLength(0);
}
