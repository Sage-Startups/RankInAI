import 'server-only';

import { BlogPostStatus, type Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { extractBlogImageIds, type ImageSizes } from '@/lib/blog/images';

/**
 * Blog reads.
 *
 * The public helpers filter on `status: PUBLISHED` in the query itself rather
 * than fetching and filtering in the page, so a draft cannot reach a public
 * route by accident. Draft access has exactly one entry point,
 * `getPostForAdmin`, and every caller of it re-checks the role first.
 */

const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  publishedAt: true,
  updatedAt: true,
} satisfies Prisma.BlogPostSelect;

export type BlogListItem = Prisma.BlogPostGetPayload<{ select: typeof LIST_SELECT }>;

export async function listPublishedPosts(limit = 50): Promise<BlogListItem[]> {
  return prisma.blogPost.findMany({
    where: { status: BlogPostStatus.PUBLISHED, publishedAt: { not: null } },
    select: LIST_SELECT,
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });
}

export async function getPublishedPost(slug: string) {
  return prisma.blogPost.findFirst({
    where: { slug, status: BlogPostStatus.PUBLISHED, publishedAt: { not: null } },
    include: { author: { select: { name: true } } },
  });
}

/**
 * Any post by slug, draft included. Callers must have established that the
 * viewer is a super admin before calling this.
 */
export async function getPostBySlugForAdmin(slug: string) {
  return prisma.blogPost.findUnique({
    where: { slug },
    include: { author: { select: { name: true } } },
  });
}

export async function getPostForAdmin(id: string) {
  return prisma.blogPost.findUnique({ where: { id } });
}

export async function listAllPostsForAdmin() {
  return prisma.blogPost.findMany({
    select: { ...LIST_SELECT, status: true, isDemo: true, createdAt: true },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  });
}

/**
 * Stored dimensions for the uploads a body references, so the renderer can
 * reserve each image's space instead of reflowing the article as it loads.
 *
 * One query per post, and only for ids the body actually mentions. An image
 * whose dimensions could not be read from its header is simply absent.
 */
export async function blogImageSizes(body: string): Promise<ImageSizes> {
  const ids = extractBlogImageIds(body);
  if (ids.length === 0) return {};

  const rows = await prisma.blogImage.findMany({
    where: { id: { in: ids } },
    select: { id: true, width: true, height: true },
  });

  const sizes: ImageSizes = {};
  for (const row of rows) {
    if (row.width && row.height) sizes[row.id] = { width: row.width, height: row.height };
  }
  return sizes;
}

export async function listBlogImagesForAdmin() {
  return prisma.blogImage.findMany({
    select: {
      id: true,
      filename: true,
      contentType: true,
      altText: true,
      bytes: true,
      width: true,
      height: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export type AdminBlogImage = Awaited<ReturnType<typeof listBlogImagesForAdmin>>[number];

export interface ImageUsage {
  slug: string;
  title: string;
  published: boolean;
}

/**
 * Which posts use which image.
 *
 * Deleting an image a published post still references would leave a broken
 * image on a live page, so the library says what each one is used by before
 * offering to delete it. Built from one pass over the bodies rather than a
 * `contains` query per image.
 */
export async function blogImageUsage(): Promise<Record<string, ImageUsage[]>> {
  const posts = await prisma.blogPost.findMany({
    select: { slug: true, title: true, status: true, body: true },
  });

  const usage: Record<string, ImageUsage[]> = {};
  for (const post of posts) {
    for (const id of extractBlogImageIds(post.body)) {
      (usage[id] ??= []).push({
        slug: post.slug,
        title: post.title,
        published: post.status === BlogPostStatus.PUBLISHED,
      });
    }
  }
  return usage;
}

/** Slugs of published posts, for the sitemap. */
export async function publishedPostSlugs(): Promise<Array<{ slug: string; updatedAt: Date }>> {
  return prisma.blogPost.findMany({
    where: { status: BlogPostStatus.PUBLISHED, publishedAt: { not: null } },
    select: { slug: true, updatedAt: true },
    orderBy: { publishedAt: 'desc' },
    take: 500,
  });
}
