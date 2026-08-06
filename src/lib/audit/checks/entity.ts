import { AuditCategory, PageRole } from '@prisma/client';

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

const CATEGORY = AuditCategory.ENTITY_CLARITY;

/** Words that signal a concrete description rather than filler. */
const DESCRIPTOR_HINT = /\b(we|our team|the company|provides?|offers?|specializ|serves?|helps?|installs?|repairs?|designs?|builds?|manufactures?|sells?)\b/i;

/**
 * Entity Clarity — can a model state, without guessing, who this business is,
 * what it does, and who it serves?
 *
 * Total available points: 68.
 */
export function runEntityChecks(ctx: AuditContext): CheckResult[] {
  const checks: CheckResult[] = [];
  const { homepage, pages, businessName } = ctx;

  const allText = pages.map((p) => p.mainTextExcerpt).join(' ').toLowerCase();
  const homeText = (homepage?.mainTextExcerpt ?? '').toLowerCase();
  const brandTokens = businessName
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2 && !['the', 'and', 'llc', 'inc', 'ltd', 'co'].includes(t));

  // --- Business name present and prominent -------------------------------
  const nameInTitle = homepage?.title
    ? brandTokens.some((t) => homepage.title!.toLowerCase().includes(t))
    : false;
  const nameInH1 = homepage?.h1.some((h) => brandTokens.some((t) => h.toLowerCase().includes(t))) ?? false;
  const nameInBody = brandTokens.length > 0 && brandTokens.every((t) => homeText.includes(t));
  const nameSignals = [nameInTitle, nameInH1, nameInBody].filter(Boolean).length;
  const nameRatio = brandTokens.length === 0 ? 0 : nameSignals / 3;

  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'entity.brand-name-prominence',
      title: 'Business name appears clearly on the homepage',
      status: nameSignals >= 2 ? Status.PASS : nameSignals === 1 ? Status.WARN : Status.FAIL,
      ratio: nameRatio,
      maxPoints: 7,
      evidence: {
        businessName,
        appearsInTitle: nameInTitle,
        appearsInH1: nameInH1,
        appearsInBodyText: nameInBody,
        homepageTitle: homepage?.title ?? null,
      },
      explanation:
        'Models resolve a website to a named entity largely from the title, the main heading and the opening body copy. If the business name is absent from all three, the site is harder to attribute to a specific organization.',
      recommendedAction:
        nameSignals >= 2
          ? 'No action needed.'
          : 'Include the exact business name in the homepage title tag, the H1 or the opening paragraph — ideally all three, spelled identically.',
      effort: Effort.LOW,
      impact: Impact.HIGH,
      pageUrl: homepage?.finalUrl ?? null,
    }),
  );

  // --- Clear statement of what the business does -------------------------
  const descriptionSource =
    homepage?.metaDescription ??
    homepage?.mainTextExcerpt.slice(0, 400) ??
    '';
  const hasDescriptor = DESCRIPTOR_HINT.test(descriptionSource);
  const descriptorLongEnough = descriptionSource.trim().length >= 80;
  const descriptorRatio = hasDescriptor && descriptorLongEnough ? 1 : hasDescriptor || descriptorLongEnough ? 0.5 : 0;

  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'entity.what-we-do',
      title: 'Homepage states plainly what the business does',
      status: descriptorRatio >= 1 ? Status.PASS : descriptorRatio > 0 ? Status.WARN : Status.FAIL,
      ratio: descriptorRatio,
      maxPoints: 9,
      evidence: {
        excerpt: descriptionSource.slice(0, 300),
        containsActivityVerb: hasDescriptor,
        lengthCharacters: descriptionSource.trim().length,
      },
      explanation:
        'An answer engine needs a single, unambiguous sentence describing the activity of the business. Slogans and value statements without a concrete verb leave the model to infer the category.',
      recommendedAction:
        descriptorRatio >= 1
          ? 'No action needed.'
          : 'Open the homepage with one plain sentence in the form "<Business name> is a <category> that <does what> for <who> in <where>."',
      effort: Effort.LOW,
      impact: Impact.HIGH,
      pageUrl: homepage?.finalUrl ?? null,
    }),
  );

  // --- Audience definition ----------------------------------------------
  const audienceTerms = [
    'homeowners',
    'businesses',
    'small business',
    'enterprises',
    'families',
    'property managers',
    'contractors',
    'agencies',
    'startups',
    'clients',
    'customers',
    'patients',
    'landlords',
    'retailers',
    'manufacturers',
    'nonprofits',
    'teams',
  ];
  const audienceHits = audienceTerms.filter((t) => allText.includes(t));
  const audienceFromInput = Boolean(ctx.targetAudience && ctx.targetAudience.trim().length > 3);
  const audienceRatio = audienceHits.length >= 2 ? 1 : audienceHits.length === 1 ? 0.6 : 0;

  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'entity.audience-definition',
      title: 'Site names the customers it serves',
      status: audienceHits.length >= 2 ? Status.PASS : audienceHits.length === 1 ? Status.WARN : Status.FAIL,
      ratio: audienceRatio,
      maxPoints: 6,
      evidence: {
        audienceTermsFound: audienceHits.slice(0, 8),
        audienceSuppliedInAuditForm: audienceFromInput ? ctx.targetAudience : null,
      },
      explanation:
        'Queries put to AI systems are usually framed around a customer type ("roofers for commercial buildings", "accountants for freelancers"). Naming your audience explicitly is what connects the brand to those questions.',
      recommendedAction:
        audienceHits.length >= 2
          ? 'No action needed.'
          : 'State the customer types you serve in plain language on the homepage and your main service pages.',
      effort: Effort.LOW,
      impact: Impact.HIGH,
    }),
  );

  // --- Service / product specificity ------------------------------------
  const servicePages = pages.filter(
    (p) => p.role === PageRole.SERVICE || p.role === PageRole.PRODUCT || p.role === PageRole.CATEGORY,
  );
  const serviceHeadings = pages.flatMap((p) => p.headings.filter((h) => h.level === 2 || h.level === 3));
  const specificityRatio = Math.max(
    scaleToTarget(servicePages.length, 3),
    scaleToTarget(serviceHeadings.length, 12) * 0.7,
  );

  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'entity.service-specificity',
      title: 'Individual services or products are described separately',
      status: statusFromRatio(specificityRatio, { passAt: 0.75, warnAt: 0.35 }),
      ratio: specificityRatio,
      maxPoints: 8,
      evidence: {
        serviceOrProductPages: servicePages.map((p) => p.finalUrl).slice(0, 10),
        subheadingCount: serviceHeadings.length,
        servicesSuppliedInAuditForm: ctx.primaryServices ?? null,
      },
      explanation:
        'A single "Services" page listing eight offerings in bullet points gives a model far less to retrieve than eight pages that each explain one offering in depth.',
      recommendedAction:
        specificityRatio >= 0.75
          ? 'No action needed.'
          : 'Give each significant service or product its own page with a descriptive heading, a definition, who it is for and what it costs or includes.',
      effort: Effort.HIGH,
      impact: Impact.HIGH,
    }),
  );

  // --- Geographic relevance ---------------------------------------------
  const geoSignals = pages.flatMap((p) => p.addressSignals);
  const stateMentioned = /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/i.test(
    allText,
  );
  const areaServedSchema = pages.some((p) => p.jsonLd.some((b) => b.values.areaServed));
  const geoScore = [geoSignals.length > 0, stateMentioned, areaServedSchema].filter(Boolean).length;
  const geoRatio = geoScore / 3;

  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'entity.geographic-clarity',
      title: 'Service area and location are stated',
      status: geoScore >= 2 ? Status.PASS : geoScore === 1 ? Status.WARN : Status.FAIL,
      ratio: geoRatio,
      maxPoints: 7,
      evidence: {
        addressSignals: geoSignals.slice(0, 4),
        usStateMentioned: stateMentioned,
        areaServedInSchema: areaServedSchema,
        locationSuppliedInAuditForm: ctx.businessLocation ?? null,
        targetCountry: ctx.targetCountry,
      },
      explanation:
        'Most commercial questions asked of AI systems carry a location. Without an explicit city, state or service area, the site cannot be matched to "near me" style questions.',
      recommendedAction:
        geoScore >= 2
          ? 'No action needed.'
          : 'Publish the full postal address and an explicit list of the cities, counties or states you serve, and mirror it in LocalBusiness schema.',
      effort: Effort.LOW,
      impact: Impact.HIGH,
    }),
  );

  // --- About page quality ------------------------------------------------
  const aboutPage = pages.find((p) => p.role === PageRole.ABOUT);
  const aboutWordCount = aboutPage?.wordCount ?? 0;
  const aboutRatio = !aboutPage
    ? 0
    : aboutWordCount >= 400
      ? 1
      : aboutWordCount >= 200
        ? 0.65
        : 0.3;

  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'entity.about-page',
      title: 'A substantive About page exists',
      status: !aboutPage ? Status.FAIL : aboutWordCount >= 400 ? Status.PASS : Status.WARN,
      ratio: aboutRatio,
      maxPoints: 8,
      evidence: {
        aboutPageUrl: aboutPage?.finalUrl ?? null,
        wordCount: aboutWordCount,
        mentionsFoundingOrHistory: aboutPage
          ? /\b(founded|established|since \d{4}|started in|began in)\b/i.test(aboutPage.mainTextExcerpt)
          : false,
      },
      explanation:
        'The About page is where models look to confirm the organization behind the content: how long it has operated, who runs it and what it specializes in. A thin or missing About page leaves the entity poorly defined.',
      recommendedAction: aboutPage
        ? aboutWordCount >= 400
          ? 'No action needed.'
          : 'Expand the About page to cover founding date, leadership, specializations, service area and credentials.'
        : 'Create an About page covering who runs the business, when it started, what it specializes in and where it operates.',
      effort: Effort.MEDIUM,
      impact: Impact.HIGH,
      pageUrl: aboutPage?.finalUrl ?? null,
    }),
  );

  // --- Entity consistency across pages -----------------------------------
  const titles = pages.map((p) => p.title ?? '').filter(Boolean);
  const brandInTitles = titles.filter((t) => brandTokens.some((tok) => t.toLowerCase().includes(tok))).length;
  const consistencyRatio = titles.length > 0 ? brandInTitles / titles.length : 0;

  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'entity.name-consistency',
      title: 'Business name is used consistently across pages',
      status: statusFromRatio(consistencyRatio, { passAt: 0.7, warnAt: 0.35 }),
      ratio: consistencyRatio,
      maxPoints: 6,
      evidence: {
        pagesWithBrandInTitle: brandInTitles,
        pagesWithTitle: titles.length,
        sampleTitles: titles.slice(0, 6),
      },
      explanation:
        'Consistent naming across page titles reinforces the link between every passage and one organization. Inconsistent or absent branding fragments that association.',
      recommendedAction:
        consistencyRatio >= 0.7
          ? 'No action needed.'
          : 'Append the business name to page titles using a consistent pattern such as "Page topic | Business Name".',
      effort: Effort.LOW,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Title tag quality -------------------------------------------------
  const goodTitles = pages.filter((p) => p.titleLength >= 25 && p.titleLength <= 65).length;
  const titleRatio = pages.length > 0 ? goodTitles / pages.length : 0;

  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'entity.title-quality',
      title: 'Page titles are descriptive and well-sized',
      status: statusFromRatio(titleRatio, { passAt: 0.7, warnAt: 0.4 }),
      ratio: titleRatio,
      maxPoints: 5,
      evidence: {
        wellSizedTitles: goodTitles,
        totalPages: pages.length,
        missingTitles: pages.filter((p) => !p.title).map((p) => p.finalUrl).slice(0, 5),
        tooShort: pages.filter((p) => p.title && p.titleLength < 25).map((p) => p.title).slice(0, 5),
      },
      explanation:
        'The title tag is the strongest short summary a crawler receives for a page. Titles under about 25 characters rarely say enough to place the page in a topic.',
      recommendedAction:
        titleRatio >= 0.7
          ? 'No action needed.'
          : 'Rewrite short or missing titles so each states the specific topic of the page plus the business name.',
      effort: Effort.LOW,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Meta description coverage ----------------------------------------
  const withDescription = pages.filter((p) => p.metaDescriptionLength >= 50).length;
  const descRatio = pages.length > 0 ? withDescription / pages.length : 0;

  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'entity.meta-description',
      title: 'Pages provide a meaningful meta description',
      status: statusFromRatio(descRatio, { passAt: 0.8, warnAt: 0.4 }),
      ratio: descRatio,
      maxPoints: 4,
      evidence: {
        pagesWithDescription: withDescription,
        totalPages: pages.length,
        missing: pages.filter((p) => !p.metaDescription).map((p) => p.finalUrl).slice(0, 5),
      },
      explanation:
        'Meta descriptions act as a short abstract of the page. They are frequently reused verbatim in generated summaries.',
      recommendedAction:
        descRatio >= 0.8
          ? 'No action needed.'
          : 'Write a unique 120-160 character description for each page that states what the page covers.',
      effort: Effort.MEDIUM,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Duplicate titles / descriptions ----------------------------------
  const titleCounts = new Map<string, number>();
  for (const p of pages) {
    if (!p.title) continue;
    titleCounts.set(p.title, (titleCounts.get(p.title) ?? 0) + 1);
  }
  const duplicateTitles = [...titleCounts.entries()].filter(([, n]) => n > 1);
  const descCounts = new Map<string, number>();
  for (const p of pages) {
    if (!p.metaDescription) continue;
    descCounts.set(p.metaDescription, (descCounts.get(p.metaDescription) ?? 0) + 1);
  }
  const duplicateDescriptions = [...descCounts.entries()].filter(([, n]) => n > 1);
  const dupeCount = duplicateTitles.length + duplicateDescriptions.length;
  const dupeRatio = dupeCount === 0 ? 1 : dupeCount <= 1 ? 0.6 : dupeCount <= 3 ? 0.3 : 0;

  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'entity.duplicate-metadata',
      title: 'Titles and descriptions are unique per page',
      status: dupeCount === 0 ? Status.PASS : dupeCount <= 1 ? Status.WARN : Status.FAIL,
      ratio: dupeRatio,
      maxPoints: 4,
      evidence: {
        duplicateTitles: duplicateTitles.map(([title, count]) => ({ title, count })).slice(0, 5),
        duplicateDescriptions: duplicateDescriptions
          .map(([description, count]) => ({ description: description.slice(0, 120), count }))
          .slice(0, 5),
      },
      explanation:
        'Repeated titles and descriptions make separate pages look interchangeable, which encourages retrieval systems to collapse them and pick one arbitrarily.',
      recommendedAction:
        dupeCount === 0
          ? 'No action needed.'
          : 'Give every page a distinct title and description that reflects its specific topic.',
      effort: Effort.MEDIUM,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Open Graph metadata ----------------------------------------------
  const ogRatio = proportion(pages, (p) => Boolean(p.openGraph['og:title'] && p.openGraph['og:description']));
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'entity.open-graph',
      title: 'Open Graph metadata is present',
      status: statusFromRatio(ogRatio, { passAt: 0.7, warnAt: 0.3 }),
      ratio: ogRatio,
      maxPoints: 4,
      evidence: {
        pagesWithOgTitleAndDescription: pages.filter(
          (p) => p.openGraph['og:title'] && p.openGraph['og:description'],
        ).length,
        totalPages: pages.length,
        homepageOg: homepage?.openGraph ?? {},
        twitterCardPresent: pages.filter((p) => Object.keys(p.twitterCard).length > 0).length,
      },
      explanation:
        'Open Graph tags provide a clean, machine-readable title, description and image that many systems reuse when they surface a link to your page.',
      recommendedAction:
        ogRatio >= 0.7
          ? 'No action needed.'
          : 'Add og:title, og:description, og:image, og:url and og:type to your base template.',
      effort: Effort.LOW,
      impact: Impact.LOW,
    }),
  );

  return checks;
}
