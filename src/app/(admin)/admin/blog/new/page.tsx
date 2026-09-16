import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Card } from '@/components/ui/primitives';
import { PostForm } from '@/app/(admin)/admin/blog/post-form';
import { requireAdmin } from '@/lib/auth/guards';

export const metadata: Metadata = {
  title: 'Admin — new blog post',
  robots: { index: false, follow: false },
};

export default async function NewBlogPostPage() {
  await requireAdmin();

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
        <h1 className="mt-3 text-2xl font-bold">New blog post</h1>
      </div>

      <Card className="p-6">
        <PostForm
          initial={{
            title: '',
            slug: '',
            excerpt: '',
            body: '',
            metaTitle: '',
            metaDescription: '',
            publish: false,
          }}
        />
      </Card>
    </div>
  );
}
