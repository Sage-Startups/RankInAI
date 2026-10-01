import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Alert, Badge, Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { CopyField, ImageUploadForm } from '@/app/(admin)/admin/blog/images/upload-form';
import { deleteBlogImageAction } from '@/app/(admin)/admin/blog/actions';
import { requireAdmin } from '@/lib/auth/guards';
import { blogImageUsage, listBlogImagesForAdmin } from '@/lib/blog/posts';
import { blogImageMarkup, blogImageUrl, formatImageBytes } from '@/lib/blog/images';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin — blog images',
  robots: { index: false, follow: false },
};

export default async function AdminBlogImagesPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  await requireAdmin();

  const { deleted } = await searchParams;
  const [images, usage] = await Promise.all([listBlogImagesForAdmin(), blogImageUsage()]);

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
        <h1 className="mt-3 text-2xl font-bold">Blog images</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Upload an image, then paste the line it gives you into a post body where the image should
          appear. Images are stored in the database and served from this site, so nothing depends on
          an external host staying up.
        </p>
      </div>

      {deleted ? (
        <Alert tone="success" role="status">
          Image deleted.
        </Alert>
      ) : null}

      <Card className="p-6">
        <h2 className="text-base font-semibold">Upload a new image</h2>
        <div className="mt-4">
          <ImageUploadForm />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-base font-semibold">
          Library{images.length > 0 ? ` (${images.length})` : ''}
        </h2>

        {images.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Nothing uploaded yet. The first image you upload will appear here with the line to paste
            into a post.
          </p>
        ) : (
          <ul className="mt-5 space-y-5">
            {images.map((image) => {
              const usedBy = usage[image.id] ?? [];
              return (
                <li
                  key={image.id}
                  className="grid gap-4 border-t border-[var(--border)] pt-5 first:border-t-0 first:pt-0 sm:grid-cols-[10rem_1fr]"
                >
                  <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={blogImageUrl(image.id)}
                      alt={image.altText}
                      {...(image.width && image.height
                        ? { width: image.width, height: image.height }
                        : {})}
                      className="h-28 w-full object-contain"
                    />
                  </div>

                  <div className="min-w-0 space-y-3">
                    <div>
                      <p className="text-sm font-medium">{image.altText}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                        {image.filename} · {image.contentType.replace('image/', '').toUpperCase()}
                        {image.width && image.height
                          ? ` · ${image.width}×${image.height}`
                          : ''} · {formatImageBytes(image.bytes)} · uploaded{' '}
                        {formatDate(image.createdAt)}
                        {image.uploadedBy?.name ? ` by ${image.uploadedBy.name}` : ''}
                      </p>
                    </div>

                    <CopyField
                      value={blogImageMarkup(image.id, image.altText)}
                      label={`Markup for ${image.altText}`}
                    />

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      {usedBy.length === 0 ? (
                        <Badge tone="neutral">Not used in any post</Badge>
                      ) : (
                        <p className="text-xs text-[var(--muted-foreground)]">
                          Used by{' '}
                          {usedBy.map((post, i) => (
                            <span key={post.slug}>
                              {i > 0 ? ', ' : ''}
                              <Link
                                href={`/blog/${post.slug}`}
                                className="text-[var(--accent)] underline underline-offset-4"
                              >
                                {post.title}
                              </Link>
                              {post.published ? '' : ' (draft)'}
                            </span>
                          ))}
                        </p>
                      )}

                      <form action={deleteBlogImageAction} className="ml-auto">
                        <input type="hidden" name="id" value={image.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Delete
                        </Button>
                      </form>
                    </div>

                    {usedBy.some((post) => post.published) ? (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Deleting this image would leave a broken image on a published post.
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
