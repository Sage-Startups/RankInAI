import 'server-only';

import { BlogPostStatus, type Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';

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

/** Slugs of published posts, for the sitemap. */
export async function publishedPostSlugs(): Promise<Array<{ slug: string; updatedAt: Date }>> {
  return prisma.blogPost.findMany({
    where: { status: BlogPostStatus.PUBLISHED, publishedAt: { not: null } },
    select: { slug: true, updatedAt: true },
    orderBy: { publishedAt: 'desc' },
    take: 500,
  });
}
