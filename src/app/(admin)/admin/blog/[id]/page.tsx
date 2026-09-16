import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlogPostStatus } from '@prisma/client';
import { ArrowLeft, ExternalLink } from 'lucide-react';

import { Alert, Badge, Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { PostForm } from '@/app/(admin)/admin/blog/post-form';
import { deleteBlogPostAction } from '@/app/(admin)/admin/blog/actions';
import { requireAdmin } from '@/lib/auth/guards';
import { getPostForAdmin } from '@/lib/blog/posts';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin — edit blog post',
  robots: { index: false, follow: false },
};

export default async function EditBlogPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const { saved } = await searchParams;
  const post = await getPostForAdmin(id);
  if (!post) notFound();

  const isPublished = post.status === BlogPostStatus.PUBLISHED;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/blog"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All posts
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Edit post</h1>
            <Badge tone={isPublished ? 'success' : 'neutral'}>
              {isPublished ? 'Published' : 'Draft'}
            </Badge>
          </div>
          <Link
            href={`/blog/${post.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] underline underline-offset-4"
          >
            {isPublished ? 'View post' : 'Preview draft'}
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Created {formatDate(post.createdAt)} · last edited {formatDate(post.updatedAt)}
          {post.publishedAt ? ` · published ${formatDate(post.publishedAt)}` : ''}
        </p>
      </div>

      {saved ? (
        <Alert tone="success" role="status">
          Post created.
        </Alert>
      ) : null}

      <Card className="p-6">
        <PostForm
          initial={{
            id: post.id,
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            body: post.body,
            metaTitle: post.metaTitle ?? '',
            metaDescription: post.metaDescription ?? '',
            publish: isPublished,
          }}
        />
      </Card>

      <Card className="border-red-500/40 bg-red-500/[0.04] p-5">
        <h2 className="text-sm font-semibold">Delete this post</h2>
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          Permanently removes the post and its public URL. This cannot be undone.
        </p>
        <form action={deleteBlogPostAction} className="mt-4">
          <input type="hidden" name="id" value={post.id} />
          <Button type="submit" variant="danger">
            Delete post
          </Button>
        </form>
      </Card>
    </div>
  );
}
