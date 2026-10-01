import { describe, expect, it } from 'vitest';

import {
  IMAGE_CONTENT_TYPES,
  MAX_IMAGE_BYTES,
  blogImageMarkup,
  blogImageUrl,
  extractBlogImageIds,
  formatImageBytes,
  sniffImage,
} from '@/lib/blog/images';

/**
 * Upload sniffing.
 *
 * The declared MIME type and the filename are both author-controlled, and in
 * the case this guards against — a stolen admin session — author-controlled
 * means attacker-controlled. So the only thing that decides what is stored, and
 * later served, is the file's own leading bytes. These tests are mostly about
 * what must be REFUSED.
 */

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

function ascii(text: string): number[] {
  return [...text].map((c) => c.charCodeAt(0));
}

/** A PNG header with IHDR dimensions, which is all the sniffer reads. */
function png(width: number, height: number): Uint8Array {
  const out = new Uint8Array(33);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  out.set(ascii('IHDR'), 12);
  new DataView(out.buffer).setUint32(16, width);
  new DataView(out.buffer).setUint32(20, height);
  return out;
}

function jpeg(width: number, height: number): Uint8Array {
  // SOI, an APP0 segment to be skipped, then SOF0 carrying the dimensions.
  const out = new Uint8Array(32);
  const view = new DataView(out.buffer);
  out.set([0xff, 0xd8], 0);
  out.set([0xff, 0xe0], 2);
  view.setUint16(4, 6); // APP0 length, including these two bytes
  out.set([0xff, 0xc0], 10);
  view.setUint16(12, 11); // SOF0 length
  out[14] = 8; // precision
  view.setUint16(15, height);
  view.setUint16(17, width);
  return out;
}

function gif(width: number, height: number): Uint8Array {
  const out = new Uint8Array(16);
  out.set(ascii('GIF89a'), 0);
  const view = new DataView(out.buffer);
  view.setUint16(6, width, true);
  view.setUint16(8, height, true);
  return out;
}

function webpVp8x(width: number, height: number): Uint8Array {
  const out = new Uint8Array(32);
  out.set(ascii('RIFF'), 0);
  out.set(ascii('WEBP'), 8);
  out.set(ascii('VP8X'), 12);
  const put24 = (at: number, value: number) => {
    out[at] = value & 0xff;
    out[at + 1] = (value >> 8) & 0xff;
    out[at + 2] = (value >> 16) & 0xff;
  };
  put24(24, width - 1);
  put24(27, height - 1);
  return out;
}

describe('sniffImage', () => {
  it('reads a PNG and its dimensions', () => {
    expect(sniffImage(png(1200, 630))).toEqual({
      contentType: 'image/png',
      width: 1200,
      height: 630,
    });
  });

  it('reads a JPEG, walking past the segments before the frame header', () => {
    expect(sniffImage(jpeg(800, 600))).toEqual({
      contentType: 'image/jpeg',
      width: 800,
      height: 600,
    });
  });

  it('reads a GIF, whose dimensions are little endian', () => {
    expect(sniffImage(gif(320, 240))).toEqual({
      contentType: 'image/gif',
      width: 320,
      height: 240,
    });
  });

  it('reads an extended WebP, whose canvas size is stored minus one', () => {
    expect(sniffImage(webpVp8x(1024, 768))).toEqual({
      contentType: 'image/webp',
      width: 1024,
      height: 768,
    });
  });

  it('refuses SVG — it is a script carrier, not a raster image', () => {
    expect(sniffImage(bytes(...ascii('<svg xmlns="http://www.w3.org/2000/svg"><script/>')))).toBe(
      null,
    );
    expect(sniffImage(bytes(...ascii('<?xml version="1.0"?><svg></svg>')))).toBe(null);
  });

  it('refuses HTML dressed as an image', () => {
    expect(sniffImage(bytes(...ascii('<!DOCTYPE html><html><script>alert(1)</script>')))).toBe(
      null,
    );
  });

  it('refuses other real formats that are not in the allowlist', () => {
    expect(sniffImage(bytes(...ascii('%PDF-1.7')))).toBe(null);
    // A ZIP/Office container.
    expect(sniffImage(bytes(0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0))).toBe(null);
    // An ELF binary.
    expect(sniffImage(bytes(0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0))).toBe(null);
    // A BMP, which is a real image but not one we serve.
    expect(sniffImage(bytes(0x42, 0x4d, 0, 0, 0, 0, 0, 0, 0, 0))).toBe(null);
  });

  it('refuses a RIFF container that is not WebP, such as a WAV', () => {
    const wav = new Uint8Array(16);
    wav.set(ascii('RIFF'), 0);
    wav.set(ascii('WAVE'), 8);
    expect(sniffImage(wav)).toBe(null);
  });

  it('refuses an empty or truncated file instead of throwing', () => {
    expect(sniffImage(new Uint8Array(0))).toBe(null);
    expect(sniffImage(bytes(0x89, 0x50))).toBe(null);
    expect(sniffImage(bytes(...ascii('GIF8')))).toBe(null);
  });

  it('accepts a valid header whose dimensions cannot be read, reporting them as unknown', () => {
    // A PNG signature with no IHDR chunk: still a PNG, size unknown. Unknown is
    // honest; a guessed size would render the article at the wrong shape.
    const headerOnly = new Uint8Array(12);
    headerOnly.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    expect(sniffImage(headerOnly)).toEqual({
      contentType: 'image/png',
      width: null,
      height: null,
    });
  });

  it('never reports a type outside the allowlist', () => {
    const samples = [png(2, 2), jpeg(2, 2), gif(2, 2), webpVp8x(2, 2)];
    for (const sample of samples) {
      const result = sniffImage(sample);
      expect(result).not.toBeNull();
      expect(IMAGE_CONTENT_TYPES).toContain(result?.contentType);
    }
  });
});

describe('markup helpers', () => {
  it('builds a URL and a body line for an id', () => {
    expect(blogImageUrl('abc123')).toBe('/api/blog/images/abc123');
    expect(blogImageMarkup('abc123', 'A dashboard screenshot')).toBe(
      '![A dashboard screenshot](/api/blog/images/abc123)',
    );
  });

  it('strips brackets from alt text, which would end the construct early', () => {
    expect(blogImageMarkup('abc123', 'Scores [before] and (after)')).toBe(
      '![Scores before and after](/api/blog/images/abc123)',
    );
  });

  it('collapses newlines in alt text so the line stays one line', () => {
    expect(blogImageMarkup('abc123', 'Two\nlines')).toBe('![Two lines](/api/blog/images/abc123)');
  });

  it('finds the image ids a body references, without duplicates', () => {
    const body = [
      '![One](/api/blog/images/aaa)',
      'Text mentioning /api/blog/images/bbb inline.',
      '![One again](/api/blog/images/aaa)',
      '![Remote](https://example.com/photo.png)',
    ].join('\n');

    expect(extractBlogImageIds(body)).toEqual(['aaa', 'bbb']);
  });

  it('finds nothing in a body with no images', () => {
    expect(extractBlogImageIds('## Heading\n\nJust words.')).toEqual([]);
  });
});

describe('limits', () => {
  it('caps uploads at 4 MB', () => {
    expect(MAX_IMAGE_BYTES).toBe(4 * 1024 * 1024);
  });

  it('formats sizes the way an author reads them', () => {
    expect(formatImageBytes(512)).toBe('512 B');
    expect(formatImageBytes(2048)).toBe('2 KB');
    expect(formatImageBytes(MAX_IMAGE_BYTES)).toBe('4.0 MB');
  });
});
