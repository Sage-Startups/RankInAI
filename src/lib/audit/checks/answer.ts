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

const CATEGORY = AuditCategory.ANSWER_READINESS;

/**
 * Answer Readiness — how easily can a single passage be lifted from this site
 * and used as a direct answer?
 *
 * Total available points: 58.
 */
export function runAnswerChecks(ctx: AuditContext): CheckResult[] {
  const checks: CheckResult[] = [];
  const { pages, homepage } = ctx;

  const allHeadings = pages.flatMap((p) => p.headings);
  const questionHeadings = pages.flatMap((p) => p.questionHeadings);
  const allText = pages.map((p) => p.mainTextExcerpt).join(' ');

  // --- Question-shaped headings -------------------------------------------
  const questionRatio = scaleToTarget(questionHeadings.length, Math.max(5, pages.length * 2));
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'answer.question-headings',
      title: 'Headings are phrased as real questions',
      status: statusFromRatio(questionRatio, { passAt: 0.7, warnAt: 0.3 }),
      ratio: questionRatio,
      maxPoints: 9,
      evidence: {
        questionHeadingCount: questionHeadings.length,
        totalHeadings: allHeadings.length,
        samples: questionHeadings.slice(0, 8),
      },
      explanation:
        'A heading phrased as the question a customer would ask, followed immediately by the answer, is the single most reliable pattern for producing a retrievable passage.',
      recommendedAction:
        questionRatio >= 0.7
          ? 'No action needed.'
          : 'Convert descriptive subheadings into the questions customers actually ask, then answer each one in the two or three sentences directly beneath it.',
      effort: Effort.MEDIUM,
      impact: Impact.HIGH,
    }),
  );

  // --- FAQ coverage --------------------------------------------------------
  const faqPages = pages.filter((p) => p.role === PageRole.FAQ || p.hasFaqSignals);
  const faqSchema = pages.some((p) => p.schemaTypes.includes('FAQPage'));
  const faqScore = (faqPages.length > 0 ? 0.6 : 0) + (faqSchema ? 0.4 : 0);
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'answer.faq-coverage',
      title: 'Site publishes FAQ content',
      status: faqScore >= 0.9 ? Status.PASS : faqScore > 0 ? Status.WARN : Status.FAIL,
      ratio: faqScore,
      maxPoints: 8,
      evidence: {
        faqPagesFound: faqPages.map((p) => p.finalUrl).slice(0, 5),
        faqPageSchemaPresent: faqSchema,
        questionsDetected: pages.reduce((sum, p) => sum + p.faqQuestionCount, 0),
      },
      explanation:
        'FAQ sections are structurally close to how answer engines want content: one question, one self-contained answer. FAQPage schema makes that structure explicit.',
      recommendedAction:
        faqScore >= 0.9
          ? 'No action needed.'
          : faqPages.length > 0
            ? 'Add FAQPage structured data to your existing FAQ content so the question/answer pairs are machine-readable.'
            : 'Publish an FAQ covering the 10-15 questions customers ask most often, and mark it up with FAQPage schema.',
      effort: Effort.MEDIUM,
      impact: Impact.HIGH,
    }),
  );

  // --- Concise answer passages ---------------------------------------------
  // A good answer paragraph sits roughly between 40 and 120 words.
  const paragraphSamples = pages.map((p) => ({
    url: p.finalUrl,
    paragraphs: p.paragraphCount,
    words: p.wordCount,
    avgParagraphWords: p.paragraphCount > 0 ? Math.round(p.wordCount / p.paragraphCount) : 0,
  }));
  const wellSized = paragraphSamples.filter(
    (s) => s.avgParagraphWords >= 25 && s.avgParagraphWords <= 130,
  ).length;
  const passageRatio = pages.length > 0 ? wellSized / pages.length : 0;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'answer.passage-sizing',
      title: 'Content is broken into extractable passages',
      status: statusFromRatio(passageRatio, { passAt: 0.7, warnAt: 0.35 }),
      ratio: passageRatio,
      maxPoints: 7,
      evidence: {
        pagesWithWorkableParagraphs: wellSized,
        totalPages: pages.length,
        samples: paragraphSamples.slice(0, 6),
        targetRange: '25-130 words per paragraph',
      },
      explanation:
        'Very long unbroken blocks and one-line fragments both retrieve poorly. Self-contained paragraphs of a few sentences are what get quoted.',
      recommendedAction:
        passageRatio >= 0.7
          ? 'No action needed.'
          : 'Break long walls of text into focused paragraphs, each making one complete point that reads sensibly on its own.',
      effort: Effort.MEDIUM,
      impact: Impact.HIGH,
    }),
  );

  // --- Lists and tables -----------------------------------------------------
  const listTotal = pages.reduce((sum, p) => sum + p.listCount, 0);
  const tableTotal = pages.reduce((sum, p) => sum + p.tableCount, 0);
  const structureRatio = Math.min(
    1,
    scaleToTarget(listTotal, Math.max(4, pages.length)) * 0.7 + scaleToTarget(tableTotal, 2) * 0.3,
  );
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'answer.lists-and-tables',
      title: 'Information is presented in lists and tables',
      status: statusFromRatio(structureRatio, { passAt: 0.7, warnAt: 0.3 }),
      ratio: structureRatio,
      maxPoints: 6,
      evidence: {
        listCount: listTotal,
        listItemCount: pages.reduce((sum, p) => sum + p.listItemCount, 0),
        tableCount: tableTotal,
      },
      explanation:
        'Lists and tables carry explicit structure — steps, options, comparisons — that a model can reproduce accurately. Prose descriptions of the same information are easier to garble.',
      recommendedAction:
        structureRatio >= 0.7
          ? 'No action needed.'
          : 'Convert process descriptions into numbered steps and comparisons into tables.',
      effort: Effort.MEDIUM,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Definitions ----------------------------------------------------------
  const definitionPattern = /\b([A-Z][A-Za-z\s-]{2,40})\s+(is|are|means|refers to)\s+(a|an|the)\b/g;
  const definitionMatches = [...allText.matchAll(definitionPattern)].map((m) => m[0]).slice(0, 20);
  const definitionRatio = scaleToTarget(
    definitionMatches.length + pages.reduce((sum, p) => sum + p.definitionCount, 0),
    Math.max(3, pages.length),
  );
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'answer.definitions',
      title: 'Key terms are explicitly defined',
      status: statusFromRatio(definitionRatio, { passAt: 0.7, warnAt: 0.3 }),
      ratio: definitionRatio,
      maxPoints: 5,
      evidence: {
        definitionStatementsFound: definitionMatches.length,
        samples: definitionMatches.slice(0, 5),
        definitionListElements: pages.reduce((sum, p) => sum + p.definitionCount, 0),
      },
      explanation:
        'Sentences of the form "X is a Y that does Z" are directly reusable as answers to "what is X" queries, and they anchor your terminology to a definition you control.',
      recommendedAction:
        definitionRatio >= 0.7
          ? 'No action needed.'
          : 'Define your key industry terms and service names explicitly, in one sentence each, before elaborating.',
      effort: Effort.LOW,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Comparison content ---------------------------------------------------
  const comparisonSignals =
    /\b(vs\.?|versus|compared to|comparison|difference between|which is better|pros and cons|alternatives to)\b/i.test(
      allText,
    );
  const comparisonPages = pages.filter((p) =>
    /\b(vs\.?|versus|compare|comparison|alternatives?)\b/i.test(`${p.title ?? ''} ${p.finalUrl}`),
  );
  const comparisonRatio = comparisonPages.length > 0 ? 1 : comparisonSignals ? 0.5 : 0;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'answer.comparison-content',
      title: 'Site addresses comparison questions',
      status: comparisonPages.length > 0 ? Status.PASS : comparisonSignals ? Status.WARN : Status.FAIL,
      ratio: comparisonRatio,
      maxPoints: 5,
      evidence: {
        comparisonPages: comparisonPages.map((p) => p.finalUrl).slice(0, 5),
        comparisonLanguageDetected: comparisonSignals,
      },
      explanation:
        'A large share of pre-purchase questions are comparative ("X vs Y", "which option is right for"). Sites that answer them honestly are frequently the ones cited.',
      recommendedAction:
        comparisonPages.length > 0
          ? 'No action needed.'
          : 'Publish honest comparison content covering the options your customers weigh, including when a competitor or alternative is the better fit.',
      effort: Effort.HIGH,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Front-loaded answers -------------------------------------------------
  // Heuristic: does the first paragraph after the H1 answer, or merely tease?
  const frontLoaded = pages.filter((p) => {
    const opening = p.mainTextExcerpt.slice(0, 350);
    if (opening.length < 80) return false;
    return /\b(is|are|provides?|offers?|means|includes?|costs?|takes?|requires?)\b/i.test(opening);
  }).length;
  const frontRatio = pages.length > 0 ? frontLoaded / pages.length : 0;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'answer.front-loaded',
      title: 'Pages answer the question before elaborating',
      status: statusFromRatio(frontRatio, { passAt: 0.7, warnAt: 0.35 }),
      ratio: frontRatio,
      maxPoints: 6,
      evidence: {
        pagesWithDirectOpening: frontLoaded,
        totalPages: pages.length,
        note: 'Looks for a declarative statement within the opening 350 characters of body prose.',
      },
      explanation:
        'Retrieval favors the opening of a section. Pages that begin with scene-setting rather than the answer put their most useful sentence out of reach.',
      recommendedAction:
        frontRatio >= 0.7
          ? 'No action needed.'
          : 'Start each page and each section with the direct answer, then add context underneath.',
      effort: Effort.MEDIUM,
      impact: Impact.HIGH,
    }),
  );

  // --- Terminology consistency ---------------------------------------------
  const serviceTerms = (ctx.primaryServices ?? '')
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 3);
  const consistentTerms = serviceTerms.filter((term) => allText.toLowerCase().includes(term));
  const terminologyRatio =
    serviceTerms.length === 0 ? 0.6 : consistentTerms.length / serviceTerms.length;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'answer.terminology-consistency',
      title: 'Service terminology matches how customers search',
      status:
        serviceTerms.length === 0
          ? Status.INFO
          : statusFromRatio(terminologyRatio, { passAt: 0.8, warnAt: 0.4 }),
      ratio: terminologyRatio,
      maxPoints: 4,
      evidence: {
        servicesDeclaredInAudit: serviceTerms,
        termsFoundOnSite: consistentTerms,
        missingFromSite: serviceTerms.filter((t) => !consistentTerms.includes(t)),
      },
      explanation:
        'If the words you told us describe your services never appear on the site, the site cannot be matched to questions using those words.',
      recommendedAction:
        serviceTerms.length === 0
          ? 'Add your primary services when creating an audit so we can check terminology alignment.'
          : terminologyRatio >= 0.8
            ? 'No action needed.'
            : 'Use the same plain terms your customers use, consistently, in headings and body copy.',
      effort: Effort.LOW,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Homepage answers the core question ----------------------------------
  const homeOpening = homepage?.mainTextExcerpt.slice(0, 300) ?? '';
  const homeAnswers = homeOpening.length >= 100 && /\b(is|are|provides?|offers?|specializ|serves?)\b/i.test(homeOpening);
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'answer.homepage-summary',
      title: 'Homepage contains a quotable summary sentence',
      status: homeAnswers ? Status.PASS : Status.FAIL,
      ratio: homeAnswers ? 1 : 0,
      maxPoints: 5,
      evidence: {
        opening: homeOpening.slice(0, 250),
        length: homeOpening.length,
      },
      explanation:
        'When an AI system is asked "what is <brand>", it looks for one sentence it can reuse. If no such sentence exists, the answer is assembled from fragments and is more likely to be wrong.',
      recommendedAction: homeAnswers
        ? 'No action needed.'
        : 'Add a single sentence near the top of the homepage that fully describes the business without needing surrounding context.',
      effort: Effort.LOW,
      impact: Impact.HIGH,
      pageUrl: homepage?.finalUrl ?? null,
    }),
  );

  // --- How-to / process content --------------------------------------------
  const howToSignals =
    pages.some((p) => p.schemaTypes.includes('HowTo')) ||
    /\b(step \d|how to|our process|the process|what to expect)\b/i.test(allText);
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'answer.process-content',
      title: 'Process and how-to content is present',
      status: howToSignals ? Status.PASS : Status.WARN,
      ratio: howToSignals ? 1 : 0.2,
      maxPoints: 3,
      evidence: {
        howToSchemaPresent: pages.some((p) => p.schemaTypes.includes('HowTo')),
        processLanguageDetected: /\b(step \d|our process|what to expect)\b/i.test(allText),
      },
      explanation:
        '"How does it work" and "what happens next" are among the most common pre-purchase questions. Documented processes answer them directly.',
      recommendedAction: howToSignals
        ? 'No action needed.'
        : 'Document your process as clear numbered steps on the relevant service pages.',
      effort: Effort.MEDIUM,
      impact: Impact.MEDIUM,
    }),
  );

  return checks;
}
