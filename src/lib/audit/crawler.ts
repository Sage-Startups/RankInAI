import { safeFetch, crawlDelay } from '@/lib/audit/fetcher';
import { fetchRobotsTxt, isPathAllowed, type RobotsTxt } from '@/lib/audit/robots';
import {
  analyzeHtml,
  crawlPriority,
  extractCrawlCandidates,
  type PageSignals,
} from '@/lib/audit/parse';
import { validateAuditUrl } from '@/lib/audit/url-safety';
import type { LlmsTxtInfo, SitemapInfo } from '@/lib/audit/types';

/**
 * Bounded, robots-aware crawler.
 *
 * Deliberate constraints:
 *  - never submits a form, never authenticates, never executes anything
 *  - honors robots.txt for our own agent token
 *  - skips login/checkout/account/parameterized URLs entirely
 *  - stops at the plan's page limit
 */

export interface CrawlOutcome {
  homepage: PageSignals | null;
  pages: PageSignals[];
  failedPages: Array<{ url: string; code: string; message: string }>;
  robots: RobotsTxt;
  sitemap: SitemapInfo;
  llmsTxt: LlmsTxtInfo;
  brokenInternalLinks: Array<{ from: string; to: string; status: number | null }>;
  siteOrigin: string;
  /** Fatal error preventing any analysis. */
  fatalError: { code: string; message: string } | null;
}

export interface CrawlOptions {
  pageLimit: number;
  onProgress?: (progress: number, message: string) => void | Promise<void>;
  /** Cap on broken-link probes so a large site does not explode the crawl. */
  linkCheckBudget?: number;
}

async function fetchSitemap(origin: string, robots: RobotsTxt): Promise<SitemapInfo> {
  const candidates = [
    ...robots.sitemaps,
    new URL('/sitemap.xml', origin).toString(),
    new URL('/sitemap_index.xml', origin).toString(),
  ];

  for (const candidate of candidates.slice(0, 4)) {
    const validated = validateAuditUrl(candidate);
    if (!validated.ok) continue;

    const result = await safeFetch(validated.normalized, {
      allowPlainText: true,
      maxBytes: 2_000_000,
    });
    if (!result.ok) continue;

    const isIndex = /<sitemapindex/i.test(result.body);
    const urlCount = (result.body.match(/<loc>/gi) ?? []).length;

    return {
      found: true,
      url: result.finalUrl,
      urlCount,
      isIndex,
      error: null,
    };
  }

  return { found: false, url: null, urlCount: 0, isIndex: false, error: null };
}

async function fetchLlmsTxt(origin: string): Promise<LlmsTxtInfo> {
  const url = new URL('/llms.txt', origin).toString();
  const result = await safeFetch(url, { allowPlainText: true, maxBytes: 500_000 });
  if (!result.ok || result.statusCode >= 400) {
    return { found: false, url: null, bytes: 0, mentionsSections: false };
  }
  // Guard against SPA catch-all routes returning HTML for every path.
  if (/<html/i.test(result.body.slice(0, 500))) {
    return { found: false, url: null, bytes: 0, mentionsSections: false };
  }
  return {
    found: true,
    url: result.finalUrl,
    bytes: result.bytes,
    mentionsSections: /^#{1,3}\s+/m.test(result.body),
  };
}

/**
 * Crawl a site and return everything the check modules need.
 */
export async function crawlSite(startUrl: string, options: CrawlOptions): Promise<CrawlOutcome> {
  const report = async (progress: number, message: string) => {
    await options.onProgress?.(progress, message);
  };

  const validated = validateAuditUrl(startUrl);
  if (!validated.ok) {
    return {
      homepage: null,
      pages: [],
      failedPages: [],
      robots: emptyRobots(),
      sitemap: { found: false, url: null, urlCount: 0, isIndex: false, error: null },
      llmsTxt: { found: false, url: null, bytes: 0, mentionsSections: false },
      brokenInternalLinks: [],
      siteOrigin: startUrl,
      fatalError: { code: validated.code, message: validated.message },
    };
  }

  const siteOrigin = validated.url.origin;

  await report(8, 'Checking crawl access');
  const robots = await fetchRobotsTxt(siteOrigin);

  if (robots.blocksEverything) {
    return {
      homepage: null,
      pages: [],
      failedPages: [],
      robots,
      sitemap: { found: false, url: null, urlCount: 0, isIndex: false, error: null },
      llmsTxt: { found: false, url: null, bytes: 0, mentionsSections: false },
      brokenInternalLinks: [],
      siteOrigin,
      fatalError: {
        code: 'ROBOTS_BLOCKED',
        message:
          "This website's robots.txt disallows all automated crawling, so RankInAI cannot analyze it. Update robots.txt to allow the RankInAI-Auditor agent and run the audit again.",
      },
    };
  }

  await report(14, 'Fetching the homepage');
  const homeResult = await safeFetch(validated.normalized);

  if (!homeResult.ok) {
    return {
      homepage: null,
      pages: [],
      failedPages: [
        { url: validated.normalized, code: homeResult.code, message: homeResult.message },
      ],
      robots,
      sitemap: { found: false, url: null, urlCount: 0, isIndex: false, error: null },
      llmsTxt: { found: false, url: null, bytes: 0, mentionsSections: false },
      brokenInternalLinks: [],
      siteOrigin,
      fatalError: { code: homeResult.code, message: homeResult.message },
    };
  }

  const homepage = analyzeHtml({
    url: validated.normalized,
    finalUrl: homeResult.finalUrl,
    html: homeResult.body,
    statusCode: homeResult.statusCode,
    contentType: homeResult.contentType,
    bytes: homeResult.bytes,
    fetchMs: homeResult.durationMs,
    isHttps: homeResult.isHttps,
    redirectChain: homeResult.redirectChain,
    siteOrigin,
  });

  const pages: PageSignals[] = [homepage];
  const failedPages: Array<{ url: string; code: string; message: string }> = [];
  const visited = new Set<string>([normalizeKey(homeResult.finalUrl)]);

  await report(22, 'Reading structured data and site files');
  const [sitemap, llmsTxt] = await Promise.all([
    fetchSitemap(siteOrigin, robots),
    fetchLlmsTxt(siteOrigin),
  ]);

  // Build the crawl queue from homepage links, ranked by GEO usefulness.
  const queue = extractCrawlCandidates(homepage, siteOrigin)
    .filter((url) => !visited.has(normalizeKey(url)))
    .sort((a, b) => crawlPriority(a) - crawlPriority(b));

  const remaining = Math.max(0, options.pageLimit - 1);
  let crawled = 0;

  for (const candidate of queue) {
    if (crawled >= remaining) break;

    const key = normalizeKey(candidate);
    if (visited.has(key)) continue;
    visited.add(key);

    const candidateUrl = new URL(candidate);
    if (!isPathAllowed(robots, candidateUrl.pathname)) {
      failedPages.push({
        url: candidate,
        code: 'ROBOTS_DISALLOWED',
        message: 'Skipped because robots.txt disallows this path for our crawler.',
      });
      continue;
    }

    await crawlDelay();

    const progress = 22 + Math.round(((crawled + 1) / Math.max(1, remaining)) * 33);
    await report(
      Math.min(55, progress),
      `Analyzing page ${crawled + 2} of up to ${options.pageLimit}`,
    );

    const result = await safeFetch(candidate);
    if (!result.ok) {
      failedPages.push({ url: candidate, code: result.code, message: result.message });
      continue;
    }

    const signals = analyzeHtml({
      url: candidate,
      finalUrl: result.finalUrl,
      html: result.body,
      statusCode: result.statusCode,
      contentType: result.contentType,
      bytes: result.bytes,
      fetchMs: result.durationMs,
      isHttps: result.isHttps,
      redirectChain: result.redirectChain,
      siteOrigin,
    });

    pages.push(signals);
    crawled += 1;

    // Newly discovered pages can extend the queue, but only while we still
    // have budget and only if they rank better than what is already queued.
    if (crawled < remaining) {
      const discovered = extractCrawlCandidates(signals, siteOrigin).filter(
        (url) => !visited.has(normalizeKey(url)) && !queue.includes(url),
      );
      for (const url of discovered
        .sort((a, b) => crawlPriority(a) - crawlPriority(b))
        .slice(0, 5)) {
        queue.push(url);
      }
    }
  }

  // --- Broken internal link sampling --------------------------------------
  await report(58, 'Checking internal links');
  const brokenInternalLinks = await checkInternalLinks(
    pages,
    visited,
    options.linkCheckBudget ?? 8,
  );

  return {
    homepage,
    pages,
    failedPages,
    robots,
    sitemap,
    llmsTxt,
    brokenInternalLinks,
    siteOrigin,
    fatalError: null,
  };
}

/**
 * Probe a bounded sample of internal links that were not already crawled.
 * Uses HEAD to avoid downloading bodies.
 */
async function checkInternalLinks(
  pages: PageSignals[],
  alreadyVisited: Set<string>,
  budget: number,
): Promise<Array<{ from: string; to: string; status: number | null }>> {
  const broken: Array<{ from: string; to: string; status: number | null }> = [];
  const seen = new Set<string>();
  const candidates: Array<{ from: string; to: string }> = [];

  for (const page of pages) {
    for (const link of page.links) {
      if (!link.internal) continue;
      const key = normalizeKey(link.absolute);
      if (alreadyVisited.has(key) || seen.has(key)) continue;
      if (/\.(jpg|jpeg|png|gif|webp|svg|css|js|ico|woff2?)$/i.test(link.absolute)) continue;
      seen.add(key);
      candidates.push({ from: page.finalUrl, to: link.absolute });
      if (candidates.length >= budget) break;
    }
    if (candidates.length >= budget) break;
  }

  for (const candidate of candidates) {
    const result = await safeFetch(candidate.to, {
      method: 'HEAD',
      acceptErrorStatus: true,
      allowPlainText: true,
      timeoutMs: 8000,
    });
    if (!result.ok) {
      if (result.code === 'HTTP_ERROR' || result.code === 'CONNECTION_FAILED') {
        broken.push({ from: candidate.from, to: candidate.to, status: result.statusCode ?? null });
      }
      continue;
    }
    if (result.statusCode >= 400) {
      broken.push({ from: candidate.from, to: candidate.to, status: result.statusCode });
    }
  }

  return broken;
}

function normalizeKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '') || '/'}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function emptyRobots(): RobotsTxt {
  return {
    found: false,
    statusCode: null,
    rules: [],
    sitemaps: [],
    crawlDelaySeconds: null,
    hasAgentSpecificGroup: false,
    blocksEverything: false,
    blockedAiAgents: [],
    raw: null,
    error: null,
  };
}
