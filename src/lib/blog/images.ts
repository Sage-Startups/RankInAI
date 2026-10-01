/**
 * Blog image uploads.
 *
 * Images live in Postgres and are served by a route handler, for the same
 * reason report PDFs do: the platform's filesystem is ephemeral, so anything
 * written to local disk disappears on the next deploy, and object storage would
 * mean credentials this deployment does not have.
 *
 * **The declared type of an upload is never trusted.** `file.type` is whatever
 * the browser was told, and the extension is whatever the author typed, so both
 * are attacker-controlled in the one case that matters — a stolen admin
 * session. The real type is read from the file's leading bytes and that is what
 * gets stored and later served.
 *
 * **SVG is deliberately not supported.** It is a document format: an `<svg>`
 * can carry `<script>`, and served from our own origin it would execute with
 * our origin's privileges. Every other restriction in the blog path exists to
 * stop a stolen admin session becoming stored XSS; accepting SVG would hand it
 * back. There is no flag to turn it on.
 *
 * This file has no Node-only imports, so the admin form can import the limits
 * and show them in the browser.
 */

/** 4 MB. Large enough for a full-width photograph, small enough to serve from a row. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export const IMAGE_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];

/** For the file input's `accept`, which is a convenience, never a check. */
export const IMAGE_ACCEPT = IMAGE_CONTENT_TYPES.join(',');

export interface SniffedImage {
  contentType: ImageContentType;
  /** Null when the format is valid but the header does not yield dimensions. */
  width: number | null;
  height: number | null;
}

function u16be(b: Uint8Array, at: number): number {
  return ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0);
}

function u16le(b: Uint8Array, at: number): number {
  return (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8);
}

function u24le(b: Uint8Array, at: number): number {
  return (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8) | ((b[at + 2] ?? 0) << 16);
}

function u32be(b: Uint8Array, at: number): number {
  return (
    (((b[at] ?? 0) << 24) |
      ((b[at + 1] ?? 0) << 16) |
      ((b[at + 2] ?? 0) << 8) |
      (b[at + 3] ?? 0)) >>>
    0
  );
}

function startsWith(bytes: Uint8Array, signature: number[], at = 0): boolean {
  if (bytes.length < at + signature.length) return false;
  return signature.every((byte, i) => bytes[at + i] === byte);
}

function ascii(bytes: Uint8Array, at: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(at, at + length));
}

/**
 * JPEG keeps its dimensions in a start-of-frame segment somewhere after the
 * header, so they have to be walked to. The loop is bounded by the buffer and
 * gives up rather than guessing: unknown dimensions are fine, a wrong answer
 * is not.
 */
function jpegDimensions(b: Uint8Array): { width: number; height: number } | null {
  let at = 2;
  while (at + 9 < b.length) {
    if (b[at] !== 0xff) {
      at += 1;
      continue;
    }
    const marker = b[at + 1] ?? 0;

    // Start-of-frame markers, excluding the Huffman/arithmetic/restart ones
    // that share the range.
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      const height = u16be(b, at + 5);
      const width = u16be(b, at + 7);
      return width > 0 && height > 0 ? { width, height } : null;
    }

    // Markers without a payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }

    const length = u16be(b, at + 2);
    if (length < 2) return null;
    at += 2 + length;
  }
  return null;
}

function webpDimensions(b: Uint8Array): { width: number; height: number } | null {
  const chunk = ascii(b, 12, 4);

  if (chunk === 'VP8X' && b.length >= 30) {
    // Extended format: canvas size, minus one, 24-bit little endian.
    return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  }
  if (chunk === 'VP8 ' && b.length >= 30) {
    // Lossy: a 3-byte frame tag, the sync code, then 14-bit dimensions.
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (chunk === 'VP8L' && b.length >= 25) {
    // Lossless: 14 bits of width-1 then 14 bits of height-1, packed LSB-first.
    const bits = (b[21] ?? 0) | ((b[22] ?? 0) << 8) | ((b[23] ?? 0) << 16) | ((b[24] ?? 0) << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

/**
 * Identify an upload from its bytes.
 *
 * Returns null for anything not in the allowlist — including a file whose name
 * and declared type say `image/png` while its bytes say HTML, SVG or PDF, which
 * is exactly the upload worth refusing.
 */
export function sniffImage(input: Uint8Array): SniffedImage | null {
  const b = input;

  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    // IHDR is always the first chunk, so the dimensions are at fixed offsets.
    const width = b.length >= 24 && ascii(b, 12, 4) === 'IHDR' ? u32be(b, 16) : 0;
    const height = width > 0 ? u32be(b, 20) : 0;
    return {
      contentType: 'image/png',
      width: width > 0 ? width : null,
      height: height > 0 ? height : null,
    };
  }

  if (startsWith(b, [0xff, 0xd8, 0xff])) {
    const size = jpegDimensions(b);
    return {
      contentType: 'image/jpeg',
      width: size?.width ?? null,
      height: size?.height ?? null,
    };
  }

  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const size = webpDimensions(b);
    return {
      contentType: 'image/webp',
      width: size && size.width > 0 ? size.width : null,
      height: size && size.height > 0 ? size.height : null,
    };
  }

  if (b.length >= 10 && (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a')) {
    const width = u16le(b, 6);
    const height = u16le(b, 8);
    return {
      contentType: 'image/gif',
      width: width > 0 ? width : null,
      height: height > 0 ? height : null,
    };
  }

  return null;
}

/** Where an uploaded image is served from. Also the only src the parser accepts. */
export const BLOG_IMAGE_PATH = '/api/blog/images';

export function blogImageUrl(id: string): string {
  return `${BLOG_IMAGE_PATH}/${id}`;
}

/** The line an author pastes into a post body. */
export function blogImageMarkup(id: string, altText: string): string {
  // A ']' or ')' in the alt text would end the construct early and leave the
  // rest as stray characters, so they are replaced rather than silently broken.
  const alt = altText
    .replace(/[[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `![${alt}](${blogImageUrl(id)})`;
}

/**
 * The ids of uploads referenced by a post body.
 *
 * Used to look up stored dimensions so the rendered `<img>` can reserve its
 * space — an image that arrives without width and height reflows the article
 * around it as it loads, which is the layout shift this product's own audit
 * penalizes other sites for.
 */
/** Stored dimensions by image id, for reserving space in the rendered post. */
export type ImageSizes = Record<string, { width: number; height: number }>;

export function extractBlogImageIds(body: string): string[] {
  const pattern = new RegExp(`${BLOG_IMAGE_PATH}/([A-Za-z0-9_-]{1,64})`, 'g');
  const ids = new Set<string>();
  for (const match of body.matchAll(pattern)) {
    if (match[1]) ids.add(match[1]);
  }
  return [...ids];
}

/** Human-readable size for the admin list. */
export function formatImageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
