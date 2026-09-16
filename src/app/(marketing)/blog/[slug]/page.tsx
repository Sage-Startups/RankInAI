import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Role } from '@prisma/client';

import { Alert } from '@/components/ui/primitives';
import { CtaBand } from '@/components/site/marketing-blocks';
import { PostBody } from '@/components/blog/post-body';
import { auth } from '@/lib/auth';
import { getPostBySlugForAdmin, getPublishedPost } from '@/lib/blog/posts';
import { readingTimeMinutes } from '@/lib/blog/content';
import { formatDate } from '@/lib/utils';

export const revalidate = 300;

/**
 * A published post is public. A draft is visible only to a signed-in super
 * admin, so the author can check a post at its real URL before publishing —
 * and to everyone else a draft slug is indistinguishable from one that does
 * not exist.
 */
async function loadPost(slug: string) {
  const published = await getPublishedPost(slug);
  if (published) return { post: published, isDraftPreview: false };

  const session = await auth();
  if (session?.user?.role !== Role.SUPER_ADMIN) return null;

  const draft = await getPostBySlugForAdmin(slug);
  return draft ? { post: draft, isDraftPreview: true } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return { title: 'Post not found', robots: { index: false, follow: false } };

  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.metaTitle || post.title,
      description: post.metaDescription || post.excerpt,
      publishedTime: post.publishedAt?.toISOString(),
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loaded = await loadPost(slug);
  if (!loaded) notFound();

  const { post, isDraftPreview } = loaded;
  const minutes = readingTimeMinutes(post.body);

  return (
    <>
      <article className="rk-container max-w-3xl py-12 lg:py-16">
        <p>
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] underline-offset-4 hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            All posts
          </Link>
        </p>

        {isDraftPreview ? (
          <div className="mt-6">
            <Alert tone="warning" title="Draft — not visible to the public">
              You are seeing this because you are signed in as an administrator. Publish it from the
              admin area to make it public.
            </Alert>
          </div>
        ) : null}

        <header className="mt-6 border-b border-[var(--border)] pb-7">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{post.title}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-[var(--muted-foreground)]">
            {post.publishedAt ? (
              <time dateTime={post.publishedAt.toISOString()}>
                {formatDate(post.publishedAt, 'long')}
              </time>
            ) : (
              <span>Unpublished</span>
            )}
            <span aria-hidden="true">·</span>
            <span>{minutes} min read</span>
            {post.author?.name ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{post.author.name}</span>
              </>
            ) : null}
          </p>
          <p className="mt-4 leading-relaxed text-[var(--muted-foreground)]">{post.excerpt}</p>
        </header>

        <div className="mt-6">
          <PostBody body={post.body} />
        </div>
      </article>

      <CtaBand
        title="See where your own site stands"
        description="Run the free demo, or audit your website against all 76 checks and get a prioritized plan."
      />
    </>
  );
}
