import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { IMAGE_CONTENT_TYPES } from '@/lib/blog/images';

export const runtime = 'nodejs';

/**
 * Serve an uploaded blog image.
 *
 * Public, because the images appear on public posts. An id is a cuid, so the
 * library cannot be enumerated, but nothing here depends on that: an image is
 * not private data, and tying visibility to the post that happens to reference
 * it would mean a published post could still hold an unreachable image.
 *
 * The stored `contentType` was read from the file's own leading bytes at upload
 * time, so it cannot be used to serve something the browser would treat as a
 * document. It is checked against the allowlist again here anyway — a row
 * written by an older or future version of the upload path does not get to
 * decide what this route sends — and `nosniff` stops the browser second-guessing
 * it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const image = await prisma.blogImage.findUnique({
    where: { id },
    select: { data: true, contentType: true, bytes: true },
  });

  if (!image || !image.data) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const allowed = (IMAGE_CONTENT_TYPES as readonly string[]).includes(image.contentType);
  if (!allowed) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const bytes = new Uint8Array(image.data);

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': image.contentType,
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': 'inline',
      // The bytes at an id never change — an edit is a new upload — so this can
      // be cached hard. It keeps a popular post from re-reading blobs out of
      // Postgres on every view.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
