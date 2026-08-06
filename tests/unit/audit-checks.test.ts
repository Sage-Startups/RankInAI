import { AuditCategory, FindingStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { analyzeHtml, crawlPriority, extractCrawlCandidates } from '@/lib/audit/parse';
import { isPathAllowed, matchesRobotsPattern, parseRobotsTxt } from '@/lib/audit/robots';
import { runAllChecks, competitorQuickScore } from '@/lib/audit/checks';
import { aggregateScores } from '@/lib/audit/scoring';
import {
  deriveStrengths,
  deriveWeaknesses,
  generateRecommendations,
  groupByHorizon,
} from '@/lib/audit/recommendations';
import type { AuditContext } from '@/lib/audit/types';
import { FIXTURE_PAGES, FIXTURE_ORIGIN } from '../fixtures/site';

const ORIGIN = 'https://example.com';

function analyze(html: string, url = `${ORIGIN}/`) {
  return analyzeHtml({
    url,
    finalUrl: url,
    html,
    statusCode: 200,
    contentType: 'text/html',
    bytes: html.length,
    fetchMs: 120,
    isHttps: url.startsWith('https'),
    redirectChain: [],
    siteOrigin: ORIGIN,
  });
}

function context(overrides: Partial<AuditContext> = {}): AuditContext {
  const homepage = overrides.homepage ?? analyze('<html lang="en"><head><title>T</title></head><body><h1>H</h1></body></html>');
  return {
    auditId: 'test-audit',
    siteOrigin: ORIGIN,
    requestedUrl: ORIGIN,
    businessName: 'Example Co',
    industry: null,
    targetCountry: 'United States',
    targetAudience: null,
    primaryServices: null,
    businessLocation: null,
    homepage,
    pages: overrides.pages ?? [homepage],
    failedPages: [],
    robots: {
      found: true,
      statusCode: 200,
      rules: [],
      sitemaps: [],
      crawlDelaySeconds: null,
      hasAgentSpecificGroup: false,
      blocksEverything: false,
      blockedAiAgents: [],
      raw: null,
      error: null,
    },
    sitemap: { found: true, url: `${ORIGIN}/sitemap.xml`, urlCount: 10, isIndex: false, error: null },
    llmsTxt: { found: false, url: null, bytes: 0, mentionsSections: false },
    competitors: [],
    competitorsRequested: 0,
    searchObservations: [],
    searchEnabled: false,
    pageLimit: 10,
    brokenInternalLinks: [],
    ...overrides,
  };
}

describe('analyzeHtml', () => {
  const html = `<!doctype html>
<html lang="en-US">
<head>
  <title>Roof Repair in Denver, CO | Atlas Roofing</title>
  <meta name="description" content="Emergency and scheduled roof repair across the Denver metro area, with free written estimates.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="${ORIGIN}/">
  <meta property="og:title" content="Roof Repair">
  <meta property="og:description" content="Roof repair in Denver">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Atlas Roofing","url":"${ORIGIN}","telephone":"+1-303-555-0142","sameAs":["https://example.org/profile"]}</script>
</head>
<body>
  <h1>Roof repair in Denver</h1>
  <h2>How much does a roof replacement cost?</h2>
  <p>A standard asphalt shingle replacement on a 2,000 sq ft home runs $9,500 to $16,000 as of 2026. Steeper pitches increase that range considerably for most homeowners in the metro area.</p>
  <h2>What is ice damming?</h2>
  <p>Ice damming is a ridge of ice that forms at the roof edge and prevents melting snow from draining away properly from the structure.</p>
  <ul><li>Roof replacement</li><li>Storm damage repair</li></ul>
  <table><tr><td>Service</td><td>Price</td></tr></table>
  <img src="/a.jpg" alt="A roofing crew at work">
  <img src="/b.jpg">
  <img src="/spacer.gif" alt="">
  <a href="/about">About us</a>
  <a href="/services">Services</a>
  <a href="https://www.iccsafe.org/codes">the 2021 International Residential Code</a>
  <address>4820 Kalamath St, Denver, CO 80211</address>
  <p>Call (303) 555-0142 or email hello@example.com. We are the best roofers and a world-class team.</p>
</body></html>`;

  const signals = analyze(html);

  it('extracts core metadata', () => {
    expect(signals.title).toBe('Roof Repair in Denver, CO | Atlas Roofing');
    expect(signals.metaDescriptionLength).toBeGreaterThan(50);
    expect(signals.canonical).toBe(`${ORIGIN}/`);
    expect(signals.canonicalIsSelf).toBe(true);
    expect(signals.langAttr).toBe('en-US');
    expect(signals.viewport).toContain('width=device-width');
  });

  it('extracts a single H1 and a valid heading hierarchy', () => {
    expect(signals.h1).toEqual(['Roof repair in Denver']);
    expect(signals.headingHierarchyValid).toBe(true);
  });

  it('detects question-shaped headings', () => {
    expect(signals.questionHeadings.length).toBe(2);
    expect(signals.questionHeadings[0]).toContain('How much');
  });

  it('parses JSON-LD and collects schema types and properties', () => {
    expect(signals.schemaTypes).toContain('LocalBusiness');
    expect(signals.jsonLd[0]?.valid).toBe(true);
    expect(signals.jsonLd[0]?.values.name).toBe('Atlas Roofing');
    expect(signals.jsonLd[0]?.properties).toContain('sameAs');
  });

  it('counts images and alt coverage correctly', () => {
    expect(signals.imageCount).toBe(3);
    expect(signals.imagesWithAlt).toBe(1);
    expect(signals.imagesWithEmptyAlt).toBe(1);
  });

  it('separates internal from external links', () => {
    expect(signals.internalLinks).toBe(2);
    expect(signals.externalLinks).toBe(1);
    expect(signals.externalDomains).toContain('iccsafe.org');
  });

  it('extracts contact signals', () => {
    expect(signals.emails).toContain('hello@example.com');
    expect(signals.phones.length).toBeGreaterThan(0);
    expect(signals.addressSignals.join(' ')).toContain('Denver');
    expect(signals.hasContactSignals).toBe(true);
  });

  it('flags vague language and unsupported superlatives', () => {
    expect(signals.vaguePhrases).toContain('world-class');
    expect(signals.superlatives).toContain('the best');
  });

  it('counts concrete factual data points', () => {
    expect(signals.factualDataPoints).toBeGreaterThan(0);
  });

  it('detects lists and tables', () => {
    expect(signals.listCount).toBeGreaterThanOrEqual(1);
    expect(signals.tableCount).toBe(1);
  });

  it('records invalid JSON-LD rather than throwing', () => {
    const broken = analyze(
      '<html><head><script type="application/ld+json">{ not valid json }</script></head><body><h1>x</h1></body></html>',
    );
    expect(broken.jsonLd).toHaveLength(1);
    expect(broken.jsonLd[0]?.valid).toBe(false);
    expect(broken.jsonLd[0]?.parseError).toBeTruthy();
  });

  it('detects noindex directives', () => {
    const noindex = analyze(
      '<html><head><meta name="robots" content="noindex, nofollow"><title>x</title></head><body><h1>x</h1></body></html>',
    );
    expect(noindex.isIndexable).toBe(false);
    expect(noindex.noindexReason).toContain('noindex');
  });

  it('ignores script and style content when counting words', () => {
    const withScript = analyze(
      `<html><head><title>x</title></head><body><h1>x</h1><script>var a = "${'word '.repeat(500)}";</script><p>Only these words count here.</p></body></html>`,
    );
    expect(withScript.wordCount).toBeLessThan(30);
  });

  it('is deterministic', () => {
    const a = analyze(html);
    const b = analyze(html);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('crawl candidate selection', () => {
  const html = `<html><head><title>x</title></head><body><h1>x</h1>
    <a href="/about">About</a>
    <a href="/services/roofing">Services</a>
    <a href="/cart">Cart</a>
    <a href="/checkout">Checkout</a>
    <a href="/my-account">Account</a>
    <a href="/wp-login.php">Login</a>
    <a href="/brochure.pdf">PDF</a>
    <a href="/page?utm_source=x">Parameterized</a>
    <a href="https://external.com/page">External</a>
    <a href="/blog/post-one">Article</a>
  </body></html>`;

  const candidates = extractCrawlCandidates(analyze(html), ORIGIN);

  it('includes useful internal pages', () => {
    expect(candidates).toContain(`${ORIGIN}/about`);
    expect(candidates).toContain(`${ORIGIN}/services/roofing`);
    expect(candidates).toContain(`${ORIGIN}/blog/post-one`);
  });

  it('excludes cart, checkout, account and login URLs', () => {
    expect(candidates.some((c) => c.includes('/cart'))).toBe(false);
    expect(candidates.some((c) => c.includes('/checkout'))).toBe(false);
    expect(candidates.some((c) => c.includes('/my-account'))).toBe(false);
    expect(candidates.some((c) => c.includes('wp-login'))).toBe(false);
  });

  it('excludes non-HTML files, parameterized URLs and external links', () => {
    expect(candidates.some((c) => c.endsWith('.pdf'))).toBe(false);
    expect(candidates.some((c) => c.includes('utm_source'))).toBe(false);
    expect(candidates.some((c) => c.includes('external.com'))).toBe(false);
  });

  it('prioritizes the pages that matter most for GEO', () => {
    expect(crawlPriority(`${ORIGIN}/`)).toBeLessThan(crawlPriority(`${ORIGIN}/about`));
    expect(crawlPriority(`${ORIGIN}/about`)).toBeLessThan(crawlPriority(`${ORIGIN}/services`));
    expect(crawlPriority(`${ORIGIN}/faq`)).toBeLessThan(crawlPriority(`${ORIGIN}/blog/deep/post`));
  });
});

describe('robots.txt parsing', () => {
  it('parses agent groups, rules and sitemaps', () => {
    const { groups, sitemaps } = parseRobotsTxt(`
User-agent: *
Disallow: /admin
Allow: /admin/public

User-agent: GPTBot
Disallow: /

Sitemap: https://example.com/sitemap.xml
`);
    expect(groups).toHaveLength(2);
    expect(sitemaps).toEqual(['https://example.com/sitemap.xml']);
  });

  it('ignores comments', () => {
    const { groups } = parseRobotsTxt('# a comment\nUser-agent: *\nDisallow: /private # trailing');
    expect(groups[0]?.rules[0]?.path).toBe('/private');
  });

  describe('path matching', () => {
    it.each([
      ['/admin', '/admin/users', true],
      ['/admin', '/administrator', true],
      ['/admin$', '/admin', true],
      ['/admin$', '/admin/users', false],
      ['/*.pdf$', '/files/report.pdf', true],
      ['/*.pdf$', '/files/report.html', false],
      ['/', '/anything', true],
    ])('pattern %s vs path %s → %s', (pattern, path, expected) => {
      expect(matchesRobotsPattern(pattern, path)).toBe(expected);
    });
  });

  it('lets the longest matching rule win', () => {
    const robots = {
      found: true,
      statusCode: 200,
      rules: [
        { type: 'disallow' as const, path: '/admin' },
        { type: 'allow' as const, path: '/admin/public' },
      ],
      sitemaps: [],
      crawlDelaySeconds: null,
      hasAgentSpecificGroup: false,
      blocksEverything: false,
      blockedAiAgents: [],
      raw: null,
      error: null,
    };

    expect(isPathAllowed(robots, '/admin/secret')).toBe(false);
    expect(isPathAllowed(robots, '/admin/public/page')).toBe(true);
    expect(isPathAllowed(robots, '/blog')).toBe(true);
  });

  it('allows everything when robots.txt was not found', () => {
    const robots = {
      found: false,
      statusCode: 404,
      rules: [],
      sitemaps: [],
      crawlDelaySeconds: null,
      hasAgentSpecificGroup: false,
      blocksEverything: false,
      blockedAiAgents: [],
      raw: null,
      error: null,
    };
    expect(isPathAllowed(robots, '/anything')).toBe(true);
  });
});

describe('runAllChecks', () => {
  it('produces a stable, unique set of check ids', () => {
    const checks = runAllChecks(context());
    const ids = checks.map((c) => c.checkId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(checks.length).toBeGreaterThan(60);
  });

  it('is deterministic for identical input', () => {
    const ctx = context();
    const a = runAllChecks(ctx);
    const b = runAllChecks(ctx);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('omits Competitive Visibility entirely when no competitor was supplied', () => {
    const checks = runAllChecks(context({ competitorsRequested: 0, competitors: [] }));
    const competitive = checks.filter((c) => c.category === AuditCategory.COMPETITIVE_VISIBILITY);
    expect(competitive).toHaveLength(0);

    const scored = aggregateScores(checks);
    const category = scored.categories.find(
      (c) => c.category === AuditCategory.COMPETITIVE_VISIBILITY,
    );
    expect(category?.available).toBe(false);
    expect(category?.effectiveWeight).toBe(0);
  });

  it('marks Competitive Visibility not-applicable when competitors could not be fetched', () => {
    const checks = runAllChecks(
      context({
        competitorsRequested: 1,
        competitors: [
          {
            url: 'https://competitor.example',
            name: null,
            ok: false,
            error: 'Could not connect',
            signals: null,
            quickScore: null,
            categoryScores: null,
            highlights: [],
            gaps: [],
          },
        ],
      }),
    );
    const competitive = checks.filter((c) => c.category === AuditCategory.COMPETITIVE_VISIBILITY);
    expect(competitive).toHaveLength(1);
    expect(competitive[0]?.status).toBe(FindingStatus.NOT_APPLICABLE);
    expect(competitive[0]?.applicable).toBe(false);
  });

  it('scores a well-built page higher than a bare one', () => {
    const rich = analyze(FIXTURE_PAGES[0]!.body.replace(new RegExp(FIXTURE_ORIGIN, 'g'), ORIGIN));
    const bare = analyze('<html><head></head><body><p>hi</p></body></html>');

    const richScore = aggregateScores(runAllChecks(context({ homepage: rich, pages: [rich] })))
      .overallScore;
    const bareScore = aggregateScores(runAllChecks(context({ homepage: bare, pages: [bare] })))
      .overallScore;

    expect(richScore).toBeGreaterThan(bareScore);
  });

  it('never awards more points than are possible', () => {
    const checks = runAllChecks(context());
    for (const check of checks) {
      expect(check.points).toBeLessThanOrEqual(check.maxPoints + 1e-6);
      expect(check.points).toBeGreaterThanOrEqual(0);
    }
  });

  it('records evidence on every check', () => {
    for (const check of runAllChecks(context())) {
      expect(check.evidence).toBeTypeOf('object');
      expect(check.explanation.length).toBeGreaterThan(20);
      expect(check.recommendedAction.length).toBeGreaterThan(5);
    }
  });
});

describe('competitorQuickScore', () => {
  const strong = analyze(FIXTURE_PAGES[0]!.body.replace(new RegExp(FIXTURE_ORIGIN, 'g'), ORIGIN));
  const weak = analyze('<html><body><p>hello</p></body></html>');

  it('scores a rich homepage above a bare one', () => {
    expect(competitorQuickScore(strong)).toBeGreaterThan(competitorQuickScore(weak));
  });

  it('stays inside 0-100', () => {
    expect(competitorQuickScore(strong)).toBeLessThanOrEqual(100);
    expect(competitorQuickScore(weak)).toBeGreaterThanOrEqual(0);
  });

  it('is deterministic', () => {
    expect(competitorQuickScore(strong)).toBe(competitorQuickScore(strong));
  });
});

describe('recommendation generation', () => {
  const checks = runAllChecks(context());
  const recommendations = generateRecommendations(checks);

  it('creates one recommendation per failing or partial check', () => {
    const actionable = checks.filter(
      (c) => c.applicable && (c.status === 'FAIL' || c.status === 'WARN'),
    );
    expect(recommendations).toHaveLength(actionable.length);
  });

  it('never creates a recommendation for a passing check', () => {
    const passingIds = new Set(checks.filter((c) => c.status === 'PASS').map((c) => c.checkId));
    for (const rec of recommendations) {
      for (const id of rec.relatedCheckIds) {
        expect(passingIds.has(id)).toBe(false);
      }
    }
  });

  it('numbers priorities consecutively from 1', () => {
    recommendations.forEach((rec, index) => {
      expect(rec.priority).toBe(index + 1);
    });
  });

  it('orders by severity, then impact, then effort', () => {
    const severityRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFORMATIONAL: 4, PASSED: 5 };
    const byId = new Map(checks.map((c) => [c.checkId, c]));

    for (let i = 1; i < recommendations.length; i += 1) {
      const previous = byId.get(recommendations[i - 1]!.relatedCheckIds[0]!)!;
      const current = byId.get(recommendations[i]!.relatedCheckIds[0]!)!;
      expect(severityRank[previous.severity]).toBeLessThanOrEqual(severityRank[current.severity]);
    }
  });

  it('is deterministic across runs', () => {
    const again = generateRecommendations(checks);
    expect(JSON.stringify(recommendations)).toBe(JSON.stringify(again));
  });

  it('groups into exactly three horizons', () => {
    const grouped = groupByHorizon(recommendations);
    expect(Object.keys(grouped).sort()).toEqual(['DO_FIRST', 'LONGER_TERM', 'NEXT_30_DAYS']);
    const total =
      grouped.DO_FIRST.length + grouped.NEXT_30_DAYS.length + grouped.LONGER_TERM.length;
    expect(total).toBe(recommendations.length);
  });

  it('puts every critical finding in Do first', () => {
    const byId = new Map(checks.map((c) => [c.checkId, c]));
    for (const rec of recommendations) {
      const check = byId.get(rec.relatedCheckIds[0]!);
      if (check?.severity === 'CRITICAL') {
        expect(rec.horizon).toBe('DO_FIRST');
      }
    }
  });

  it('gives every recommendation the required fields', () => {
    for (const rec of recommendations) {
      expect(rec.title.length).toBeGreaterThan(3);
      expect(rec.whyItMatters.length).toBeGreaterThan(20);
      expect(rec.recommendedChange.length).toBeGreaterThan(5);
      expect(rec.expectedImpact.length).toBeGreaterThan(10);
    }
  });
});

describe('strength and weakness derivation', () => {
  it('returns at most the requested number of items', () => {
    const checks = runAllChecks(context());
    expect(deriveStrengths(checks, 3).length).toBeLessThanOrEqual(3);
    expect(deriveWeaknesses(checks, 3).length).toBeLessThanOrEqual(3);
  });

  it('lists only passing checks as strengths', () => {
    const rich = analyze(FIXTURE_PAGES[0]!.body.replace(new RegExp(FIXTURE_ORIGIN, 'g'), ORIGIN));
    const checks = runAllChecks(context({ homepage: rich, pages: [rich] }));
    const strengths = deriveStrengths(checks, 5);
    const passingTitles = new Set(checks.filter((c) => c.status === 'PASS').map((c) => c.title));
    for (const strength of strengths) {
      expect(passingTitles.has(strength)).toBe(true);
    }
  });

  it('lists only failing or partial checks as weaknesses', () => {
    const checks = runAllChecks(context());
    const failingTitles = new Set(
      checks.filter((c) => c.status === 'FAIL' || c.status === 'WARN').map((c) => c.title),
    );
    for (const weakness of deriveWeaknesses(checks, 5)) {
      expect(failingTitles.has(weakness)).toBe(true);
    }
  });
});
