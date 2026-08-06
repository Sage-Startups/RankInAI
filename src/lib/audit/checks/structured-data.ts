import { AuditCategory } from '@prisma/client';

import type { AuditContext, CheckResult } from '@/lib/audit/types';
import {
  Effort,
  Impact,
  Status,
  makeCheck,
  scaleToTarget,
  statusFromRatio,
} from '@/lib/audit/checks/helpers';

const CATEGORY = AuditCategory.STRUCTURED_DATA;

/** Schema types this audit recognizes and reports on. */
export const RECOGNIZED_SCHEMA_TYPES = [
  'Organization',
  'LocalBusiness',
  'Corporation',
  'Person',
  'Product',
  'Service',
  'Article',
  'BlogPosting',
  'FAQPage',
  'HowTo',
  'BreadcrumbList',
  'WebSite',
  'WebPage',
  'Review',
  'AggregateRating',
];

/** Organization-level properties that make the entity genuinely resolvable. */
const ORGANIZATION_REQUIRED = ['name', 'url'];
const ORGANIZATION_VALUABLE = ['logo', 'description', 'sameAs', 'address', 'telephone', 'email'];

/**
 * Structured Data — is there valid, reasonably complete schema markup?
 *
 * Points are never awarded merely because a type is present; the properties
 * inside it are inspected too.
 *
 * Total available points: 54.
 */
export function runStructuredDataChecks(ctx: AuditContext): CheckResult[] {
  const checks: CheckResult[] = [];
  const { pages, homepage } = ctx;

  const allBlocks = pages.flatMap((p) => p.jsonLd);
  const allTypes = [...new Set(pages.flatMap((p) => p.schemaTypes))];
  const pagesWithSchema = pages.filter((p) => p.jsonLd.length > 0).length;

  // --- Any structured data at all -----------------------------------------
  const coverageRatio = pages.length > 0 ? pagesWithSchema / pages.length : 0;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'schema.presence',
      title: 'Pages include JSON-LD structured data',
      status: statusFromRatio(coverageRatio, { passAt: 0.8, warnAt: 0.3 }),
      ratio: coverageRatio,
      maxPoints: 9,
      evidence: {
        pagesWithJsonLd: pagesWithSchema,
        totalPages: pages.length,
        typesFound: allTypes,
        pagesWithoutSchema: pages.filter((p) => p.jsonLd.length === 0).map((p) => p.finalUrl).slice(0, 5),
      },
      explanation:
        'JSON-LD is the most direct way to tell a machine what a page is about without relying on it to infer meaning from prose.',
      recommendedAction:
        coverageRatio >= 0.8
          ? 'No action needed.'
          : 'Add JSON-LD structured data to every template — at minimum Organization or LocalBusiness site-wide, plus a page-type schema.',
      effort: Effort.MEDIUM,
      impact: Impact.HIGH,
    }),
  );

  // --- Syntactic validity ---------------------------------------------------
  const invalidBlocks = allBlocks.filter((b) => !b.valid);
  const validityRatio = allBlocks.length === 0 ? 0 : 1 - invalidBlocks.length / allBlocks.length;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'schema.validity',
      title: 'Structured data parses without errors',
      status:
        allBlocks.length === 0
          ? Status.NOT_APPLICABLE
          : invalidBlocks.length === 0
            ? Status.PASS
            : Status.FAIL,
      ratio: validityRatio,
      maxPoints: 8,
      evidence: {
        totalBlocks: allBlocks.length,
        invalidBlocks: invalidBlocks.length,
        errors: invalidBlocks.slice(0, 3).map((b) => ({ error: b.parseError, excerpt: b.excerpt.slice(0, 200) })),
      },
      explanation:
        'A JSON-LD block that fails to parse is silently discarded by every consumer. Malformed markup provides no benefit at all.',
      recommendedAction:
        invalidBlocks.length === 0
          ? 'No action needed.'
          : 'Fix the JSON syntax errors listed in the evidence, then re-validate with a structured-data testing tool.',
      effort: Effort.LOW,
      impact: Impact.HIGH,
    }),
  );

  // --- Organization / LocalBusiness presence -------------------------------
  const orgTypes = ['Organization', 'LocalBusiness', 'Corporation', 'ProfessionalService', 'Store'];
  const orgBlock = allBlocks.find((b) => b.types.some((t) => orgTypes.includes(t)));
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'schema.organization-present',
      title: 'Organization or LocalBusiness schema is declared',
      status: orgBlock ? Status.PASS : Status.FAIL,
      ratio: orgBlock ? 1 : 0,
      maxPoints: 9,
      evidence: {
        found: Boolean(orgBlock),
        typesDeclared: orgBlock?.types ?? [],
        allTypesOnSite: allTypes,
      },
      explanation:
        'Organization (or LocalBusiness for a physical business) is the schema that names the entity behind the whole site. Without it, every page is attributed only by inference.',
      recommendedAction: orgBlock
        ? 'No action needed.'
        : 'Add an Organization or LocalBusiness JSON-LD block to your site-wide template with name, url, logo, description, address and sameAs profiles.',
      effort: Effort.MEDIUM,
      impact: Impact.HIGH,
      pageUrl: homepage?.finalUrl ?? null,
    }),
  );

  // --- Organization completeness -------------------------------------------
  const orgProps = orgBlock ? Object.keys(orgBlock.values) : [];
  const requiredPresent = ORGANIZATION_REQUIRED.filter((p) => orgProps.includes(p));
  const valuablePresent = ORGANIZATION_VALUABLE.filter((p) => orgProps.includes(p));
  const completenessRatio = !orgBlock
    ? 0
    : (requiredPresent.length / ORGANIZATION_REQUIRED.length) * 0.5 +
      (valuablePresent.length / ORGANIZATION_VALUABLE.length) * 0.5;

  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'schema.organization-completeness',
      title: 'Organization schema carries meaningful properties',
      status: !orgBlock
        ? Status.NOT_APPLICABLE
        : statusFromRatio(completenessRatio, { passAt: 0.75, warnAt: 0.4 }),
      ratio: completenessRatio,
      maxPoints: 8,
      evidence: {
        propertiesPresent: orgProps,
        requiredPresent,
        requiredMissing: ORGANIZATION_REQUIRED.filter((p) => !orgProps.includes(p)),
        valuableMissing: ORGANIZATION_VALUABLE.filter((p) => !orgProps.includes(p)),
        values: orgBlock?.values ?? {},
      },
      explanation:
        'An Organization block containing only a name is close to worthless. Logo, description, address, telephone and sameAs links are what let a system resolve the entity confidently and connect it to other references.',
      recommendedAction:
        completenessRatio >= 0.75
          ? 'No action needed.'
          : `Extend your Organization schema with the missing properties: ${ORGANIZATION_VALUABLE.filter((p) => !orgProps.includes(p)).join(', ') || 'none'}.`,
      effort: Effort.LOW,
      impact: Impact.HIGH,
    }),
  );

  // --- sameAs profile links -------------------------------------------------
  const hasSameAs = allBlocks.some((b) => b.properties.includes('sameAs') || b.values.sameAs);
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'schema.same-as',
      title: 'sameAs links connect the brand to external profiles',
      status: hasSameAs ? Status.PASS : Status.FAIL,
      ratio: hasSameAs ? 1 : 0,
      maxPoints: 5,
      evidence: {
        sameAsPresent: hasSameAs,
        exampleValue: allBlocks.find((b) => b.values.sameAs)?.values.sameAs ?? null,
      },
      explanation:
        'sameAs links your site to the profiles that describe the same organization elsewhere. This is one of the main mechanisms by which an entity gets consolidated rather than treated as several unrelated brands.',
      recommendedAction: hasSameAs
        ? 'No action needed — keep the profile list current.'
        : 'Add a sameAs array to your Organization schema listing your verified profiles (LinkedIn, industry directories, review platforms, Wikipedia/Wikidata where applicable).',
      effort: Effort.LOW,
      impact: Impact.MEDIUM,
    }),
  );

  // --- WebSite schema -------------------------------------------------------
  const hasWebSite = allTypes.includes('WebSite');
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'schema.website',
      title: 'WebSite schema is declared',
      status: hasWebSite ? Status.PASS : Status.WARN,
      ratio: hasWebSite ? 1 : 0,
      maxPoints: 3,
      evidence: { present: hasWebSite, typesFound: allTypes },
      explanation:
        'WebSite schema names the site as a whole and ties it to the publishing organization.',
      recommendedAction: hasWebSite
        ? 'No action needed.'
        : 'Add a WebSite JSON-LD block on the homepage with name, url and publisher.',
      effort: Effort.LOW,
      impact: Impact.LOW,
    }),
  );

  // --- Breadcrumbs ----------------------------------------------------------
  const hasBreadcrumbs = allTypes.includes('BreadcrumbList');
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'schema.breadcrumbs',
      title: 'BreadcrumbList schema describes site hierarchy',
      status: hasBreadcrumbs ? Status.PASS : Status.WARN,
      ratio: hasBreadcrumbs ? 1 : 0,
      maxPoints: 3,
      evidence: {
        present: hasBreadcrumbs,
        pagesWithBreadcrumbs: pages.filter((p) => p.schemaTypes.includes('BreadcrumbList')).length,
      },
      explanation:
        'Breadcrumbs express where a page sits in the site structure, which helps a system understand topical relationships between pages.',
      recommendedAction: hasBreadcrumbs
        ? 'No action needed.'
        : 'Add BreadcrumbList schema to section and detail pages.',
      effort: Effort.LOW,
      impact: Impact.LOW,
    }),
  );

  // --- Content-type schema (Article / Service / Product) -------------------
  const contentTypes = ['Article', 'BlogPosting', 'NewsArticle', 'Service', 'Product', 'HowTo'];
  const contentTypesFound = contentTypes.filter((t) => allTypes.includes(t));
  const contentRatio = scaleToTarget(contentTypesFound.length, 2);
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'schema.content-types',
      title: 'Page-level content schema is used',
      status: contentTypesFound.length >= 2 ? Status.PASS : contentTypesFound.length === 1 ? Status.WARN : Status.FAIL,
      ratio: contentRatio,
      maxPoints: 6,
      evidence: {
        contentTypesFound,
        recognizedTypesAvailable: contentTypes,
        allTypesOnSite: allTypes,
      },
      explanation:
        'Beyond identifying the organization, schema should describe what each page actually is — an article, a service, a product. This is how individual passages get correctly categorized.',
      recommendedAction:
        contentTypesFound.length >= 2
          ? 'No action needed.'
          : 'Add Article or BlogPosting schema to editorial pages and Service or Product schema to your offering pages.',
      effort: Effort.MEDIUM,
      impact: Impact.MEDIUM,
    }),
  );

  // --- FAQ schema -----------------------------------------------------------
  const hasFaqSchema = allTypes.includes('FAQPage');
  const hasFaqContent = pages.some((p) => p.hasFaqSignals);
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'schema.faq',
      title: 'FAQ content is marked up with FAQPage schema',
      status: hasFaqSchema ? Status.PASS : hasFaqContent ? Status.FAIL : Status.WARN,
      ratio: hasFaqSchema ? 1 : 0,
      maxPoints: 5,
      evidence: {
        faqSchemaPresent: hasFaqSchema,
        faqContentDetected: hasFaqContent,
      },
      explanation:
        'FAQPage schema converts question/answer pairs into explicitly structured data, which is the format answer engines can consume with the least ambiguity.',
      recommendedAction: hasFaqSchema
        ? 'No action needed.'
        : hasFaqContent
          ? 'You already have FAQ content — add FAQPage schema so the question/answer pairs become machine-readable.'
          : 'Publish FAQ content and mark it up with FAQPage schema.',
      effort: Effort.LOW,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Author / Person schema ----------------------------------------------
  const hasPerson = allTypes.includes('Person') || allBlocks.some((b) => b.values.author);
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'schema.author',
      title: 'Authorship is expressed in structured data',
      status: hasPerson ? Status.PASS : Status.WARN,
      ratio: hasPerson ? 1 : 0,
      maxPoints: 4,
      evidence: {
        personSchemaPresent: allTypes.includes('Person'),
        authorPropertyPresent: allBlocks.some((b) => b.values.author),
        authorValues: allBlocks.map((b) => b.values.author).filter(Boolean).slice(0, 5),
      },
      explanation:
        'Naming a real author in structured data attaches expertise to content. Anonymous content is harder to weigh for reliability.',
      recommendedAction: hasPerson
        ? 'No action needed.'
        : 'Add author (Person) properties to Article schema, and give key experts their own Person markup with credentials.',
      effort: Effort.MEDIUM,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Review / rating markup ----------------------------------------------
  const hasReview = allTypes.includes('Review') || allTypes.includes('AggregateRating');
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'schema.reviews',
      title: 'Review or rating markup is present',
      status: hasReview ? Status.PASS : Status.INFO,
      ratio: hasReview ? 1 : 0,
      maxPoints: 3,
      evidence: {
        reviewSchema: allTypes.includes('Review'),
        aggregateRatingSchema: allTypes.includes('AggregateRating'),
      },
      explanation:
        'Where genuine reviews exist, marking them up makes the social proof machine-readable. Only mark up reviews you have actually collected.',
      recommendedAction: hasReview
        ? 'No action needed — make sure the markup reflects real, verifiable reviews.'
        : 'If you collect customer reviews, expose them with Review or AggregateRating schema. Never fabricate ratings.',
      effort: Effort.MEDIUM,
      impact: Impact.LOW,
    }),
  );

  // --- Schema/content agreement --------------------------------------------
  const schemaName = allBlocks.find((b) => b.values.name)?.values.name ?? null;
  const nameMatches = schemaName
    ? ctx.businessName
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 2)
        .some((t) => schemaName.toLowerCase().includes(t))
    : false;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'schema.name-agreement',
      title: 'Schema business name matches the visible brand',
      status: !schemaName ? Status.NOT_APPLICABLE : nameMatches ? Status.PASS : Status.FAIL,
      ratio: nameMatches ? 1 : 0,
      maxPoints: 4,
      evidence: {
        nameInSchema: schemaName,
        businessNameSupplied: ctx.businessName,
        matches: nameMatches,
      },
      explanation:
        'When the name in structured data differs from the name used on the page, an entity-resolution system can end up treating them as two organizations.',
      recommendedAction: nameMatches
        ? 'No action needed.'
        : 'Make the name property in your schema exactly match the business name shown on the site.',
      effort: Effort.LOW,
      impact: Impact.MEDIUM,
    }),
  );

  return checks;
}
