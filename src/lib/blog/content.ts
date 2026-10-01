/**
 * The restricted markup a blog post body is written in.
 *
 * This is deliberately NOT markdown-with-HTML and NOT an HTML field. A post is
 * authored by a super admin, but "the author is trusted" is a weak reason to
 * put raw markup on a public page: one stolen admin session would become
 * stored XSS on every visitor. So a post is parsed here into a plain data
 * structure, and the renderer turns that structure into React elements. There
 * is no `dangerouslySetInnerHTML` anywhere in the path, which means an author
 * cannot inject markup even on purpose.
 *
 * Block syntax, one per line:
 *   ## Heading          →  h2
 *   ### Heading         →  h3
 *   > Quote             →  blockquote
 *   - item              →  unordered list
 *   1. item             →  ordered list
 *   ![alt](/api/…)      →  figure + img, uploads and https only
 *   blank line          →  paragraph break
 *
 * Inline syntax:
 *   **bold**            →  <strong>
 *   `code`              →  <code>
 *   [text](https://…)   →  link, http(s) only
 *
 * An image is a block and never inline, so it cannot end up inside a
 * paragraph, and its alt text is required by the upload form rather than
 * optional here.
 */

import { BLOG_IMAGE_PATH } from '@/lib/blog/images';

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; value: string; href: string };

export type Block =
  | { type: 'heading'; level: 2 | 3; content: InlineNode[] }
  | { type: 'paragraph'; content: InlineNode[] }
  | { type: 'quote'; content: InlineNode[] }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] }
  | { type: 'image'; src: string; alt: string };

/**
 * An image source, allowing only the two shapes that cannot carry script:
 * an upload served by this application, and an absolute https URL.
 *
 * `data:` is refused even though a data URI cannot execute in `<img>`, because
 * allowing it would put author-controlled bytes into the HTML itself and make
 * the upload limits pointless. Plain `http:` is refused because the site is
 * served over https and a mixed-content image is simply blocked by the browser
 * — an author would see a broken image with no explanation.
 */
function safeImageSrc(raw: string): string | null {
  const src = raw.trim();

  // An upload: /api/blog/images/<id>, and nothing that climbs out of it.
  if (src.startsWith(`${BLOG_IMAGE_PATH}/`)) {
    const id = src.slice(BLOG_IMAGE_PATH.length + 1);
    return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? `${BLOG_IMAGE_PATH}/${id}` : null;
  }

  if (!/^https:\/\//i.test(src)) return null;
  try {
    const url = new URL(src);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Only http and https survive. A `javascript:` or `data:` href is not a
 * broken link to be rendered inertly — it is an attack, so the whole
 * construct degrades to its visible text and the URL is discarded.
 */
function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (!/^https?:\/\//i.test(href)) return null;
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

export function parseInline(line: string): InlineNode[] {
  const nodes: InlineNode[] = [];

  for (const piece of line.split(INLINE)) {
    if (!piece) continue;

    if (piece.startsWith('**') && piece.endsWith('**') && piece.length > 4) {
      nodes.push({ type: 'bold', value: piece.slice(2, -2) });
      continue;
    }
    if (piece.startsWith('`') && piece.endsWith('`') && piece.length > 2) {
      nodes.push({ type: 'code', value: piece.slice(1, -1) });
      continue;
    }

    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(piece);
    if (link) {
      const href = safeHref(link[2]);
      // An unsafe URL keeps its text and loses its link.
      nodes.push(href ? { type: 'link', value: link[1], href } : { type: 'text', value: link[1] });
      continue;
    }

    nodes.push({ type: 'text', value: piece });
  }

  return nodes;
}

export function parseBlogBody(body: string): Block[] {
  const blocks: Block[] = [];
  const lines = body.replace(/\r\n/g, '\n').split('\n');

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: 'paragraph', content: parseInline(paragraph.join(' ')) });
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push({
      type: 'list',
      ordered: list.ordered,
      items: list.items.map((item) => parseInline(item)),
    });
    list = null;
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === '') {
      flushAll();
      continue;
    }

    // ![alt](src) alone on a line. An unusable src keeps the alt text as a
    // paragraph, the same way an unsafe link keeps its text: content an author
    // typed is never silently dropped.
    const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line);
    if (image) {
      flushAll();
      const src = safeImageSrc(image[2]);
      const alt = image[1].trim();
      if (src) blocks.push({ type: 'image', src, alt });
      else if (alt) blocks.push({ type: 'paragraph', content: parseInline(alt) });
      continue;
    }

    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      blocks.push({
        type: 'heading',
        level: heading[1].length === 2 ? 2 : 3,
        content: parseInline(heading[2]),
      });
      continue;
    }

    const quote = /^>\s+(.*)$/.exec(line);
    if (quote) {
      flushAll();
      blocks.push({ type: 'quote', content: parseInline(quote[1]) });
      continue;
    }

    const unordered = /^[-*]\s+(.*)$/.exec(line);
    if (unordered) {
      flushParagraph();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(unordered[1]);
      continue;
    }

    const ordered = /^\d+\.\s+(.*)$/.exec(line);
    if (ordered) {
      flushParagraph();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushAll();
  return blocks;
}

/** Plain text of a post, for reading-time and excerpt fallbacks. */
export function blogBodyToPlainText(body: string): string {
  return parseBlogBody(body)
    .flatMap((block) => {
      if (block.type === 'list') {
        return block.items.map((item) => item.map((n) => n.value).join(''));
      }
      // An image contributes its alt text and nothing else — it has no inline
      // content, and reading it as if it did would throw.
      if (block.type === 'image') return [block.alt];
      return [block.content.map((n) => n.value).join('')];
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whole minutes, floored at 1. 200 words per minute is the usual convention. */
export function readingTimeMinutes(body: string): number {
  const words = blogBodyToPlainText(body).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * URL-safe slug. Returns '' when nothing usable survives, so the caller
 * validates rather than silently storing an empty slug.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}
