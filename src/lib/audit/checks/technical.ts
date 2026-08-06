import { AuditCategory } from '@prisma/client';

import type { AuditContext, CheckResult } from '@/lib/audit/types';
import {
  Effort,
  Impact,
  Status,
  makeCheck,
  proportion,
  scaleToTarget,
  statusFromRatio,
} from '@/lib/audit/checks/helpers';

const CATEGORY = AuditCategory.TECHNICAL_ACCESSIBILITY;

/**
 * Technical Accessibility — can an AI crawler physically reach, load and index
 * the site's pages?
 *
 * Total available points: 62.
 */
export function runTechnicalChecks(ctx: AuditContext): CheckResult[] {
  const checks: CheckResult[] = [];
  const { homepage, pages, robots, sitemap, llmsTxt } = ctx;

  // --- HTTPS -------------------------------------------------------------
  const httpsPages = pages.filter((p) => p.isHttps).length;
  const httpsRatio = pages.length > 0 ? httpsPages / pages.length : 0;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'tech.https',
      title: 'Site is served over HTTPS',
      status: pages.length === 0 ? Status.FAIL : statusFromRatio(httpsRatio, { passAt: 1, warnAt: 0.5 }),
      ratio: httpsRatio,
      maxPoints: 8,
      evidence: {
        pagesChecked: pages.length,
        pagesOverHttps: httpsPages,
        homepageProtocol: homepage?.isHttps ? 'https' : 'http',
      },
      explanation:
        'Answer engines and AI crawlers routinely skip or down-weight content served over plain HTTP. HTTPS is the baseline requirement for being treated as a trustworthy source.',
      recommendedAction:
        httpsRatio >= 1
          ? 'No action needed — keep the certificate renewed and redirect any lingering HTTP URLs.'
          : 'Install a valid TLS certificate and permanently redirect every HTTP URL to its HTTPS equivalent.',
      effort: Effort.LOW,
      impact: Impact.HIGH,
      pageUrl: homepage?.finalUrl ?? null,
    }),
  );

  // --- Homepage reachability --------------------------------------------
  const homepageOk = homepage != null && homepage.statusCode >= 200 && homepage.statusCode < 300;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'tech.homepage-status',
      title: 'Homepage returns a successful response',
      status: homepageOk ? Status.PASS : Status.FAIL,
      ratio: homepageOk ? 1 : 0,
      maxPoints: 8,
      evidence: {
        statusCode: homepage?.statusCode ?? null,
        finalUrl: homepage?.finalUrl ?? null,
        redirectHops: homepage?.redirectChain.length ?? 0,
      },
      explanation:
        'If the homepage does not return a 200 response, every downstream signal is unreliable and most crawlers abandon the site entirely.',
      recommendedAction: homepageOk
        ? 'No action needed.'
        : 'Investigate the server response for the homepage and make sure it returns HTTP 200 for anonymous visitors.',
      effort: Effort.MEDIUM,
      impact: Impact.HIGH,
      pageUrl: homepage?.finalUrl ?? ctx.requestedUrl,
    }),
  );

  // --- Redirect chain length --------------------------------------------
  const longestChain = pages.reduce((max, p) => Math.max(max, p.redirectChain.length), 0);
  const chainRatio = longestChain === 0 ? 1 : longestChain === 1 ? 0.8 : longestChain === 2 ? 0.5 : 0;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'tech.redirect-chains',
      title: 'Pages resolve without long redirect chains',
      status: longestChain <= 1 ? Status.PASS : longestChain <= 2 ? Status.WARN : Status.FAIL,
      ratio: chainRatio,
      maxPoints: 4,
      evidence: {
        longestRedirectChain: longestChain,
        examples: pages
          .filter((p) => p.redirectChain.length > 1)
          .slice(0, 3)
          .map((p) => ({ url: p.url, hops: p.redirectChain.map((r) => r.to) })),
      },
      explanation:
        'Each redirect hop adds latency and a chance for a crawler to give up. Chains longer than one hop also dilute the association between a URL and its content.',
      recommendedAction:
        longestChain <= 1
          ? 'No action needed.'
          : 'Collapse multi-step redirects so every old URL points directly at its final destination in a single hop.',
      effort: Effort.LOW,
      impact: Impact.LOW,
    }),
  );

  // --- Indexability ------------------------------------------------------
  const indexable = pages.filter((p) => p.isIndexable).length;
  const indexRatio = pages.length > 0 ? indexable / pages.length : 0;
  const homepageIndexable = homepage?.isIndexable ?? false;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'tech.indexability',
      title: 'Pages are indexable (no noindex directives)',
      status: !homepageIndexable ? Status.FAIL : statusFromRatio(indexRatio, { passAt: 0.95, warnAt: 0.7 }),
      ratio: homepageIndexable ? indexRatio : 0,
      maxPoints: 9,
      evidence: {
        indexablePages: indexable,
        totalPages: pages.length,
        homepageIndexable,
        blockedPages: pages
          .filter((p) => !p.isIndexable)
          .slice(0, 5)
          .map((p) => ({ url: p.finalUrl, reason: p.noindexReason })),
      },
      explanation:
        'A noindex directive tells search and answer engines to discard the page. Pages excluded this way are unlikely to be retrieved or cited by generative systems.',
      recommendedAction: homepageIndexable
        ? indexRatio >= 0.95
          ? 'No action needed.'
          : 'Review the pages carrying noindex and remove the directive from anything you want AI systems to be able to cite.'
        : 'Remove the noindex directive from the homepage immediately — it is currently telling every crawler to discard your most important page.',
      effort: Effort.LOW,
      impact: Impact.HIGH,
    }),
  );

  // --- robots.txt --------------------------------------------------------
  const robotsRatio = !robots.found ? 0.35 : robots.blocksEverything ? 0 : 1;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'tech.robots-txt',
      title: 'robots.txt exists and does not block crawling',
      status: robots.blocksEverything ? Status.FAIL : robots.found ? Status.PASS : Status.WARN,
      ratio: robotsRatio,
      maxPoints: 6,
      evidence: {
        found: robots.found,
        statusCode: robots.statusCode,
        blocksEverything: robots.blocksEverything,
        ruleCount: robots.rules.length,
        sitemapsDeclared: robots.sitemaps.length,
      },
      explanation:
        'robots.txt is the first file most crawlers request. A missing file is tolerated, but a blanket Disallow prevents your content from being read at all.',
      recommendedAction: robots.blocksEverything
        ? 'Your robots.txt disallows all crawling. Narrow the rules so public content remains accessible.'
        : robots.found
          ? 'No action needed — keep the sitemap reference up to date.'
          : 'Publish a robots.txt at the site root that allows public content and declares your XML sitemap.',
      effort: Effort.LOW,
      impact: robots.blocksEverything ? Impact.HIGH : Impact.MEDIUM,
    }),
  );

  // --- AI crawler access -------------------------------------------------
  const blockedAi = robots.blockedAiAgents;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'tech.ai-crawler-access',
      title: 'AI and answer-engine crawlers are not blocked',
      status: blockedAi.length === 0 ? Status.PASS : blockedAi.length <= 2 ? Status.WARN : Status.FAIL,
      ratio: blockedAi.length === 0 ? 1 : blockedAi.length <= 2 ? 0.5 : 0,
      maxPoints: 7,
      evidence: {
        blockedAgents: blockedAi,
        robotsFound: robots.found,
      },
      explanation:
        'Several AI systems use named crawlers (for example GPTBot, PerplexityBot, ClaudeBot, Google-Extended). Disallowing them removes your content from the corpus those systems can retrieve and cite.',
      recommendedAction:
        blockedAi.length === 0
          ? 'No action needed. If you later restrict AI crawlers, be aware that it reduces citation opportunities.'
          : `Your robots.txt blocks ${blockedAi.join(', ')}. Decide deliberately whether that trade-off is intended — blocking these agents removes your content from those systems.`,
      effort: Effort.LOW,
      impact: Impact.HIGH,
    }),
  );

  // --- XML sitemap -------------------------------------------------------
  const sitemapRatio = sitemap.found ? (sitemap.urlCount > 0 ? 1 : 0.6) : 0;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'tech.sitemap',
      title: 'XML sitemap is published and discoverable',
      status: sitemap.found ? (sitemap.urlCount > 0 ? Status.PASS : Status.WARN) : Status.FAIL,
      ratio: sitemapRatio,
      maxPoints: 6,
      evidence: {
        found: sitemap.found,
        url: sitemap.url,
        urlCount: sitemap.urlCount,
        isIndex: sitemap.isIndex,
        declaredInRobots: robots.sitemaps.length > 0,
        error: sitemap.error,
      },
      explanation:
        'A sitemap gives crawlers a complete, authoritative list of the URLs you want discovered, which matters most for pages that are weakly linked internally.',
      recommendedAction: sitemap.found
        ? sitemap.urlCount > 0
          ? 'No action needed — keep the sitemap regenerated as content changes.'
          : 'Your sitemap was found but lists no URLs. Regenerate it so it reflects your live pages.'
        : 'Publish an XML sitemap at /sitemap.xml and reference it from robots.txt.',
      effort: Effort.LOW,
      impact: Impact.MEDIUM,
    }),
  );

  // --- llms.txt ----------------------------------------------------------
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'tech.llms-txt',
      title: 'llms.txt guidance file is present',
      status: llmsTxt.found ? Status.PASS : Status.INFO,
      ratio: llmsTxt.found ? 1 : 0,
      maxPoints: 3,
      evidence: {
        found: llmsTxt.found,
        url: llmsTxt.url,
        bytes: llmsTxt.bytes,
        hasSectionStructure: llmsTxt.mentionsSections,
      },
      explanation:
        'llms.txt is an emerging convention for pointing language models at the pages that best summarize a site. Adoption is still early, so its absence is not penalized heavily — but publishing one is a cheap, low-risk signal.',
      recommendedAction: llmsTxt.found
        ? 'No action needed — keep the file current as key pages change.'
        : 'Consider publishing /llms.txt with a short description of the business and links to your most useful pages.',
      effort: Effort.LOW,
      impact: Impact.LOW,
    }),
  );

  // --- Canonical tags ----------------------------------------------------
  const withCanonical = pages.filter((p) => p.canonical != null).length;
  const canonicalRatio = pages.length > 0 ? withCanonical / pages.length : 0;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'tech.canonical',
      title: 'Pages declare a canonical URL',
      status: statusFromRatio(canonicalRatio, { passAt: 0.9, warnAt: 0.5 }),
      ratio: canonicalRatio,
      maxPoints: 5,
      evidence: {
        pagesWithCanonical: withCanonical,
        totalPages: pages.length,
        selfReferencing: pages.filter((p) => p.canonicalIsSelf).length,
        missing: pages
          .filter((p) => !p.canonical)
          .slice(0, 5)
          .map((p) => p.finalUrl),
      },
      explanation:
        'Canonical tags consolidate duplicate URLs into one address. Without them, the same content can be attributed to several URLs, weakening the association between your brand and the passage.',
      recommendedAction:
        canonicalRatio >= 0.9
          ? 'No action needed.'
          : 'Add a self-referencing canonical link to every indexable page.',
      effort: Effort.LOW,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Mobile viewport ---------------------------------------------------
  const viewportRatio = proportion(pages, (p) => p.viewport != null);
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'tech.viewport',
      title: 'Pages declare a mobile viewport',
      status: statusFromRatio(viewportRatio, { passAt: 0.9, warnAt: 0.5 }),
      ratio: viewportRatio,
      maxPoints: 3,
      evidence: {
        pagesWithViewport: pages.filter((p) => p.viewport).length,
        totalPages: pages.length,
      },
      explanation:
        'A declared viewport is a basic mobile-readiness signal. Its absence often correlates with older templates that also lack the structural markup answer engines rely on.',
      recommendedAction:
        viewportRatio >= 0.9
          ? 'No action needed.'
          : 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to your base template.',
      effort: Effort.LOW,
      impact: Impact.LOW,
    }),
  );

  // --- Language declaration ---------------------------------------------
  const langRatio = proportion(pages, (p) => p.langAttr != null);
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'tech.lang',
      title: 'Pages declare a content language',
      status: statusFromRatio(langRatio, { passAt: 0.9, warnAt: 0.5 }),
      ratio: langRatio,
      maxPoints: 3,
      evidence: {
        pagesWithLang: pages.filter((p) => p.langAttr).length,
        totalPages: pages.length,
        values: [...new Set(pages.map((p) => p.langAttr).filter(Boolean))].slice(0, 5),
      },
      explanation:
        'The html lang attribute tells retrieval systems which language a passage is in, which affects whether it is considered for a given query.',
      recommendedAction:
        langRatio >= 0.9 ? 'No action needed.' : 'Set a lang attribute (for example lang="en-US") on the html element.',
      effort: Effort.LOW,
      impact: Impact.LOW,
    }),
  );

  // --- Broken internal links --------------------------------------------
  const brokenCount = ctx.brokenInternalLinks.length;
  const brokenRatio = brokenCount === 0 ? 1 : brokenCount <= 2 ? 0.6 : brokenCount <= 5 ? 0.3 : 0;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'tech.broken-links',
      title: 'Internal links resolve successfully',
      status: brokenCount === 0 ? Status.PASS : brokenCount <= 2 ? Status.WARN : Status.FAIL,
      ratio: brokenRatio,
      maxPoints: 4,
      evidence: {
        brokenLinkCount: brokenCount,
        samples: ctx.brokenInternalLinks.slice(0, 5),
        note: 'Checked against the internal links found on crawled pages.',
      },
      explanation:
        'Broken internal links waste crawl budget and break the paths a retrieval system follows between related passages on your site.',
      recommendedAction:
        brokenCount === 0
          ? 'No action needed.'
          : 'Fix or remove the broken internal links listed in the evidence so crawlers can follow every path.',
      effort: Effort.LOW,
      impact: Impact.LOW,
    }),
  );

  // --- Image alt coverage -----------------------------------------------
  const totalImages = pages.reduce((sum, p) => sum + p.imageCount, 0);
  const withAlt = pages.reduce((sum, p) => sum + p.imagesWithAlt + p.imagesWithEmptyAlt, 0);
  const altRatio = totalImages === 0 ? 1 : withAlt / totalImages;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'tech.image-alt',
      title: 'Images carry alt attributes',
      status:
        totalImages === 0
          ? Status.NOT_APPLICABLE
          : statusFromRatio(altRatio, { passAt: 0.9, warnAt: 0.6 }),
      ratio: altRatio,
      maxPoints: 3,
      evidence: {
        totalImages,
        imagesWithAltText: pages.reduce((sum, p) => sum + p.imagesWithAlt, 0),
        decorativeImages: pages.reduce((sum, p) => sum + p.imagesWithEmptyAlt, 0),
        coverage: totalImages === 0 ? null : `${Math.round(altRatio * 100)}%`,
      },
      explanation:
        'Alt text is the only textual description of an image available to a text-based model, and it is also an accessibility requirement.',
      recommendedAction:
        altRatio >= 0.9
          ? 'No action needed.'
          : 'Add descriptive alt text to meaningful images and empty alt="" to purely decorative ones.',
      effort: Effort.MEDIUM,
      impact: Impact.LOW,
    }),
  );

  // --- Crawl success rate ------------------------------------------------
  const attempted = pages.length + ctx.failedPages.length;
  const successRatio = attempted > 0 ? pages.length / attempted : 0;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'tech.crawl-success',
      title: 'Pages could be crawled without errors',
      status: statusFromRatio(successRatio, { passAt: 0.9, warnAt: 0.6 }),
      ratio: successRatio,
      maxPoints: 5,
      evidence: {
        pagesCrawled: pages.length,
        pagesAttempted: attempted,
        failures: ctx.failedPages.slice(0, 5),
      },
      explanation:
        'Pages that time out, error or return unreadable content cannot contribute anything to how an AI system understands the business.',
      recommendedAction:
        successRatio >= 0.9
          ? 'No action needed.'
          : 'Review the failing URLs in the evidence — server errors, aggressive bot filtering and slow responses all reduce what AI crawlers can read.',
      effort: Effort.MEDIUM,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Response speed ----------------------------------------------------
  const avgMs =
    pages.length > 0 ? pages.reduce((sum, p) => sum + p.fetchMs, 0) / pages.length : 0;
  const speedRatio =
    avgMs === 0 ? 0 : avgMs <= 800 ? 1 : avgMs <= 1800 ? 0.7 : avgMs <= 3500 ? 0.4 : 0.1;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'tech.response-time',
      title: 'Server responds quickly to crawlers',
      status:
        pages.length === 0
          ? Status.NOT_APPLICABLE
          : avgMs <= 1800
            ? Status.PASS
            : avgMs <= 3500
              ? Status.WARN
              : Status.FAIL,
      ratio: speedRatio,
      maxPoints: 3,
      evidence: {
        averageResponseMs: Math.round(avgMs),
        slowestPage: pages.reduce<{ url: string; ms: number } | null>(
          (slowest, p) => (!slowest || p.fetchMs > slowest.ms ? { url: p.finalUrl, ms: p.fetchMs } : slowest),
          null,
        ),
        note: 'Measured from this audit run and affected by network conditions.',
      },
      explanation:
        'Slow responses reduce how much of a site a crawler will fetch in one visit. Measured here as time to first byte plus body transfer from our servers.',
      recommendedAction:
        avgMs <= 1800
          ? 'No action needed.'
          : 'Improve server response time through caching, a CDN or lighter server-rendered pages.',
      effort: Effort.HIGH,
      impact: Impact.LOW,
    }),
  );

  // --- Content volume reachable -----------------------------------------
  const reachableRatio = scaleToTarget(pages.length, Math.min(ctx.pageLimit, 6));
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'tech.discoverable-pages',
      title: 'Enough distinct pages are discoverable',
      status: pages.length >= 5 ? Status.PASS : pages.length >= 2 ? Status.WARN : Status.FAIL,
      ratio: reachableRatio,
      maxPoints: 4,
      evidence: {
        pagesDiscovered: pages.length,
        pageLimitForPlan: ctx.pageLimit,
        rolesFound: [...new Set(pages.map((p) => p.role))],
      },
      explanation:
        'A site that exposes only one or two crawlable pages gives an answer engine very little to work with, no matter how good that content is.',
      recommendedAction:
        pages.length >= 5
          ? 'No action needed.'
          : 'Make sure key pages (about, services, contact, FAQ) are linked from the main navigation so crawlers can find them.',
      effort: Effort.MEDIUM,
      impact: Impact.MEDIUM,
    }),
  );

  return checks;
}
