'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { BlogPostStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/guards';
import { logAdminAction } from '@/lib/admin-log';
import { MAX_IMAGE_BYTES, blogImageMarkup, formatImageBytes, sniffImage } from '@/lib/blog/images';
import {
  blogPostSchema,
  formChecked,
  formValue,
  optionalFormValue,
  zodFieldErrors,
  type ActionResult,
} from '@/lib/validation';

/**
 * Blog authoring — super admin only.
 *
 * Every action calls `requireAdmin` first. That is the authorization, not the
 * fact that these are reachable from a page under `(admin)`: a server action
 * is a POST endpoint, so anyone who knows its id can invoke it directly and
 * the layout guard would never run. `requireAdmin` re-reads the user row, so a
 * demoted or suspended admin loses access immediately rather than at the next
 * token refresh.
 */

/** Revalidate every route whose content depends on a post. */
function revalidateBlog(slug?: string) {
  revalidatePath('/blog');
  revalidatePath('/admin/blog');
  revalidatePath('/sitemap.xml');
  if (slug) revalidatePath(`/blog/${slug}`);
}

function parse(formData: FormData) {
  return blogPostSchema.safeParse({
    title: formValue(formData, 'title'),
    slug: formValue(formData, 'slug'),
    excerpt: formValue(formData, 'excerpt'),
    body: formValue(formData, 'body'),
    metaTitle: optionalFormValue(formData, 'metaTitle') ?? '',
    metaDescription: optionalFormValue(formData, 'metaDescription') ?? '',
    publish: formChecked(formData, 'publish'),
  });
}

export async function createBlogPostAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = parse(formData);
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please correct the highlighted fields.',
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const { publish, metaTitle, metaDescription, ...fields } = parsed.data;
  let created;
  try {
    created = await prisma.blogPost.create({
      data: {
        ...fields,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        status: publish ? BlogPostStatus.PUBLISHED : BlogPostStatus.DRAFT,
        publishedAt: publish ? new Date() : null,
        authorId: admin.id,
      },
      select: { id: true, slug: true, title: true },
    });
  } catch (error) {
    // The slug is unique; a collision is a user error, not a crash.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return {
        ok: false,
        message: 'That slug is already in use.',
        fieldErrors: { slug: ['Another post already uses this slug.'] },
      };
    }
    throw error;
  }

  await logAdminAction({
    adminUserId: admin.id,
    action: publish ? 'blog.publish' : 'blog.create',
    summary: `${publish ? 'Published' : 'Created draft'} blog post "${created.title}"`,
    targetType: 'BlogPost',
    targetId: created.id,
  });

  revalidateBlog(created.slug);
  redirect(`/admin/blog/${created.id}?saved=1`);
}

export async function updateBlogPostAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const id = formValue(formData, 'id');
  if (!id) return { ok: false, message: 'Missing post id.' };

  const existing = await prisma.blogPost.findUnique({
    where: { id },
    select: { id: true, slug: true, status: true, publishedAt: true },
  });
  if (!existing) return { ok: false, message: 'That post no longer exists.' };

  const parsed = parse(formData);
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please correct the highlighted fields.',
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const { publish, metaTitle, metaDescription, ...fields } = parsed.data;
  try {
    await prisma.blogPost.update({
      where: { id },
      data: {
        ...fields,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        status: publish ? BlogPostStatus.PUBLISHED : BlogPostStatus.DRAFT,
        // First publish stamps the date; re-publishing an already-published
        // post keeps the original so the list does not reshuffle on an edit.
        publishedAt: publish ? (existing.publishedAt ?? new Date()) : null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return {
        ok: false,
        message: 'That slug is already in use.',
        fieldErrors: { slug: ['Another post already uses this slug.'] },
      };
    }
    throw error;
  }

  await logAdminAction({
    adminUserId: admin.id,
    action: publish ? 'blog.publish' : 'blog.update',
    summary: `Updated blog post "${fields.title}" (${publish ? 'published' : 'draft'})`,
    targetType: 'BlogPost',
    targetId: id,
  });

  // The slug may have changed; clear both the old and the new path.
  revalidateBlog(existing.slug);
  revalidateBlog(fields.slug);

  return { ok: true, message: publish ? 'Saved and published.' : 'Saved as a draft.' };
}

/**
 * Upload an image for use in a post body.
 *
 * The declared type and the filename are both author-controlled, so neither
 * decides what is stored: the bytes are sniffed, and an upload whose header is
 * not one of the four supported raster formats is refused. That is what stops a
 * stolen admin session turning an "image" upload into a stored document served
 * from our own origin — the attack SVG would walk straight through.
 *
 * Alt text is required rather than optional. A decorative-image escape hatch
 * would be used for every image, and the blog is a public page the product's
 * own audit would mark down for it.
 */
export async function uploadBlogImageAction(
  _previous: ActionResult<{ markup: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ markup: string }>> {
  const admin = await requireAdmin();

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Choose an image file to upload.' };
  }

  const altText = (optionalFormValue(formData, 'altText') ?? '').trim();
  if (altText.length < 3) {
    return {
      ok: false,
      message: 'Please describe the image.',
      fieldErrors: {
        altText: ['Alt text is required — it is what a screen reader reads out.'],
      },
    };
  }
  if (altText.length > 200) {
    return {
      ok: false,
      message: 'Please shorten the description.',
      fieldErrors: { altText: ['Keep alt text under 200 characters.'] },
    };
  }

  // Checked before the bytes are read into memory, not after.
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      message: `That file is ${formatImageBytes(file.size)}. The limit is ${formatImageBytes(
        MAX_IMAGE_BYTES,
      )}.`,
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // A streamed upload can exceed what `size` claimed, so re-check the truth.
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return { ok: false, message: 'That file is larger than the 4 MB limit.' };
  }

  const sniffed = sniffImage(bytes);
  if (!sniffed) {
    return {
      ok: false,
      message:
        'That file is not a PNG, JPEG, WebP or GIF image. SVG is not supported, because an SVG can carry script.',
    };
  }

  const created = await prisma.blogImage.create({
    data: {
      // The name is for the author's benefit in the library list, so it is
      // stored, but it never reaches a header or a path.
      filename: file.name.slice(0, 160) || 'upload',
      contentType: sniffed.contentType,
      altText,
      data: bytes,
      bytes: bytes.byteLength,
      width: sniffed.width,
      height: sniffed.height,
      uploadedById: admin.id,
    },
    select: { id: true },
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: 'blog.image_upload',
    summary: `Uploaded blog image "${altText}" (${sniffed.contentType}, ${formatImageBytes(
      bytes.byteLength,
    )})`,
    targetType: 'BlogImage',
    targetId: created.id,
  });

  revalidatePath('/admin/blog/images');

  return {
    ok: true,
    message: 'Uploaded. Paste the line below into a post body.',
    data: { markup: blogImageMarkup(created.id, altText) },
  };
}

/**
 * Bound directly to a `<form action>`, which requires a void result.
 *
 * Deleting an image a published post still references would leave a broken
 * image on a live page, so the library page shows what uses it before offering
 * this.
 */
export async function deleteBlogImageAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const id = formValue(formData, 'id');
  if (!id) redirect('/admin/blog/images');

  const existing = await prisma.blogImage.findUnique({
    where: { id },
    select: { id: true, altText: true },
  });
  if (!existing) redirect('/admin/blog/images');

  await prisma.blogImage.delete({ where: { id } });

  await logAdminAction({
    adminUserId: admin.id,
    action: 'blog.image_delete',
    summary: `Deleted blog image "${existing.altText}"`,
    targetType: 'BlogImage',
    targetId: existing.id,
  });

  revalidatePath('/admin/blog/images');
  revalidatePath('/blog');
  redirect('/admin/blog/images?deleted=1');
}

/**
 * Bound directly to a `<form action>`, which requires a void result. The
 * function either throws (redirect) or returns nothing, so there is no state
 * for the caller to render.
 */
export async function deleteBlogPostAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const id = formValue(formData, 'id');
  if (!id) redirect('/admin/blog');

  const existing = await prisma.blogPost.findUnique({
    where: { id },
    select: { id: true, slug: true, title: true },
  });
  if (!existing) redirect('/admin/blog');

  await prisma.blogPost.delete({ where: { id } });

  await logAdminAction({
    adminUserId: admin.id,
    action: 'blog.delete',
    summary: `Deleted blog post "${existing.title}"`,
    targetType: 'BlogPost',
    targetId: existing.id,
  });

  revalidateBlog(existing.slug);
  redirect('/admin/blog?deleted=1');
}
