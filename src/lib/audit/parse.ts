import * as cheerio from 'cheerio';
import { PageRole } from '@prisma/client';

/**
 * Turns raw HTML into the structured signal set every audit check reads.
 *
 * Everything here is deterministic: the same HTML always produces the same
 * PageSignals object. No scoring or interpretation happens at this layer.
 */

export interface HeadingNode {
  level: number;
  text: string;
}

export interface JsonLdBlock {
  /** @type values found anywhere in the block, flattened. */
  types: string[];
  /** Top-level property names, used to judge completeness. */
  properties: string[];
  valid: boolean;
  parseError: string | null;
  /** Bounded excerpt kept for the evidence panel. */
  excerpt: string;
  /** Selected property values used by the entity checks. */
  values: Record<string, string>;
}

export interface LinkInfo {
  href: string;
  absolute: string;
  text: string;
  internal: boolean;
  nofollow: boolean;
}

export interface PageSignals {
  url: string;
  finalUrl: string;
  statusCode: number;
  isHttps: boolean;
  contentType: string | null;
  bytes: number;
  fetchMs: number;
  redirectChain: Array<{ from: string; to: string; status: number }>;

  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  canonical: string | null;
  canonicalIsSelf: boolean;
  robotsMeta: string | null;
  isIndexable: boolean;
  noindexReason: string | null;
  langAttr: string | null;
  viewport: string | null;
  charset: string | null;

  h1: string[];
  headings: HeadingNode[];
  questionHeadings: string[];
  headingHierarchyValid: boolean;

  wordCount: number;
  paragraphCount: number;
  /** Longest run of body text, a proxy for real content depth. */
  mainTextExcerpt: string;
  /** First substantive paragraph — used to detect templated pages. */
  firstParagraph: string;
  listCount: number;
  listItemCount: number;
  tableCount: number;
  definitionCount: number;

  imageCount: number;
  imagesWithAlt: number;
  imagesWithEmptyAlt: number;

  links: LinkInfo[];
  internalLinks: number;
  externalLinks: number;
  externalDomains: string[];
  outboundCitationLinks: number;

  openGraph: Record<string, string>;
  twitterCard: Record<string, string>;

  jsonLd: JsonLdBlock[];
  schemaTypes: string[];
  microdataTypes: string[];

  hasFaqSignals: boolean;
  faqQuestionCount: number;

  publishedDate: string | null;
  modifiedDate: string | null;
  authors: string[];
  hasBylineText: boolean;

  emails: string[];
  phones: string[];
  addressSignals: string[];
  hasContactSignals: boolean;

  /** Vague marketing phrasing that reduces machine-readable specificity. */
  vaguePhrases: string[];
  superlatives: string[];
  /** Concrete numbers/dates/measurements — a specificity proxy. */
  factualDataPoints: number;

  role: PageRole;
}

const QUESTION_WORDS = /^(what|why|how|when|where|who|which|can|do|does|is|are|should|will)\b/i;

const VAGUE_PHRASES = [
  'world class',
  'world-class',
  'cutting edge',
  'cutting-edge',
  'best in class',
  'best-in-class',
  'industry leading',
  'industry-leading',
  'state of the art',
  'state-of-the-art',
  'one stop shop',
  'one-stop shop',
  'unparalleled',
  'second to none',
  'synergy',
  'seamlessly integrate',
  'passionate about',
  'we go the extra mile',
  'solutions provider',
  'leverage our expertise',
  'take it to the next level',
];

const SUPERLATIVES = [
  'the best',
  'number one',
  '#1',
  'the leading',
  'the greatest',
  'unbeatable',
  'guaranteed results',
  'the most trusted',
  'the top rated',
  'the finest',
];

const CONTACT_KEYWORDS = ['contact us', 'get in touch', 'call us', 'email us', 'office hours'];

function textOf($: cheerio.CheerioAPI, selector: string): string | null {
  const el = $(selector).first();
  if (el.length === 0) return null;
  const value = el.text().trim();
  return value.length > 0 ? value : null;
}

function attrOf($: cheerio.CheerioAPI, selector: string, attr: string): string | null {
  const el = $(selector).first();
  if (el.length === 0) return null;
  const value = el.attr(attr);
  return value && value.trim().length > 0 ? value.trim() : null;
}

/** Recursively collect @type values from a JSON-LD document. */
function collectTypes(node: unknown, out: Set<string>, depth = 0): void {
  if (depth > 8 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectTypes(item, out, depth + 1);
    return;
  }
  if (typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  const type = obj['@type'];
  if (typeof type === 'string') out.add(type);
  if (Array.isArray(type)) {
    for (const t of type) if (typeof t === 'string') out.add(t);
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') collectTypes(value, out, depth + 1);
  }
}

function collectStringValues(
  node: unknown,
  keys: string[],
  out: Record<string, string>,
  depth = 0,
): void {
  if (depth > 6 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectStringValues(item, keys, out, depth + 1);
    return;
  }
  if (typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim() && !out[key]) {
      out[key] = value.trim().slice(0, 300);
    } else if (value && typeof value === 'object' && !out[key]) {
      const nested = value as Record<string, unknown>;
      const name = nested.name ?? nested['@id'] ?? nested.url;
      if (typeof name === 'string' && name.trim()) out[key] = name.trim().slice(0, 300);
    }
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') collectStringValues(value, keys, out, depth + 1);
  }
}

const TRACKED_SCHEMA_PROPERTIES = [
  'name',
  'legalName',
  'description',
  'url',
  'logo',
  'telephone',
  'email',
  'address',
  'sameAs',
  'areaServed',
  'founder',
  'foundingDate',
  'author',
  'datePublished',
  'dateModified',
  'headline',
  'publisher',
  'aggregateRating',
  'review',
  'priceRange',
  'openingHours',
  'contactPoint',
  'knowsAbout',
  'serviceType',
  'provider',
];

function parseJsonLd($: cheerio.CheerioAPI): JsonLdBlock[] {
  const blocks: JsonLdBlock[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    const excerpt = raw.slice(0, 2000);
    try {
      const parsed = JSON.parse(raw);
      const types = new Set<string>();
      collectTypes(parsed, types);
      const values: Record<string, string> = {};
      collectStringValues(parsed, TRACKED_SCHEMA_PROPERTIES, values);

      const properties = new Set<string>();
      const roots = Array.isArray(parsed) ? parsed : [parsed];
      for (const root of roots) {
        if (root && typeof root === 'object') {
          for (const key of Object.keys(root as Record<string, unknown>)) {
            if (!key.startsWith('@')) properties.add(key);
          }
          const graph = (root as Record<string, unknown>)['@graph'];
          if (Array.isArray(graph)) {
            for (const node of graph) {
              if (node && typeof node === 'object') {
                for (const key of Object.keys(node as Record<string, unknown>)) {
                  if (!key.startsWith('@')) properties.add(key);
                }
              }
            }
          }
        }
      }

      blocks.push({
        types: [...types],
        properties: [...properties],
        valid: true,
        parseError: null,
        excerpt,
        values,
      });
    } catch (error) {
      blocks.push({
        types: [],
        properties: [],
        valid: false,
        parseError: error instanceof Error ? error.message.slice(0, 200) : 'Invalid JSON',
        excerpt,
        values: {},
      });
    }
  });
  return blocks;
}

function classifyRole(url: string, title: string | null, h1: string[]): PageRole {
  let pathname = '/';
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    pathname = url.toLowerCase();
  }
  const haystack = `${pathname} ${(title ?? '').toLowerCase()} ${h1.join(' ').toLowerCase()}`;

  if (pathname === '/' || pathname === '') return PageRole.HOME;
  if (/\/(about|about-us|our-story|who-we-are|company)\b/.test(pathname)) return PageRole.ABOUT;
  if (/\/(contact|contact-us|get-in-touch|locations?)\b/.test(pathname)) return PageRole.CONTACT;
  if (/\/(faqs?|frequently-asked|help|questions)\b/.test(pathname) || /faq/.test(haystack)) {
    return PageRole.FAQ;
  }
  if (/\/(pricing|plans|packages|rates)\b/.test(pathname)) return PageRole.PRICING;
  if (/\/(case-stud|success-stor|portfolio|our-work|projects)/.test(pathname))
    return PageRole.CASE_STUDY;
  if (/\/(author|team|staff|people)\//.test(pathname)) return PageRole.AUTHOR;
  if (/^\/(blog|news|articles|insights|resources|guides)\/?$/.test(pathname))
    return PageRole.BLOG_INDEX;
  if (/^\/(blog|news|articles|insights|resources|guides)\//.test(pathname)) return PageRole.ARTICLE;
  if (/\/(services?|solutions?|what-we-do)\b/.test(pathname)) return PageRole.SERVICE;
  if (/\/(products?|shop|store)\b/.test(pathname)) return PageRole.PRODUCT;
  if (/\/(category|categories|collections)\b/.test(pathname)) return PageRole.CATEGORY;
  return PageRole.OTHER;
}

function countMatches(haystack: string, needles: string[]): string[] {
  const found: string[] = [];
  const lower = haystack.toLowerCase();
  for (const needle of needles) {
    if (lower.includes(needle)) found.push(needle);
  }
  return found;
}

/**
 * Parse a fetched HTML document into audit signals.
 */
export function analyzeHtml(input: {
  url: string;
  finalUrl: string;
  html: string;
  statusCode: number;
  contentType: string | null;
  bytes: number;
  fetchMs: number;
  isHttps: boolean;
  redirectChain: Array<{ from: string; to: string; status: number }>;
  siteOrigin: string;
}): PageSignals {
  const $ = cheerio.load(input.html);

  // Remove non-content nodes before measuring text.
  const $content = cheerio.load(input.html);
  $content('script, style, noscript, template, svg, iframe').remove();

  const title = textOf($, 'title');
  const metaDescription =
    attrOf($, 'meta[name="description"]', 'content') ??
    attrOf($, 'meta[name="Description"]', 'content');
  const canonicalRaw = attrOf($, 'link[rel="canonical"]', 'href');
  const robotsMeta =
    attrOf($, 'meta[name="robots"]', 'content') ?? attrOf($, 'meta[name="googlebot"]', 'content');

  let canonical: string | null = null;
  let canonicalIsSelf = false;
  if (canonicalRaw) {
    try {
      canonical = new URL(canonicalRaw, input.finalUrl).toString();
      const a = new URL(canonical);
      const b = new URL(input.finalUrl);
      canonicalIsSelf =
        a.hostname.replace(/^www\./, '') === b.hostname.replace(/^www\./, '') &&
        a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '');
    } catch {
      canonical = canonicalRaw;
    }
  }

  const robotsLower = (robotsMeta ?? '').toLowerCase();
  const isIndexable = !robotsLower.includes('noindex') && !robotsLower.includes('none');
  const noindexReason = isIndexable
    ? null
    : `Robots meta tag contains "${robotsLower.includes('none') ? 'none' : 'noindex'}"`;

  const headings: HeadingNode[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tag =
      (el as unknown as { tagName?: string; name?: string }).tagName ??
      (el as { name?: string }).name ??
      '';
    const level = Number(tag.replace(/[^\d]/g, '')) || 0;
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (level > 0 && text) headings.push({ level, text: text.slice(0, 300) });
  });

  const h1 = headings.filter((h) => h.level === 1).map((h) => h.text);
  const questionHeadings = headings
    .filter((h) => h.text.includes('?') || QUESTION_WORDS.test(h.text))
    .map((h) => h.text);

  // Hierarchy is valid when no heading jumps more than one level down.
  let headingHierarchyValid = true;
  let previousLevel = 0;
  for (const heading of headings) {
    if (previousLevel > 0 && heading.level > previousLevel + 1) {
      headingHierarchyValid = false;
      break;
    }
    previousLevel = heading.level;
  }

  const bodyText = $content('body').text().replace(/\s+/g, ' ').trim();
  const words = bodyText.split(/\s+/).filter((w) => /[a-zA-Z0-9]/.test(w));
  const wordCount = words.length;

  const paragraphs: string[] = [];
  $content('p').each((_, el) => {
    const text = $content(el).text().replace(/\s+/g, ' ').trim();
    if (text.length > 40) paragraphs.push(text);
  });

  const mainTextExcerpt = paragraphs.slice(0, 8).join(' ').slice(0, 4000);
  const firstParagraph = (paragraphs[0] ?? '').slice(0, 600);

  const listCount = $content('ul, ol').length;
  const listItemCount = $content('li').length;
  const tableCount = $content('table').length;
  const definitionCount = $content('dl').length;

  let imageCount = 0;
  let imagesWithAlt = 0;
  let imagesWithEmptyAlt = 0;
  $('img').each((_, el) => {
    imageCount += 1;
    const alt = $(el).attr('alt');
    if (alt == null) return;
    if (alt.trim().length === 0) {
      imagesWithEmptyAlt += 1;
      return;
    }
    imagesWithAlt += 1;
  });

  const siteHost = (() => {
    try {
      return new URL(input.siteOrigin).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  })();

  const links: LinkInfo[] = [];
  const externalDomains = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') ?? '').trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    let absolute: string;
    try {
      absolute = new URL(href, input.finalUrl).toString();
    } catch {
      return;
    }
    let host = '';
    try {
      host = new URL(absolute).hostname.replace(/^www\./, '');
    } catch {
      return;
    }
    const internal = host === siteHost;
    if (!internal && host) externalDomains.add(host);
    links.push({
      href,
      absolute,
      text: $(el).text().replace(/\s+/g, ' ').trim().slice(0, 200),
      internal,
      nofollow: ($(el).attr('rel') ?? '').toLowerCase().includes('nofollow'),
    });
  });

  const internalLinks = links.filter((l) => l.internal).length;
  const externalLinks = links.length - internalLinks;
  // Outbound links inside body prose are a citation signal.
  const outboundCitationLinks = links.filter(
    (l) => !l.internal && !l.nofollow && l.text.length > 3 && !/^https?:\/\//.test(l.text),
  ).length;

  const openGraph: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const key = $(el).attr('property');
    const value = $(el).attr('content');
    if (key && value) openGraph[key] = value.slice(0, 500);
  });

  const twitterCard: Record<string, string> = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const key = $(el).attr('name');
    const value = $(el).attr('content');
    if (key && value) twitterCard[key] = value.slice(0, 500);
  });

  const jsonLd = parseJsonLd($);
  const schemaTypes = [...new Set(jsonLd.flatMap((b) => b.types))];

  const microdataTypes: string[] = [];
  $('[itemtype]').each((_, el) => {
    const value = $(el).attr('itemtype');
    if (!value) return;
    const type = value.split('/').pop();
    if (type) microdataTypes.push(type);
  });

  const faqFromSchema = schemaTypes.includes('FAQPage') || schemaTypes.includes('Question');
  const faqQuestionCount = questionHeadings.length;
  const hasFaqSignals =
    faqFromSchema || faqQuestionCount >= 3 || /frequently asked questions/i.test(bodyText);

  const publishedDate =
    attrOf($, 'meta[property="article:published_time"]', 'content') ??
    attrOf($, 'meta[name="datePublished"]', 'content') ??
    attrOf($, 'time[datetime]', 'datetime') ??
    jsonLd.find((b) => b.values.datePublished)?.values.datePublished ??
    null;

  const modifiedDate =
    attrOf($, 'meta[property="article:modified_time"]', 'content') ??
    attrOf($, 'meta[name="dateModified"]', 'content') ??
    jsonLd.find((b) => b.values.dateModified)?.values.dateModified ??
    null;

  const authors = new Set<string>();
  const schemaAuthor = jsonLd.find((b) => b.values.author)?.values.author;
  if (schemaAuthor) authors.add(schemaAuthor);
  const metaAuthor = attrOf($, 'meta[name="author"]', 'content');
  if (metaAuthor) authors.add(metaAuthor);
  $('[rel="author"], .author, .byline, [itemprop="author"]').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text && text.length < 120) authors.add(text.replace(/^by\s+/i, ''));
  });
  const hasBylineText = /\bby\s+[A-Z][a-z]+\s+[A-Z][a-z]+/.test(bodyText);

  const emails = [
    ...new Set(
      (input.html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [])
        .filter((e) => !/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(e))
        .slice(0, 10),
    ),
  ];
  const phones = [
    ...new Set(
      (bodyText.match(/(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) ?? []).slice(0, 10),
    ),
  ];

  const addressSignals: string[] = [];
  const addressText = $content('address').text().replace(/\s+/g, ' ').trim();
  if (addressText) addressSignals.push(addressText.slice(0, 300));
  const stateZip = bodyText.match(
    /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s+\d{5}(?:-\d{4})?\b/,
  );
  if (stateZip?.[0]) addressSignals.push(stateZip[0]);
  if (jsonLd.some((b) => b.values.address)) {
    addressSignals.push(jsonLd.find((b) => b.values.address)?.values.address ?? '');
  }

  const hasContactSignals =
    emails.length > 0 ||
    phones.length > 0 ||
    addressSignals.length > 0 ||
    countMatches(bodyText, CONTACT_KEYWORDS).length > 0;

  const vaguePhrases = countMatches(bodyText, VAGUE_PHRASES);
  const superlatives = countMatches(bodyText, SUPERLATIVES);

  // Numbers, years, percentages and measurements act as a specificity proxy.
  const factualDataPoints = (
    bodyText.match(
      /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?(?:%|percent|years?|customers?|projects?|clients?|homes?|sq\.?\s?ft|miles?|hours?|days?|\$)/gi,
    ) ?? []
  ).length;

  return {
    url: input.url,
    finalUrl: input.finalUrl,
    statusCode: input.statusCode,
    isHttps: input.isHttps,
    contentType: input.contentType,
    bytes: input.bytes,
    fetchMs: input.fetchMs,
    redirectChain: input.redirectChain,

    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    canonical,
    canonicalIsSelf,
    robotsMeta,
    isIndexable,
    noindexReason,
    langAttr: attrOf($, 'html', 'lang'),
    viewport: attrOf($, 'meta[name="viewport"]', 'content'),
    charset:
      attrOf($, 'meta[charset]', 'charset') ??
      attrOf($, 'meta[http-equiv="Content-Type"]', 'content')?.match(/charset=([\w-]+)/i)?.[1] ??
      null,

    h1,
    headings,
    questionHeadings,
    headingHierarchyValid,

    wordCount,
    paragraphCount: paragraphs.length,
    mainTextExcerpt,
    firstParagraph,
    listCount,
    listItemCount,
    tableCount,
    definitionCount,

    imageCount,
    imagesWithAlt,
    imagesWithEmptyAlt,

    links,
    internalLinks,
    externalLinks,
    externalDomains: [...externalDomains].slice(0, 40),
    outboundCitationLinks,

    openGraph,
    twitterCard,

    jsonLd,
    schemaTypes,
    microdataTypes: [...new Set(microdataTypes)],

    hasFaqSignals,
    faqQuestionCount,

    publishedDate,
    modifiedDate,
    authors: [...authors].slice(0, 10),
    hasBylineText,

    emails,
    phones,
    addressSignals: addressSignals.filter(Boolean),
    hasContactSignals,

    vaguePhrases,
    superlatives,
    factualDataPoints,

    role: classifyRole(input.finalUrl, title, h1),
  };
}

/** Extract candidate crawl URLs from a page, ranked by GEO usefulness. */
export function extractCrawlCandidates(signals: PageSignals, siteOrigin: string): string[] {
  const origin = (() => {
    try {
      return new URL(siteOrigin).origin;
    } catch {
      return siteOrigin;
    }
  })();

  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const link of signals.links) {
    if (!link.internal) continue;
    let url: URL;
    try {
      url = new URL(link.absolute);
    } catch {
      continue;
    }
    if (url.origin !== origin) continue;

    // Skip anything that is never useful for a GEO audit.
    const path = url.pathname.toLowerCase();
    if (
      /\.(pdf|zip|jpg|jpeg|png|gif|webp|svg|mp4|mp3|css|js|ico|woff2?|ttf|xml|json)$/.test(path) ||
      /\/(wp-admin|wp-login|admin|login|signin|sign-in|register|signup|sign-up|account|cart|checkout|basket|my-account|logout|search|feed|tag|author\/feed)\b/.test(
        path,
      ) ||
      url.search.length > 0 ||
      path.includes('/page/') ||
      path.startsWith('/cdn-cgi/')
    ) {
      continue;
    }

    const normalized = `${url.origin}${url.pathname.replace(/\/+$/, '') || '/'}`;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push(normalized);
  }

  return candidates;
}

/** Priority order for choosing which discovered pages to crawl. */
export function crawlPriority(url: string): number {
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  })();

  if (path === '/' || path === '') return 0;
  if (/\/(about|about-us|our-story|who-we-are|company)/.test(path)) return 1;
  if (/\/(services?|solutions?|what-we-do)/.test(path)) return 2;
  if (/\/(faqs?|frequently-asked)/.test(path)) return 3;
  if (/\/(contact|contact-us|locations?)/.test(path)) return 4;
  if (/\/(products?|shop)/.test(path)) return 5;
  if (/\/(case-stud|success-stor|portfolio|our-work)/.test(path)) return 6;
  if (/^\/(blog|news|articles|insights|resources|guides)\/?$/.test(path)) return 7;
  if (/\/(pricing|plans)/.test(path)) return 8;
  if (/\/(author|team|staff)/.test(path)) return 9;
  if (/^\/(blog|news|articles|insights|resources|guides)\//.test(path)) return 10;
  // Prefer shallow pages over deep ones.
  return 11 + Math.min(8, path.split('/').filter(Boolean).length);
}
