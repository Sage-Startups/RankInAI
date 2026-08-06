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

const CATEGORY = AuditCategory.TRUST_AND_EVIDENCE;

/**
 * Trust and Evidence — is there enough verifiable substance behind the content
 * for a system to treat it as reliable?
 *
 * Total available points: 60.
 */
export function runTrustChecks(ctx: AuditContext): CheckResult[] {
  const checks: CheckResult[] = [];
  const { pages, homepage } = ctx;

  const allText = pages.map((p) => p.mainTextExcerpt).join(' ');
  const contactPage = pages.find((p) => p.role === PageRole.CONTACT);

  // --- Contact details ------------------------------------------------------
  const emails = [...new Set(pages.flatMap((p) => p.emails))];
  const phones = [...new Set(pages.flatMap((p) => p.phones))];
  const addresses = [...new Set(pages.flatMap((p) => p.addressSignals))].filter(Boolean);
  const contactSignals = [emails.length > 0, phones.length > 0, addresses.length > 0].filter(
    Boolean,
  ).length;
  const contactRatio = contactSignals / 3;

  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'trust.contact-details',
      title: 'Real contact details are published',
      status: contactSignals >= 2 ? Status.PASS : contactSignals === 1 ? Status.WARN : Status.FAIL,
      ratio: contactRatio,
      maxPoints: 9,
      evidence: {
        emailFound: emails.length > 0,
        phoneFound: phones.length > 0,
        postalAddressFound: addresses.length > 0,
        sampleAddress: addresses[0]?.slice(0, 150) ?? null,
        contactPageUrl: contactPage?.finalUrl ?? null,
      },
      explanation:
        'A verifiable phone number, email address and postal address are among the strongest signals that a website represents a real operating business rather than a thin affiliate page.',
      recommendedAction:
        contactSignals >= 2
          ? 'No action needed.'
          : 'Publish a full postal address, a direct phone number and a monitored email address on a dedicated contact page, and repeat them in the site footer.',
      effort: Effort.LOW,
      impact: Impact.HIGH,
      pageUrl: contactPage?.finalUrl ?? null,
    }),
  );

  // --- Dedicated contact page ----------------------------------------------
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'trust.contact-page',
      title: 'A dedicated contact page exists',
      status: contactPage ? Status.PASS : Status.FAIL,
      ratio: contactPage ? 1 : 0,
      maxPoints: 5,
      evidence: {
        found: Boolean(contactPage),
        url: contactPage?.finalUrl ?? null,
        wordCount: contactPage?.wordCount ?? 0,
      },
      explanation:
        'A discoverable contact page is a conventional trust marker and a common target when a system verifies that an organization is contactable.',
      recommendedAction: contactPage
        ? 'No action needed.'
        : 'Create a /contact page linked from the main navigation with full contact details and hours.',
      effort: Effort.LOW,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Author attribution ---------------------------------------------------
  const authorNames = [...new Set(pages.flatMap((p) => p.authors))].filter((a) => a.length > 2);
  const bylinePages = pages.filter((p) => p.authors.length > 0 || p.hasBylineText).length;
  const contentPages = pages.filter(
    (p) =>
      p.role === PageRole.ARTICLE ||
      p.role === PageRole.BLOG_INDEX ||
      p.role === PageRole.CASE_STUDY,
  ).length;
  const authorRatio =
    contentPages === 0
      ? authorNames.length > 0
        ? 1
        : 0.3
      : Math.min(1, bylinePages / Math.max(1, contentPages));

  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'trust.author-attribution',
      title: 'Content is attributed to named people',
      status:
        authorNames.length === 0
          ? Status.FAIL
          : statusFromRatio(authorRatio, { passAt: 0.7, warnAt: 0.3 }),
      ratio: authorRatio,
      maxPoints: 8,
      evidence: {
        authorsFound: authorNames.slice(0, 8),
        pagesWithByline: bylinePages,
        editorialPages: contentPages,
      },
      explanation:
        'Named authors let a system attach expertise and accountability to a claim. Anonymous content is systematically harder to weigh as evidence.',
      recommendedAction:
        authorNames.length > 0 && authorRatio >= 0.7
          ? 'No action needed.'
          : 'Add a visible byline with a real name to every substantive page, linked to a bio that states relevant qualifications and experience.',
      effort: Effort.MEDIUM,
      impact: Impact.HIGH,
    }),
  );

  // --- Author expertise -----------------------------------------------------
  const authorPage = pages.find((p) => p.role === PageRole.AUTHOR);
  const credentialLanguage =
    /\b(certified|licensed|accredited|years of experience|degree|qualified|member of|board[- ]certified|master|journeyman|registered)\b/i.test(
      allText,
    );
  const expertiseScore = [Boolean(authorPage), credentialLanguage, authorNames.length > 0].filter(
    Boolean,
  ).length;
  const expertiseRatio = expertiseScore / 3;

  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'trust.author-expertise',
      title: 'Expertise and credentials are stated',
      status: expertiseScore >= 2 ? Status.PASS : expertiseScore === 1 ? Status.WARN : Status.FAIL,
      ratio: expertiseRatio,
      maxPoints: 7,
      evidence: {
        authorOrTeamPageFound: Boolean(authorPage),
        authorPageUrl: authorPage?.finalUrl ?? null,
        credentialLanguageDetected: credentialLanguage,
        namedAuthors: authorNames.length,
      },
      explanation:
        'Stating licenses, certifications and years of experience gives a model concrete grounds for describing the business as qualified — which is what "who should I hire" style questions look for.',
      recommendedAction:
        expertiseScore >= 2
          ? 'No action needed.'
          : 'Publish a team page listing each expert with their license numbers, certifications and years of experience.',
      effort: Effort.MEDIUM,
      impact: Impact.HIGH,
    }),
  );

  // --- Outbound citations ---------------------------------------------------
  const outbound = pages.reduce((sum, p) => sum + p.outboundCitationLinks, 0);
  const externalDomains = [...new Set(pages.flatMap((p) => p.externalDomains))];
  const citationRatio = scaleToTarget(outbound, Math.max(3, pages.length));
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'trust.outbound-citations',
      title: 'Content cites external sources',
      status: statusFromRatio(citationRatio, { passAt: 0.7, warnAt: 0.25 }),
      ratio: citationRatio,
      maxPoints: 6,
      evidence: {
        outboundContextualLinks: outbound,
        externalDomainsReferenced: externalDomains.slice(0, 12),
        totalExternalLinks: pages.reduce((sum, p) => sum + p.externalLinks, 0),
      },
      explanation:
        'Citing standards bodies, regulations, manufacturers or research demonstrates that claims are grounded rather than asserted, and it places your content inside a recognizable topic network.',
      recommendedAction:
        citationRatio >= 0.7
          ? 'No action needed.'
          : 'Link out to the authoritative sources behind your claims — building codes, manufacturer specifications, industry standards, published research.',
      effort: Effort.MEDIUM,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Source transparency ---------------------------------------------------
  const transparency =
    /\b(according to|source:|sources:|data from|published by|as reported by|per the|based on data)\b/i.test(
      allText,
    );
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'trust.source-transparency',
      title: 'Claims name their sources in the text',
      status: transparency ? Status.PASS : Status.WARN,
      ratio: transparency ? 1 : 0,
      maxPoints: 4,
      evidence: { sourceLanguageDetected: transparency },
      explanation:
        'Explicit attribution inside the prose ("according to the 2024 IRC…") survives being extracted as a passage, whereas a bare hyperlink often does not.',
      recommendedAction: transparency
        ? 'No action needed.'
        : 'Name your sources in the sentence itself, not only in the link, so attribution survives when the passage is quoted.',
      effort: Effort.LOW,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Customer proof --------------------------------------------------------
  const proofLanguage =
    /\b(testimonial|what our (clients|customers) say|case stud|success stor|reviewed us|★|rated \d(\.\d)? out of)\b/i.test(
      allText,
    );
  const caseStudyPages = pages.filter((p) => p.role === PageRole.CASE_STUDY).length;
  const reviewSchema = pages.some(
    (p) => p.schemaTypes.includes('Review') || p.schemaTypes.includes('AggregateRating'),
  );
  const proofScore = [proofLanguage, caseStudyPages > 0, reviewSchema].filter(Boolean).length;
  const proofRatio = proofScore / 3;

  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'trust.customer-proof',
      title: 'Customer proof is visible on the site',
      status: proofScore >= 2 ? Status.PASS : proofScore === 1 ? Status.WARN : Status.FAIL,
      ratio: proofRatio,
      maxPoints: 6,
      evidence: {
        testimonialLanguageDetected: proofLanguage,
        caseStudyPages,
        reviewSchemaPresent: reviewSchema,
      },
      explanation:
        'Named, dated, specific customer outcomes give a model something concrete to reference when asked whether a business is any good.',
      recommendedAction:
        proofScore >= 2
          ? 'No action needed.'
          : 'Publish detailed case studies and attributed testimonials with dates, locations and measurable outcomes.',
      effort: Effort.HIGH,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Business legitimacy markers -------------------------------------------
  const legitimacy = {
    privacyPolicy:
      pages.some((p) => /privacy/i.test(`${p.finalUrl} ${p.title ?? ''}`)) ||
      pages.some((p) => p.links.some((l) => /privacy/i.test(l.href))),
    termsPage: pages.some((p) => p.links.some((l) => /terms|conditions/i.test(l.href))),
    licenseNumber:
      /\b(license\s*#?\s*\d|lic\.?\s*#?\s*\d|ein\s*[:#]?\s*\d|registration\s*(number|#))/i.test(
        allText,
      ),
    foundingDate: /\b(since|established|founded (in )?)\s*(19|20)\d{2}\b/i.test(allText),
  };
  const legitCount = Object.values(legitimacy).filter(Boolean).length;
  const legitRatio = legitCount / 4;

  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'trust.legitimacy-markers',
      title: 'Standard business legitimacy markers are present',
      status: legitCount >= 3 ? Status.PASS : legitCount >= 1 ? Status.WARN : Status.FAIL,
      ratio: legitRatio,
      maxPoints: 6,
      evidence: legitimacy,
      explanation:
        'Privacy policy, terms, license or registration numbers and a founding date are the routine markers of an established organization. Their absence is conspicuous.',
      recommendedAction:
        legitCount >= 3
          ? 'No action needed.'
          : 'Publish a privacy policy and terms page, and state your license or registration number and founding year where customers can see them.',
      effort: Effort.LOW,
      impact: Impact.MEDIUM,
    }),
  );

  // --- Attribution clarity ----------------------------------------------------
  const footerBrandPresent = homepage
    ? ctx.businessName
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 2)
        .some((t) => homepage.mainTextExcerpt.toLowerCase().includes(t))
    : false;
  const orgSchemaPresent = pages.some((p) =>
    p.schemaTypes.some((t) => ['Organization', 'LocalBusiness', 'Corporation'].includes(t)),
  );
  const attributionScore = [footerBrandPresent, orgSchemaPresent, emails.length > 0].filter(
    Boolean,
  ).length;
  const attributionRatio = attributionScore / 3;

  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'trust.attribution-clarity',
      title: 'Content is clearly attributable to the business',
      status:
        attributionScore >= 2 ? Status.PASS : attributionScore === 1 ? Status.WARN : Status.FAIL,
      ratio: attributionRatio,
      maxPoints: 5,
      evidence: {
        brandNameInBodyCopy: footerBrandPresent,
        organizationSchemaPresent: orgSchemaPresent,
        contactEmailPublished: emails.length > 0,
      },
      explanation:
        'A passage that cannot be traced back to a named, contactable organization is far less likely to be cited with attribution — which is the outcome that actually drives referrals.',
      recommendedAction:
        attributionScore >= 2
          ? 'No action needed.'
          : 'Make ownership unmistakable: name the business in body copy, declare Organization schema and publish a real contact address.',
      effort: Effort.LOW,
      impact: Impact.HIGH,
    }),
  );

  // --- Update transparency ----------------------------------------------------
  const datedPages = pages.filter((p) => p.publishedDate || p.modifiedDate).length;
  const dateRatio = pages.length > 0 ? datedPages / pages.length : 0;
  checks.push(
    makeCheck(CATEGORY, {
      checkId: 'trust.update-dates',
      title: 'Pages disclose when they were published or updated',
      status: statusFromRatio(dateRatio, { passAt: 0.6, warnAt: 0.25 }),
      ratio: dateRatio,
      maxPoints: 4,
      evidence: {
        pagesWithDates: datedPages,
        totalPages: pages.length,
      },
      explanation:
        'Disclosing when content was last reviewed lets a system judge whether it is safe to present as current — particularly for pricing, regulations and technical guidance.',
      recommendedAction:
        dateRatio >= 0.6
          ? 'No action needed.'
          : 'Show a "last updated" date on substantive pages and keep it accurate.',
      effort: Effort.LOW,
      impact: Impact.MEDIUM,
    }),
  );

  return checks;
}
