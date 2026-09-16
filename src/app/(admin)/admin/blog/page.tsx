import type { Metadata } from 'next';
import Link from 'next/link';
import { BlogPostStatus } from '@prisma/client';
import { ExternalLink, Plus } from 'lucide-react';

import { Badge, Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/auth/guards';
import { listAllPostsForAdmin } from '@/lib/blog/posts';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin — blog',
  robots: { index: false, follow: false },
};

export default async function AdminBlogPage() {
  await requireAdmin();
  const posts = await listAllPostsForAdmin();

  const published = posts.filter((p) => p.status === BlogPostStatus.PUBLISHED).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Blog</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {posts.length} {posts.length === 1 ? 'post' : 'posts'} · {published} published. Only a
            super admin can create, edit or delete a post.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/blog/new">
            <Plus aria-hidden="true" />
            New post
          </Link>
        </Button>
      </header>

      <Card>
        {posts.length === 0 ? (
          <div className="p-10 text-center">
            <h2 className="text-base font-semibold">No posts yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted-foreground)]">
              Write the first one. Drafts stay private until you publish them.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl border-collapse text-left text-sm">
              <caption className="sr-only">All blog posts</caption>
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Title
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Published
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Last edited
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    View
                  </th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-b border-[var(--border)] last:border-0">
                    <th scope="row" className="px-5 py-3 font-normal">
                      <Link
                        href={`/admin/blog/${post.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {post.title}
                      </Link>
                      <span className="block font-mono text-xs text-[var(--muted-foreground)]">
                        /blog/{post.slug}
                      </span>
                    </th>
                    <td className="px-5 py-3">
                      <Badge
                        tone={post.status === BlogPostStatus.PUBLISHED ? 'success' : 'neutral'}
                      >
                        {post.status === BlogPostStatus.PUBLISHED ? 'Published' : 'Draft'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-[var(--muted-foreground)]">
                      {post.publishedAt ? formatDate(post.publishedAt) : '—'}
                    </td>
                    <td className="px-5 py-3 text-[var(--muted-foreground)]">
                      {formatDate(post.updatedAt)}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="inline-flex items-center gap-1.5 text-[var(--accent)] underline underline-offset-4"
                      >
                        Open
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
