import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

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
  waitForAuditCompletion,
} from './helpers';

/**
 * Accessibility.
 *
 * Serious and critical axe violations fail the build. Minor and moderate ones
 * are reported in the test output but do not block, because a number of them
 * are advisory heuristics rather than defects.
 */

const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const blocking = results.violations.filter((v) => BLOCKING_IMPACTS.has(v.impact ?? ''));
  const advisory = results.violations.filter((v) => !BLOCKING_IMPACTS.has(v.impact ?? ''));

  if (advisory.length > 0) {
    console.log(
      `[a11y] ${label}: ${advisory.length} non-blocking issue(s): ` +
        advisory.map((v) => `${v.id} (${v.impact})`).join(', '),
    );
  }

  const detail = blocking
    .map(
      (v) =>
        `${v.id} (${v.impact}) — ${v.help}\n` +
        v.nodes
          .slice(0, 3)
          .map((n) => `    ${n.target.join(' ')}\n      ${n.failureSummary ?? ''}`)
          .join('\n'),
    )
    .join('\n');

  // Compare the rule ids rather than the full result objects: axe's node data
  // is thousands of lines and would bury the diff.
  expect(
    blocking.map((v) => `${v.id} (${v.impact})`),
    `${label} has serious/critical accessibility violations:\n${detail}`,
  ).toEqual([]);
}

test.describe('Accessibility: no serious or critical violations', () => {
  test.describe.configure({ timeout: 300_000 });

  test('public pages', async ({ page }) => {
    for (const [path, label] of [
      ['/', 'home'],
      ['/pricing', 'pricing'],
      ['/signin', 'sign in'],
      ['/signup', 'sign up'],
    ] as const) {
      await page.goto(path);
      await scan(page, label);
    }
  });

  test('signed-in pages and a completed report', async ({ page }) => {
    await signUp(page, { name: 'Accessibility User' });
    await skipOnboarding(page);

    await page.goto('/dashboard');
    await scan(page, 'dashboard');

    // Buy a credit and run a real audit so the report is scanned with content
    // rather than in an empty state.
    await page.goto('/checkout/start?plan=ONE_TIME_AUDIT');
    await page.getByRole('button', { name: /Complete simulated checkout/i }).click();
    await page.waitForURL(/\/checkout\/success/, { timeout: 45_000 });

    await page.goto('/dashboard/audits/new');
    await scan(page, 'new audit form');

    const auditId = await createAudit(page, { websiteUrl: FIXTURE_SITE });
    const outcome = await waitForAuditCompletion(page, auditId, 180_000);
    expect(outcome.status).toBe('COMPLETED');

    await page.goto(`/dashboard/audits/${auditId}`);
    await expect(
      page.getByRole('heading', { name: /Overall AI Visibility Score/i }),
    ).toBeVisible();
    await scan(page, 'audit report');
  });

  test('admin dashboard', async ({ page }) => {
    await signIn(page, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Admin overview' })).toBeVisible();
    await scan(page, 'admin dashboard');
  });
});
