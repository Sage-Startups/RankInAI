import { describe, expect, it } from 'vitest';

import {
  blogBodyToPlainText,
  parseBlogBody,
  parseInline,
  readingTimeMinutes,
  slugify,
} from '@/lib/blog/content';

/**
 * A post body is authored by a super admin and rendered on a public page, so
 * the parser is a security boundary as much as a formatting one: whatever it
 * emits becomes React elements, and anything it refuses to turn into a link or
 * a tag can never become one.
 */
describe('blog body parsing', () => {
  it('reads headings, paragraphs, quotes and both list kinds', () => {
    const blocks = parseBlogBody(
      [
        '## Heading two',
        '',
        'A paragraph.',
        '',
        '> A quote',
        '',
        '- one',
        '- two',
        '',
        '1. first',
        '2. second',
      ].join('\n'),
    );

    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'quote', 'list', 'list']);
    const [heading, , , unordered, ordered] = blocks;
    expect(heading).toMatchObject({ type: 'heading', level: 2 });
    expect(unordered).toMatchObject({ type: 'list', ordered: false });
    expect(ordered).toMatchObject({ type: 'list', ordered: true });
    if (unordered.type === 'list') expect(unordered.items).toHaveLength(2);
  });

  it('joins consecutive lines into one paragraph and splits on a blank line', () => {
    const blocks = parseBlogBody('one\ntwo\n\nthree');
    expect(blocks).toHaveLength(2);
    expect(blogBodyToPlainText('one\ntwo\n\nthree')).toBe('one two three');
  });

  it('distinguishes h2 from h3', () => {
    expect(parseBlogBody('### Small')[0]).toMatchObject({ type: 'heading', level: 3 });
  });

  it('reads bold, code and links inline', () => {
    const nodes = parseInline('a **bold** and `code` and [text](https://example.com/x)');
    expect(nodes.filter((n) => n.type === 'bold')).toHaveLength(1);
    expect(nodes.filter((n) => n.type === 'code')).toHaveLength(1);
    const link = nodes.find((n) => n.type === 'link');
    expect(link).toMatchObject({ type: 'link', value: 'text', href: 'https://example.com/x' });
  });

  it('refuses a javascript: link, keeping the text and dropping the URL', () => {
    const nodes = parseInline('[click me](javascript:alert(1))');
    expect(nodes.some((n) => n.type === 'link')).toBe(false);
    expect(nodes.map((n) => n.value).join('')).toContain('click me');
  });

  it('refuses data: and other non-http schemes', () => {
    for (const href of ['data:text/html;base64,PHNjcmlwdD4=', 'file:///etc/passwd', 'vbscript:x']) {
      const nodes = parseInline(`[x](${href})`);
      expect(nodes.some((n) => n.type === 'link')).toBe(false);
    }
  });

  it('never produces a node that carries raw markup as anything but text', () => {
    const nodes = parseInline('<script>alert(1)</script> and <img onerror=x>');
    // Angle brackets survive as literal text; the renderer escapes them by
    // virtue of building elements rather than setting innerHTML.
    expect(nodes.every((n) => n.type === 'text')).toBe(true);
    expect(nodes.map((n) => n.value).join('')).toContain('<script>');
  });

  it('ignores an unterminated emphasis marker rather than mangling the line', () => {
    const nodes = parseInline('a ** dangling and `unclosed');
    expect(nodes.every((n) => n.type === 'text')).toBe(true);
  });

  it('estimates reading time from words, never below one minute', () => {
    expect(readingTimeMinutes('a few words only')).toBe(1);
    expect(readingTimeMinutes(Array(600).fill('word').join(' '))).toBe(3);
  });

  it('is stable — the same body always parses identically', () => {
    const body = '## H\n\nText with [a link](https://example.com).\n\n- item';
    expect(parseBlogBody(body)).toEqual(parseBlogBody(body));
  });
});

/**
 * Images.
 *
 * The src allowlist is the security boundary here. The renderer puts whatever
 * survives into an `<img src>`, so anything that is not an upload of ours or a
 * plain https URL has to be discarded by the parser — the renderer never gets
 * the chance to decide.
 */
describe('image blocks', () => {
  it('parses an uploaded image into a block of its own', () => {
    expect(parseBlogBody('![A score ring](/api/blog/images/abc123)')).toEqual([
      { type: 'image', src: '/api/blog/images/abc123', alt: 'A score ring' },
    ]);
  });

  it('accepts an absolute https image', () => {
    const blocks = parseBlogBody('![Remote](https://example.com/a.png)');
    expect(blocks).toEqual([{ type: 'image', src: 'https://example.com/a.png', alt: 'Remote' }]);
  });

  it('never produces an image or a link from a javascript: or data: src', () => {
    for (const src of [
      'javascript:alert(1)',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      'vbscript:msgbox(1)',
      'JavaScript:alert(1)',
    ]) {
      const blocks = parseBlogBody(`![Looks fine](${src})`);

      // The shape of the fallback varies with how the line tokenizes — what
      // must hold is that no element carrying that URL is ever emitted.
      expect(blocks.some((b) => b.type === 'image')).toBe(false);
      for (const block of blocks) {
        if (block.type === 'image' || block.type === 'list') continue;
        expect(block.content.some((node) => node.type === 'link')).toBe(false);
      }
      expect(JSON.stringify(blocks)).toContain('Looks fine');
    }
  });

  it('discards a plain http src, which a browser on https would block anyway', () => {
    expect(parseBlogBody('![Insecure](http://example.com/a.png)')).toEqual([
      { type: 'paragraph', content: [{ type: 'text', value: 'Insecure' }] },
    ]);
  });

  it('refuses a path that only looks like an upload', () => {
    for (const src of [
      '/api/blog/images/../../../etc/passwd',
      '/api/blog/images/abc/../..',
      '/api/blog/imageslookalike/abc',
      '//evil.example.com/a.png',
    ]) {
      const blocks = parseBlogBody(`![Nope](${src})`);
      expect(blocks.some((b) => b.type === 'image')).toBe(false);
    }
  });

  it('keeps an image out of the surrounding paragraph', () => {
    const blocks = parseBlogBody(
      ['Before the image.', '![Shot](/api/blog/images/abc123)', 'After the image.'].join('\n'),
    );

    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'image', 'paragraph']);
  });

  it('ends a list cleanly rather than swallowing the image', () => {
    const blocks = parseBlogBody(['- one', '- two', '![Shot](/api/blog/images/abc123)'].join('\n'));
    expect(blocks.map((b) => b.type)).toEqual(['list', 'image']);
  });

  it('leaves an inline-looking image as plain text, since images are blocks', () => {
    const blocks = parseBlogBody('Text with ![an image](/api/blog/images/abc123) inside it.');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe('paragraph');
  });

  it('allows empty alt text in the markup without producing a broken block', () => {
    expect(parseBlogBody('![](/api/blog/images/abc123)')).toEqual([
      { type: 'image', src: '/api/blog/images/abc123', alt: '' },
    ]);
  });

  it('counts an image as its description in the plain text, and never throws', () => {
    const body = '![A chart of scores](/api/blog/images/abc123)\n\nSome words.';
    expect(blogBodyToPlainText(body)).toBe('A chart of scores Some words.');
    expect(readingTimeMinutes(body)).toBe(1);
  });
});

describe('slugify', () => {
  it('produces a URL-safe slug', () => {
    expect(slugify('What GEO Actually Is')).toBe('what-geo-actually-is');
    expect(slugify("Don't — Guess!")).toBe('dont-guess');
    expect(slugify('  spaced   out  ')).toBe('spaced-out');
  });

  it('strips accents rather than dropping the word', () => {
    expect(slugify('Café Señor')).toBe('cafe-senor');
  });

  it('returns an empty string when nothing usable survives, so callers validate', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugify('')).toBe('');
  });

  it('never ends with a hyphen, even when truncated at the limit', () => {
    const slug = slugify('a'.repeat(78) + ' bbbb');
    expect(slug.endsWith('-')).toBe(false);
    expect(slug.length).toBeLessThanOrEqual(80);
  });
});
