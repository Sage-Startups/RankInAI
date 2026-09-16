import type { Page } from '@playwright/test';

import {
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD,
  expect,
  signIn,
  signUp,
  skipOnboarding,
  test,
  uniqueEmail,
} from './helpers';

/**
 * Journey 8 — the blog.
 *
 * The guarantee under test is not "the blog works" but "only a super admin can
 * change it". A visitor reads; an ordinary signed-in user is refused the
 * authoring routes outright; a draft is invisible to both.
 */

const stamp = Date.now();
const SLUG = `e2e-post-${stamp}`;
const DRAFT_SLUG = `e2e-draft-${stamp}`;

const BODY = [
  '## A heading the parser understands',
  '',
  'A paragraph with **bold text** and a [real link](https://example.com/geo).',
  '',
  '- first point',
  '- second point',
].join('\n');

/**
 * Fields are addressed by accessible name, not by label text: a required field
 * renders its label as "Title*", so `getByLabel('Title', { exact: true })`
 * matches nothing while the control is named "Title" to a screen reader.
 */
function field(page: Page, name: string) {
  return page.getByRole('textbox', { name, exact: true });
}

async function fillPost(
  page: Page,
  values: { title: string; slug: string; excerpt: string; body: string; publish: boolean },
) {
  await field(page, 'Title').fill(values.title);
  await field(page, 'Slug').fill(values.slug);
  await field(page, 'Excerpt').fill(values.excerpt);
  await field(page, 'Body').fill(values.body);

  const publish = page.getByRole('checkbox', { name: /Publish this post/i });
  if (values.publish !== (await publish.isChecked())) await publish.click();
}

test.describe('Journey 8: the blog', () => {
  test.describe.configure({ timeout: 240_000 });

  test('the blog is reachable from the public header and lists published posts', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Blog', exact: true })
      .first()
      .click();

    await page.waitForURL('**/blog');
    await expect(page.getByRole('heading', { name: 'Writing on AI visibility' })).toBeVisible();

    // The seeded starter articles are published, so the index is never empty.
    const firstPost = page.getByRole('link', { name: /Read /i }).first();
    await expect(firstPost).toBeVisible();
    await firstPost.click();

    await page.waitForURL(/\/blog\/[a-z0-9-]+$/);
    await expect(page.getByRole('article')).toBeVisible();
    await expect(page.getByText(/min read/)).toBeVisible();
  });

  test('a super admin writes, publishes, edits and deletes a post', async ({ page }) => {
    await signIn(page, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);

    // Create, published straight away.
    await page.goto('/admin/blog/new');
    await fillPost(page, {
      title: `E2E published post ${stamp}`,
      slug: SLUG,
      excerpt: 'An end-to-end post that exercises publishing from the admin area.',
      body: BODY,
      publish: true,
    });
    await page.getByRole('button', { name: 'Create post' }).click();
    await page.waitForURL(/\/admin\/blog\/[a-z0-9]+\?saved=1/);
    await expect(page.getByText('Post created.')).toBeVisible();
    const editUrl = page.url();

    // It is public, and the restricted markup rendered as real elements.
    await page.goto(`/blog/${SLUG}`);
    await expect(page.getByRole('heading', { name: `E2E published post ${stamp}` })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'A heading the parser understands' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'real link' })).toHaveAttribute(
      'href',
      'https://example.com/geo',
    );
    await expect(page.getByRole('listitem').filter({ hasText: 'first point' })).toBeVisible();

    // Edit, and the change is live.
    await page.goto(editUrl);
    await field(page, 'Title').fill(`E2E edited post ${stamp}`);
    await page.getByRole('button', { name: 'Save post' }).click();
    await expect(page.getByText('Saved and published.')).toBeVisible();

    await page.goto(`/blog/${SLUG}`);
    await expect(page.getByRole('heading', { name: `E2E edited post ${stamp}` })).toBeVisible();

    // Delete, and the URL stops resolving.
    await page.goto(editUrl);
    await page.getByRole('button', { name: 'Delete post' }).click();
    // The edit URL already matches /admin/blog, so waiting on that prefix
    // would resolve before the delete had run. Wait for the list's own query.
    await page.waitForURL(/\/admin\/blog\?deleted=1/);

    const gone = await page.request.get(`/blog/${SLUG}`);
    expect(gone.status()).toBe(404);
  });

  test('a draft is invisible to the public but previewable by an admin', async ({
    page,
    browser,
  }) => {
    await signIn(page, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);

    await page.goto('/admin/blog/new');
    await fillPost(page, {
      title: `E2E draft ${stamp}`,
      slug: DRAFT_SLUG,
      excerpt: 'A draft that must never be readable by an anonymous visitor.',
      body: BODY,
      publish: false,
    });
    await page.getByRole('button', { name: 'Create post' }).click();
    await page.waitForURL(/\/admin\/blog\/[a-z0-9]+\?saved=1/);

    // The admin can preview it at its real URL, clearly marked.
    await page.goto(`/blog/${DRAFT_SLUG}`);
    await expect(page.getByText('Draft — not visible to the public')).toBeVisible();

    // An anonymous visitor gets a 404 — indistinguishable from a slug that
    // was never created, so drafts cannot be enumerated.
    const anon = await browser.newContext();
    try {
      const anonPage = await anon.newPage();
      const response = await anonPage.request.get(`/blog/${DRAFT_SLUG}`);
      expect(response.status()).toBe(404);

      await anonPage.goto('/blog');
      await expect(anonPage.getByText(`E2E draft ${stamp}`)).toHaveCount(0);
    } finally {
      await anon.close();
    }
  });

  test('an ordinary user cannot reach any blog authoring route', async ({ page }) => {
    const email = uniqueEmail('blog-user');
    await signUp(page, { email, name: 'Ordinary Reader' });
    await skipOnboarding(page);

    for (const path of ['/admin/blog', '/admin/blog/new']) {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(500);
      expect(page.url()).not.toContain('/admin');
      await expect(page).toHaveURL(/\/dashboard\?denied=admin/);
      // The authoring UI is not merely hidden — it never rendered.
      await expect(page.getByRole('button', { name: 'Create post' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'New post' })).toHaveCount(0);
    }
  });

  test('signed-out visitors are redirected away from the authoring routes', async ({ page }) => {
    for (const path of ['/admin/blog', '/admin/blog/new']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/signin\?callbackUrl=/);
    }
  });
});
