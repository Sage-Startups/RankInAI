import { BlogPostStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GET as getBlogImage } from '@/app/api/blog/images/[id]/route';
import { blogImageMarkup } from '@/lib/blog/images';
import { blogImageSizes, blogImageUsage, listBlogImagesForAdmin } from '@/lib/blog/posts';
import { cleanupTestData, disconnect, prisma, useTestScope } from '../helpers/db';

useTestScope('blogimages');

/**
 * Serving an uploaded image, against the real database.
 *
 * The route decides what Content-Type a visitor's browser sees, so the test
 * that matters is the one where the stored type is something the browser would
 * treat as a document: the row must not be able to talk the route into serving
 * it.
 */

const SCOPE = `itest-blogimages-${process.pid}`;

/** A real 1×1 PNG, so the header the sniffer reads is genuine. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

async function createImage(overrides: Partial<{ contentType: string; altText: string }> = {}) {
  return prisma.blogImage.create({
    data: {
      filename: `${SCOPE}.png`,
      contentType: overrides.contentType ?? 'image/png',
      altText: overrides.altText ?? `${SCOPE} alt text`,
      data: new Uint8Array(PNG_1X1),
      bytes: PNG_1X1.byteLength,
      width: 1,
      height: 1,
    },
    select: { id: true },
  });
}

function request(id: string) {
  return getBlogImage(new Request(`http://localhost/api/blog/images/${id}`), {
    params: Promise.resolve({ id }),
  });
}

const createdImages: string[] = [];
const createdPosts: string[] = [];

async function cleanup() {
  await prisma.blogPost.deleteMany({ where: { slug: { startsWith: SCOPE } } });
  await prisma.blogImage.deleteMany({ where: { filename: { startsWith: SCOPE } } });
  createdImages.length = 0;
  createdPosts.length = 0;
}

beforeAll(cleanup);

afterAll(async () => {
  await cleanup();
  await cleanupTestData();
  await disconnect();
});

describe('serving an uploaded blog image', () => {
  it('returns the bytes with the stored type and immutable caching', async () => {
    const image = await createImage();
    createdImages.push(image.id);

    const response = await request(image.id);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Content-Length')).toBe(String(PNG_1X1.byteLength));
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Content-Disposition')).toBe('inline');
    // The bytes at an id never change, so a hard cache is safe and keeps a
    // popular post from re-reading the blob on every view.
    expect(response.headers.get('Cache-Control')).toContain('immutable');

    const served = new Uint8Array(await response.arrayBuffer());
    expect(Buffer.from(served).equals(PNG_1X1)).toBe(true);
  });

  it('refuses to serve a row whose type is outside the allowlist', async () => {
    // The upload path cannot write this, because it stores the sniffed type.
    // The route still checks, so a row from an older or future version of that
    // path does not get to decide what a browser is told to render.
    const image = await createImage({ contentType: 'image/svg+xml' });
    createdImages.push(image.id);

    const response = await request(image.id);
    expect(response.status).toBe(404);
  });

  it('404s for an unknown id', async () => {
    const response = await request('cmnonexistentid000000000');
    expect(response.status).toBe(404);
  });

  it('404s for an id that is not an id, without touching the database', async () => {
    for (const id of ['../../etc/passwd', 'a'.repeat(200), 'has spaces']) {
      const response = await request(id);
      expect(response.status).toBe(404);
    }
  });
});

describe('image bookkeeping', () => {
  it('reports stored dimensions only for the ids a body references', async () => {
    const [used, unused] = await Promise.all([createImage(), createImage()]);
    createdImages.push(used.id, unused.id);

    const body = `${blogImageMarkup(used.id, 'In the post')}\n\nWords.`;
    const sizes = await blogImageSizes(body);

    expect(sizes[used.id]).toEqual({ width: 1, height: 1 });
    expect(sizes[unused.id]).toBeUndefined();
  });

  it('returns nothing for a body with no images, without a query', async () => {
    expect(await blogImageSizes('## Just a heading')).toEqual({});
  });

  it('maps each image to the posts that use it, flagging published ones', async () => {
    const image = await createImage();
    createdImages.push(image.id);

    const post = await prisma.blogPost.create({
      data: {
        slug: `${SCOPE}-published`,
        title: 'A post with an image',
        excerpt: 'An excerpt long enough to be realistic for the listing page.',
        body: `${blogImageMarkup(image.id, 'A chart')}\n\nSome words about the chart.`,
        status: BlogPostStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      select: { id: true },
    });
    createdPosts.push(post.id);

    const usage = await blogImageUsage();
    expect(usage[image.id]).toEqual([
      { slug: `${SCOPE}-published`, title: 'A post with an image', published: true },
    ]);
  });

  it('lists uploads for the admin library, newest first', async () => {
    const first = await createImage({ altText: `${SCOPE} older` });
    const second = await createImage({ altText: `${SCOPE} newer` });
    createdImages.push(first.id, second.id);

    const listed = await listBlogImagesForAdmin();
    const ours = listed.filter((row) => row.altText.startsWith(SCOPE));
    expect(ours[0]?.id).toBe(second.id);
    // The list carries what the page shows, and never the bytes.
    expect(ours[0]).not.toHaveProperty('data');
    expect(ours[0]?.bytes).toBe(PNG_1X1.byteLength);
  });
});
