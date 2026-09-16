import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Card, SectionHeading } from '@/components/ui/primitives';
import { CtaBand } from '@/components/site/marketing-blocks';
import { listPublishedPosts } from '@/lib/blog/posts';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Notes on AI visibility and Generative Engine Optimization — how answer engines read a website, what they can and cannot see, and what actually changes the outcome.',
  alternates: { canonical: '/blog' },
};

/** Posts are edited in the admin area, so this page must not be cached forever. */
export const revalidate = 300;

export default async function BlogIndexPage() {
  const posts = await listPublishedPosts();

  return (
    <>
      <section className="rk-hero-wash border-b border-[var(--border)]">
        <div className="rk-container py-16 text-center lg:py-20">
          <p className="text-gold-300 text-xs font-semibold tracking-[0.18em] uppercase">Blog</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Writing on AI visibility
          </h1>
          <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-[var(--muted-foreground)]">
            How answer engines read a website, what they can and cannot see, and which changes
            actually move the outcome. No guarantees, no invented metrics.
          </p>
        </div>
      </section>

      <section className="rk-container py-14 lg:py-16">
        {posts.length === 0 ? (
          <Card className="p-10 text-center">
            <h2 className="text-lg font-semibold">No posts yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted-foreground)]">
              Nothing has been published here yet. In the meantime, the sample report shows exactly
              what an audit produces.
            </p>
            <p className="mt-5">
              <Link
                href="/sample-report"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)] underline underline-offset-4"
              >
                View the sample report
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </p>
          </Card>
        ) : (
          <>
            <SectionHeading title="Latest posts" />
            <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <li key={post.id} className="flex">
                  <Card className="flex w-full flex-col p-6">
                    <p className="text-xs tracking-wide text-[var(--muted-foreground)] uppercase">
                      <time dateTime={post.publishedAt?.toISOString()}>
                        {formatDate(post.publishedAt, 'long')}
                      </time>
                    </p>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {post.title}
                      </Link>
                    </h3>
                    <p className="mt-2.5 flex-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
                      {post.excerpt}
                    </p>
                    <p className="mt-4">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)] underline underline-offset-4"
                        aria-label={`Read ${post.title}`}
                      >
                        Read post
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <CtaBand
        title="Reading about it is not the same as measuring it"
        description="Run the free demo, or audit your website against all 76 checks and get a prioritized plan."
      />
    </>
  );
}
