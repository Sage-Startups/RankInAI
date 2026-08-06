import { AuditCategory, PageRole } from '@prisma/client';

import type { AuditContext, CheckResult } from '@/lib/audit/types';
import {
  Effort,
  Impact,
  Status,
  makeCheck,
  scaleToTarget,
  statusFromRatio,
} from '@/lib/audit/checks/helpers';

const CATEGORY = AuditCategory.CONTENT_AUTHORITY;

/**
 * Content Authority — is there enough original, specific, expert content for a
 * model to treat this site as a source rather than a brochure?
 *
 * Total available points: 66.
 */
export function runContentChecks(ctx: AuditContext): CheckResult[] {
  const checks: CheckResult[] = [];
  const { pages, homepage } = ctx;

  const totalWords = pages.reduce((sum, p) => sum + p.wordCount, 0);
  const avgWords = pages.length > 0 ? totalWords / pages.length : 0;
  const allText = pages.map((p) => p.mainTextExcerpt).join(' ');

  // --- Average content depth --------------------------------------------
  const depthRatio =
    avgWords >= 800
      ? 1
      : avgWords >= 500
        ? 0.8
        : avgWords >= 300
          ? 0.55
          : avgWords >= 150
            ? 0.3
            : 0.1;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'content.average-depth',
      title: 'Pages contain enough substantive text',
      status: avgWords >= 500 ? Status.PASS : avgWords >= 250 ? Status.WARN : Status.FAIL,
      ratio: depthRatio,
      maxPoints: 9,
      evidence: {
        averageWordsPerPage: Math.round(avgWords),
        totalWordsCrawled: totalWords,
        thinnestPages: [...pages]
          .sort((a, b) => a.wordCount - b.wordCount)
          .slice(0, 5)
          .map((p) => ({ url: p.finalUrl, words: p.wordCount })),
      },
      explanation:
        'Retrieval systems select passages, not pages. Very short pages rarely contain a passage long enough to answer a question on its own, so they are seldom cited.',
      recommendedAction:
        avgWords >= 500
          ? 'No action needed.'
          : 'Expand your thinnest pages so each covers its topic fully — what it is, who it is for, how it works, what it costs and what to do next.',
      effort: Effort.HIGH,
      impact: Impact.HIGH,
    }),
  );

  // --- Thin page count ---------------------------------------------------
  const thinPages = pages.filter((p) => p.wordCount < 150);
  const thinRatio = pages.length > 0 ? 1 - thinPages.length / pages.length : 0;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'content.thin-pages',
      title: 'Few pages are effectively empty',
      status: thinPages.length === 0 ? Status.PASS : thinRatio >= 0.75 ? Status.WARN : Status.FAIL,
      ratio: thinRatio,
      maxPoints: 6,
      evidence: {
        thinPageCount: thinPages.length,
        totalPages: pages.length,
        examples: thinPages.slice(0, 5).map((p) => ({ url: p.finalUrl, words: p.wordCount })),
        threshold: '150 words',
      },
      explanation:
        'Pages with almost no text dilute the site overall. They consume crawl budget and give models nothing quotable.',
      recommendedAction:
        thinPages.length === 0
          ? 'No action needed.'
          : 'Fill out, merge or remove the near-empty pages listed in the evidence.',
      effort: Effort.MEDIUM,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Editorial / resource content -------------------------------------
  const articlePages = pages.filter(
    (p) =>
      p.role === PageRole.ARTICLE ||
      p.role === PageRole.BLOG_INDEX ||
      p.role === PageRole.CASE_STUDY,
  );
  const articleRatio = scaleToTarget(articlePages.length, 3);
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'content.editorial-presence',
      title: 'Site publishes explanatory or educational content',
      status:
        articlePages.length >= 3
          ? Status.PASS
          : articlePages.length >= 1
            ? Status.WARN
            : Status.FAIL,
      ratio: articleRatio,
      maxPoints: 8,
      evidence: {
        editorialPagesFound: articlePages
          .map((p) => ({ url: p.finalUrl, role: p.role }))
          .slice(0, 10),
        count: articlePages.length,
      },
      explanation:
        'Sales pages answer "buy from us". Explanatory content answers the questions people actually type — which is what generative systems retrieve when composing an answer.',
      recommendedAction:
        articlePages.length >= 3
          ? 'No action needed — keep publishing on the questions your customers ask.'
          : 'Publish guides or explainers that answer the real questions your customers ask before they buy.',
      effort: Effort.HIGH,
      impact: Impact.HIGH,
    }),
  );

  // --- Factual specificity ----------------------------------------------
  const dataPoints = pages.reduce((sum, p) => sum + p.factualDataPoints, 0);
  const specificityRatio = scaleToTarget(dataPoints, Math.max(6, pages.length * 2));
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'content.factual-specificity',
      title: 'Content contains concrete facts and figures',
      status: statusFromRatio(specificityRatio, { passAt: 0.7, warnAt: 0.3 }),
      ratio: specificityRatio,
      maxPoints: 7,
      evidence: {
        factualDataPointsFound: dataPoints,
        pagesScanned: pages.length,
        note: 'Counts numbers paired with units, currency, percentages, durations or quantities.',
      },
      explanation:
        'Specific figures — years in business, project counts, response times, prices, measurements — give a model something concrete to quote. Purely qualitative copy is rarely worth citing.',
      recommendedAction:
        specificityRatio >= 0.7
          ? 'No action needed.'
          : 'Replace vague claims with specific numbers: how many projects, how many years, typical turnaround, actual price ranges.',
      effort: Effort.MEDIUM,
      impact: Impact.HIGH,
    }),
  );

  // --- Vague marketing language ------------------------------------------
  const vagueHits = [...new Set(pages.flatMap((p) => p.vaguePhrases))];
  const vagueRatio =
    vagueHits.length === 0 ? 1 : vagueHits.length <= 2 ? 0.65 : vagueHits.length <= 4 ? 0.35 : 0;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'content.vague-language',
      title: 'Copy avoids empty marketing filler',
      status:
        vagueHits.length === 0 ? Status.PASS : vagueHits.length <= 2 ? Status.WARN : Status.FAIL,
      ratio: vagueRatio,
      maxPoints: 5,
      evidence: {
        phrasesFound: vagueHits.slice(0, 10),
        count: vagueHits.length,
      },
      explanation:
        'Phrases like "world-class" and "cutting-edge" carry no retrievable information. They occupy the space where a specific, quotable statement could sit.',
      recommendedAction:
        vagueHits.length === 0
          ? 'No action needed.'
          : `Rewrite the phrases listed in the evidence into specific claims. For example, replace "industry-leading response times" with "we respond to service calls within 4 business hours."`,
      effort: Effort.MEDIUM,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Unsupported superlatives ------------------------------------------
  const superlativeHits = [...new Set(pages.flatMap((p) => p.superlatives))];
  const superRatio = superlativeHits.length === 0 ? 1 : superlativeHits.length <= 2 ? 0.6 : 0.2;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'content.unsupported-superlatives',
      title: 'Claims are not built on unsupported superlatives',
      status:
        superlativeHits.length === 0
          ? Status.PASS
          : superlativeHits.length <= 2
            ? Status.WARN
            : Status.FAIL,
      ratio: superRatio,
      maxPoints: 4,
      evidence: {
        superlativesFound: superlativeHits.slice(0, 10),
        count: superlativeHits.length,
      },
      explanation:
        'Unbacked superlatives ("the best", "#1") are treated as promotional noise. A model will not repeat them as fact, and their presence lowers the perceived reliability of surrounding claims.',
      recommendedAction:
        superlativeHits.length === 0
          ? 'No action needed.'
          : 'Either support each superlative with a verifiable source and date, or replace it with the underlying fact.',
      effort: Effort.LOW,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Content freshness -------------------------------------------------
  const dated = pages.filter((p) => p.publishedDate || p.modifiedDate);
  const parsedDates = dated
    .map((p) => new Date(p.modifiedDate ?? p.publishedDate ?? ''))
    .filter((d) => !Number.isNaN(d.getTime()));
  const newest =
    parsedDates.length > 0 ? new Date(Math.max(...parsedDates.map((d) => d.getTime()))) : null;
  const monthsSince = newest ? (Date.now() - newest.getTime()) / (1000 * 60 * 60 * 24 * 30) : null;
  const freshRatio =
    monthsSince == null
      ? 0
      : monthsSince <= 6
        ? 1
        : monthsSince <= 12
          ? 0.7
          : monthsSince <= 24
            ? 0.4
            : 0.15;

  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'content.freshness',
      title: 'Content carries visible dates and is kept current',
      status:
        monthsSince == null
          ? Status.FAIL
          : monthsSince <= 12
            ? Status.PASS
            : monthsSince <= 24
              ? Status.WARN
              : Status.FAIL,
      ratio: freshRatio,
      maxPoints: 6,
      evidence: {
        pagesWithDates: dated.length,
        totalPages: pages.length,
        mostRecentDate: newest ? newest.toISOString().slice(0, 10) : null,
        monthsSinceMostRecent: monthsSince == null ? null : Math.round(monthsSince),
      },
      explanation:
        'Visible publication and update dates let a system judge whether a passage is still current. Undated content is frequently down-weighted for anything time-sensitive.',
      recommendedAction:
        monthsSince != null && monthsSince <= 12
          ? 'No action needed — keep refreshing key pages.'
          : 'Show a published or last-updated date on substantive pages, and refresh the ones that have not been touched in over a year.',
      effort: Effort.MEDIUM,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Internal linking depth -------------------------------------------
  const avgInternalLinks =
    pages.length > 0 ? pages.reduce((sum, p) => sum + p.internalLinks, 0) / pages.length : 0;
  const linkRatio =
    avgInternalLinks >= 15 ? 1 : avgInternalLinks >= 8 ? 0.75 : avgInternalLinks >= 4 ? 0.45 : 0.15;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'content.internal-linking',
      title: 'Pages are connected by internal links',
      status:
        avgInternalLinks >= 8 ? Status.PASS : avgInternalLinks >= 4 ? Status.WARN : Status.FAIL,
      ratio: linkRatio,
      maxPoints: 5,
      evidence: {
        averageInternalLinksPerPage: Math.round(avgInternalLinks),
        leastLinkedPages: [...pages]
          .sort((a, b) => a.internalLinks - b.internalLinks)
          .slice(0, 4)
          .map((p) => ({ url: p.finalUrl, internalLinks: p.internalLinks })),
      },
      explanation:
        'Internal links tell a crawler which pages relate to each other and which are important. Sparse linking leaves pages isolated and rarely retrieved.',
      recommendedAction:
        avgInternalLinks >= 8
          ? 'No action needed.'
          : 'Add contextual links between related service, guide and FAQ pages using descriptive anchor text.',
      effort: Effort.MEDIUM,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Heading structure quality ----------------------------------------
  const validHierarchy = pages.filter((p) => p.headingHierarchyValid).length;
  const singleH1 = pages.filter((p) => p.h1.length === 1).length;
  const headingRatio =
    pages.length > 0 ? (validHierarchy / pages.length) * 0.5 + (singleH1 / pages.length) * 0.5 : 0;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'content.heading-structure',
      title: 'Headings form a clean, single-H1 hierarchy',
      status: statusFromRatio(headingRatio, { passAt: 0.8, warnAt: 0.5 }),
      ratio: headingRatio,
      maxPoints: 5,
      evidence: {
        pagesWithValidHierarchy: validHierarchy,
        pagesWithExactlyOneH1: singleH1,
        totalPages: pages.length,
        problems: pages
          .filter((p) => p.h1.length !== 1 || !p.headingHierarchyValid)
          .slice(0, 5)
          .map((p) => ({
            url: p.finalUrl,
            h1Count: p.h1.length,
            validHierarchy: p.headingHierarchyValid,
          })),
      },
      explanation:
        'Headings are how a document is split into retrievable chunks. A broken hierarchy or multiple H1s produces chunks that do not match the topics on the page.',
      recommendedAction:
        headingRatio >= 0.8
          ? 'No action needed.'
          : 'Use exactly one H1 per page and nest H2/H3 headings without skipping levels.',
      effort: Effort.MEDIUM,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Original evidence / proof -----------------------------------------
  const proofSignals = {
    caseStudies: pages.filter((p) => p.role === PageRole.CASE_STUDY).length,
    testimonialLanguage:
      /\b(testimonial|review|client said|what our customers say|rated \d)\b/i.test(allText),
    originalData:
      /\b(our (data|research|survey|study|analysis)|we (surveyed|analyzed|measured|tested))\b/i.test(
        allText,
      ),
    projectCounts: /\b\d{2,}\s*(projects?|installations?|clients?|customers?|homes?|jobs?)\b/i.test(
      allText,
    ),
  };
  const proofCount = Object.values(proofSignals).filter(Boolean).length;
  const proofRatio = proofCount / 4;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'content.first-party-evidence',
      title: 'Site presents first-party evidence and proof',
      status: proofCount >= 3 ? Status.PASS : proofCount >= 1 ? Status.WARN : Status.FAIL,
      ratio: proofRatio,
      maxPoints: 7,
      evidence: proofSignals,
      explanation:
        'Original data, case studies and verifiable customer proof are what distinguish a source worth citing from a page that only restates common knowledge.',
      recommendedAction:
        proofCount >= 3
          ? 'No action needed.'
          : 'Publish at least a few detailed case studies with real numbers, and add named customer results where you have permission to share them.',
      effort: Effort.HIGH,
      impact: Impact.HIGH,
    }),
  );

  // --- Duplicated body content -------------------------------------------
  // Two signals: a repeated block of body prose, and a repeated opening
  // paragraph. The second is what catches templated location and service pages,
  // where only the boilerplate intro is shared.
  const excerpts = pages.map((p) => p.mainTextExcerpt.slice(0, 500)).filter((e) => e.length > 100);
  const uniqueExcerpts = new Set(excerpts);
  const excerptRatio = excerpts.length > 0 ? uniqueExcerpts.size / excerpts.length : 1;

  const openings = pages.map((p) => p.firstParagraph.trim()).filter((p) => p.length > 60);
  const uniqueOpenings = new Set(openings);
  const openingRatio = openings.length > 0 ? uniqueOpenings.size / openings.length : 1;

  const repeatedOpenings = [...new Set(openings.filter((o, i) => openings.indexOf(o) !== i))];
  const uniqueRatio = Math.min(excerptRatio, openingRatio);
  const comparable = Math.max(excerpts.length, openings.length);

  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'content.duplication',
      title: 'Pages do not repeat the same body copy',
      status:
        comparable < 2
          ? Status.NOT_APPLICABLE
          : statusFromRatio(uniqueRatio, { passAt: 0.95, warnAt: 0.75 }),
      ratio: uniqueRatio,
      maxPoints: 4,
      evidence: {
        pagesCompared: comparable,
        distinctBodyOpenings: uniqueExcerpts.size,
        distinctFirstParagraphs: uniqueOpenings.size,
        repeatedFirstParagraphs: repeatedOpenings.map((o) => o.slice(0, 160)).slice(0, 3),
        note: 'Compares the first 500 characters of body prose and the first paragraph of each page.',
      },
      explanation:
        'Near-identical copy across pages (common on templated location or service pages) causes retrieval systems to treat them as one page and pick a single arbitrary winner.',
      recommendedAction:
        uniqueRatio >= 0.95
          ? 'No action needed.'
          : repeatedOpenings.length > 0
            ? 'Several pages open with an identical paragraph. Rewrite each opening so it states what that specific page covers — the first paragraph is the passage most likely to be extracted as an answer.'
            : 'Rewrite templated pages so each contains genuinely different detail relevant to its specific topic or location.',
      effort: Effort.HIGH,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Homepage substance -------------------------------------------------
  const homeWords = homepage?.wordCount ?? 0;
  const homeRatio = homeWords >= 600 ? 1 : homeWords >= 350 ? 0.75 : homeWords >= 150 ? 0.4 : 0.1;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'content.homepage-substance',
      title: 'Homepage carries real explanatory copy',
      status: homeWords >= 350 ? Status.PASS : homeWords >= 150 ? Status.WARN : Status.FAIL,
      ratio: homeRatio,
      maxPoints: 5,
      evidence: {
        homepageWordCount: homeWords,
        paragraphCount: homepage?.paragraphCount ?? 0,
        url: homepage?.finalUrl ?? null,
      },
      explanation:
        'The homepage is the page most likely to be fetched first. A design-heavy homepage with almost no text gives a model little to summarize the business from.',
      recommendedAction:
        homeWords >= 350
          ? 'No action needed.'
          : 'Add several paragraphs of real prose to the homepage covering what you do, who you serve, where you operate and what makes your approach specific.',
      effort: Effort.MEDIUM,
      impact: Impact.HIGH,
      pageUrl: homepage?.finalUrl ?? null,
    }),
  );

  return checks;
}
