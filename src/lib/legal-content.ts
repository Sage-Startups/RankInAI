/**
 * Legal page content.
 *
 * IMPORTANT: these are software-generated starting templates, not legal advice.
 * The admin area surfaces a standing reminder that they must be reviewed by a
 * qualified attorney before commercial launch. Operators can edit this file, or
 * replace the pages entirely.
 */

export interface LegalSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDocument {
  slug: string;
  title: string;
  description: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
}

export const LEGAL_TEMPLATE_NOTICE =
  'This document is a software-generated starting template provided with the RankInAI platform. It has not been reviewed by an attorney and does not constitute legal advice. Have it reviewed and adapted to your jurisdiction and business before commercial launch.';

const LAST_UPDATED = 'April 1, 2026';

export const LEGAL_DOCUMENTS: Record<string, LegalDocument> = {
  terms: {
    slug: 'terms',
    title: 'Terms of Service',
    description: 'The terms governing your use of the RankInAI platform.',
    lastUpdated: LAST_UPDATED,
    intro:
      'These Terms of Service govern your access to and use of the RankInAI website, application and audit services. By creating an account or purchasing an audit you agree to these terms.',
    sections: [
      {
        heading: '1. The service',
        paragraphs: [
          'RankInAI is a software product that analyzes publicly accessible website content and produces a report describing observed signals relevant to AI visibility and Generative Engine Optimization (GEO) readiness.',
          'The service reports on signals measured from the website you submit. It is an analysis and reporting tool. It does not modify your website and does not act on your behalf with any third party.',
        ],
      },
      {
        heading: '2. No guarantee of results',
        paragraphs: [
          'RankInAI does not and cannot guarantee that any artificial intelligence system, answer engine, search engine or assistant will discover, index, mention, cite or recommend your business or content.',
          'Scores produced by the service describe readiness based on observable website signals. They are not a prediction or promise of traffic, rankings, citations, referrals, leads or revenue. You are solely responsible for decisions you make based on the report.',
        ],
      },
      {
        heading: '3. Accounts and eligibility',
        paragraphs: [
          'You must provide accurate registration information and keep your credentials secure. You are responsible for all activity that occurs under your account.',
          'You must be at least 18 years old and capable of forming a binding contract. Accounts may not be shared between organizations.',
        ],
      },
      {
        heading: '4. Authorization to audit',
        paragraphs: [
          'When you submit a website for a full audit you confirm that you own it, operate it, or are otherwise authorized to have it analyzed. You must not use the service to audit a website where doing so would breach that website’s terms, applicable law, or a third party’s rights.',
          'Competitor comparison retrieves a single publicly accessible homepage for each competitor URL you supply. It does not perform a deep crawl of competitor websites.',
        ],
      },
      {
        heading: '5. Acceptable use',
        paragraphs: [
          'You agree not to misuse the service. Detailed restrictions are set out in the Acceptable Use Policy, which forms part of these terms.',
        ],
      },
      {
        heading: '6. Fees, billing and plans',
        paragraphs: [
          'All prices are stated in US dollars and exclude any applicable sales tax or VAT, which is calculated at checkout where required.',
          'Subscriptions renew automatically each month until canceled. Canceling stops future renewals; access continues until the end of the paid period. One-time audit credits do not expire and are consumed only after any subscription allowance for the period has been used.',
          'Payments are processed by Stripe. RankInAI does not receive or store your payment card details.',
        ],
      },
      {
        heading: '7. Intellectual property',
        paragraphs: [
          'The platform, its software, methodology, scoring rubric and interface are owned by RankInAI and protected by intellectual property law. You receive a limited, non-exclusive, non-transferable right to use the service under these terms.',
          'Reports generated for your account are yours to use, share with clients and republish. You may not resell access to the platform itself, or present the audit engine as your own software.',
        ],
      },
      {
        heading: '8. Your content and data',
        paragraphs: [
          'You retain all rights in your website content. You grant RankInAI a limited right to retrieve, process and store publicly accessible content from the websites you submit for the purpose of producing your reports.',
          'How personal data is handled is described in the Privacy Policy.',
        ],
      },
      {
        heading: '9. Third-party services',
        paragraphs: [
          'The service depends on third parties including a payment processor, a hosting provider and, where enabled, an AI provider and a search data provider. Interruption of a third-party service may affect availability of some features. Optional features degrade gracefully: a failure in an optional provider does not invalidate an otherwise complete audit.',
        ],
      },
      {
        heading: '10. Availability and changes',
        paragraphs: [
          'The service is provided on an "as available" basis. We may modify, suspend or discontinue features, and will give reasonable notice of material changes affecting paid plans.',
        ],
      },
      {
        heading: '11. Disclaimer of warranties',
        paragraphs: [
          'To the maximum extent permitted by law, the service is provided "as is" and "as available" without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose and non-infringement.',
        ],
      },
      {
        heading: '12. Limitation of liability',
        paragraphs: [
          'To the maximum extent permitted by law, RankInAI is not liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, revenue, data or goodwill.',
          'Total aggregate liability arising out of or relating to the service is limited to the greater of the amount you paid in the twelve months before the claim, or one hundred US dollars.',
        ],
      },
      {
        heading: '13. Termination',
        paragraphs: [
          'You may close your account at any time from the settings page. We may suspend or terminate an account that breaches these terms or the Acceptable Use Policy, or where required by law.',
          'On termination your right to use the service ends. Financial records are retained as required for accounting and legal purposes.',
        ],
      },
      {
        heading: '14. Changes to these terms',
        paragraphs: [
          'We may update these terms. Material changes will be notified by email or an in-product notice before they take effect. Continued use after the effective date constitutes acceptance.',
        ],
      },
      {
        heading: '15. Governing law and contact',
        paragraphs: [
          'These terms are governed by the laws of the United States and the state in which the operator of this instance is established, without regard to conflict-of-law rules.',
          'Questions about these terms can be sent through the contact page.',
        ],
      },
    ],
  },

  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    description: 'What data RankInAI collects, why, and how it is protected.',
    lastUpdated: LAST_UPDATED,
    intro:
      'This policy explains what personal data RankInAI collects, why it is collected, how long it is kept and what rights you have over it.',
    sections: [
      {
        heading: '1. Data we collect',
        paragraphs: ['We collect only what the service needs to operate:'],
        bullets: [
          'Account data — email address, name, hashed password, role, account status, creation and last sign-in timestamps.',
          'Profile data you choose to provide — company name, website, business type and primary use case.',
          'Audit data — the website URLs you submit, business context you enter, and the analysis results produced from public pages.',
          'Billing data — Stripe customer and subscription identifiers, payment amounts, status and dates. Card details are handled entirely by Stripe and never reach our servers.',
          'Support data — contact form submissions including your name, email, company, subject and message.',
          'Operational data — hashed IP addresses and hashed identifiers used for rate limiting and abuse prevention, plus internal product analytics events.',
        ],
      },
      {
        heading: '2. What we deliberately do not collect',
        paragraphs: [
          'We do not store payment card numbers. We do not store raw IP addresses for rate limiting — only a salted one-way hash. Internal analytics events never contain form field values, credentials, message contents or payment details, and are restricted to a fixed whitelist of properties.',
          'The free homepage preview stores only the domain, a hashed client identifier, the resulting score and timing information. No page content is retained.',
        ],
      },
      {
        heading: '3. Why we process it',
        paragraphs: ['Each category of data has a specific purpose:'],
        bullets: [
          'To provide the service — running audits, storing your reports and applying entitlements.',
          'To take payment and meet accounting obligations.',
          'To secure the platform — rate limiting, abuse prevention and audit trails for privileged actions.',
          'To improve the product — aggregate, non-identifying usage patterns.',
          'To communicate with you — transactional email about your account and audits, and marketing email only where you have opted in.',
        ],
      },
      {
        heading: '4. Website content we retrieve',
        paragraphs: [
          'To produce an audit we retrieve publicly accessible pages from the website you submit. We store structured observations — titles, headings, word counts, schema types, link counts and bounded excerpts — not complete page copies. Retrieved content is used solely to produce your report.',
        ],
      },
      {
        heading: '5. Third-party processors',
        paragraphs: ['We share data only with processors required to run the service:'],
        bullets: [
          'Stripe — payment processing, subscription management and the customer billing portal.',
          'Our hosting and database provider — application hosting and data storage.',
          'An email delivery provider — transactional email, where configured.',
          'An AI provider — only if narrative enhancement is enabled, and only computed scores and check outcomes are sent. Passwords, payment data and unnecessary personal information are never included.',
          'A search data provider — only if public-web observations are enabled, and only the brand and service terms used in the queries are sent.',
        ],
      },
      {
        heading: '6. Retention',
        paragraphs: [
          'Account and audit data are kept while your account is active. Rate-limit records are pruned automatically. Financial records are retained as long as required by law and accounting practice, typically seven years.',
          'When you request account deletion, personal data is removed or irreversibly anonymized except where retention is legally required.',
        ],
      },
      {
        heading: '7. Your rights',
        paragraphs: [
          'Depending on where you live you may have rights to access, correct, export or delete your personal data, to object to or restrict processing, and to withdraw consent for marketing at any time.',
          'You can update your profile and email preferences, and request account deletion, from the settings page. For anything else, contact us.',
        ],
      },
      {
        heading: '8. Security',
        paragraphs: [
          'Passwords are hashed with bcrypt and never stored in plain text. Reset and verification tokens are stored only as salted hashes. Access to administrative functions is restricted by role and checked server-side on every request, with an audit trail of privileged actions. Data is transmitted over TLS. Secrets are held in environment variables and never in the database or the client bundle.',
          'No system is perfectly secure. If you believe you have found a vulnerability, please report it through the contact page.',
        ],
      },
      {
        heading: '9. Cookies',
        paragraphs: [
          'RankInAI uses a small number of cookies, described in the Cookie Policy. Third-party analytics are optional and disabled unless explicitly configured by the operator.',
        ],
      },
      {
        heading: '10. Children',
        paragraphs: [
          'The service is not directed at children under 16 and we do not knowingly collect their personal data.',
        ],
      },
      {
        heading: '11. Changes and contact',
        paragraphs: [
          'We will post any changes to this policy on this page and update the date above. Material changes affecting how personal data is used will be notified by email.',
          'Privacy questions can be sent through the contact page.',
        ],
      },
    ],
  },

  refunds: {
    slug: 'refunds',
    title: 'Refund Policy',
    description: 'When audits and subscriptions are refunded, and how to request one.',
    lastUpdated: LAST_UPDATED,
    intro:
      'This policy explains how refunds and audit credits work. All amounts are in US dollars.',
    sections: [
      {
        heading: '1. Automatic credit restoration',
        paragraphs: [
          'If an audit fails before producing useful results — for example the website is unreachable, DNS does not resolve, or robots.txt blocks all crawling — the audit credit is returned to your account automatically. No request is needed and no charge is retained for that audit.',
          'A restored credit appears immediately in your credit balance and is recorded in your account ledger.',
        ],
      },
      {
        heading: '2. One-time audits',
        paragraphs: [
          'If you purchase a $49 one-time audit and have not yet used the credit, you may request a full refund within 14 days of purchase.',
          'If the audit has been used and completed successfully, the service has been delivered and the purchase is generally non-refundable. If you believe the report is materially defective, contact us with the audit ID and the specific problem — we review these individually and will refund where the report failed to deliver what was described.',
        ],
      },
      {
        heading: '3. Subscriptions',
        paragraphs: [
          'Subscriptions are billed monthly in advance. You can cancel at any time from the billing portal; cancellation stops future renewals and access continues until the end of the paid period.',
          'We do not generally refund partial months. If you were charged after canceling, or charged in error, contact us and we will correct it.',
          'If you subscribed within the last 14 days and have not run any audits in the current period, contact us and we will refund the most recent charge in full.',
        ],
      },
      {
        heading: '4. What is not refundable',
        paragraphs: [
          'Audits that completed successfully and produced a report. Periods in which the plan allowance was used. Charges older than 90 days, except where required by law.',
          'Dissatisfaction with a score is not by itself grounds for a refund — the score reflects observable signals on the website, and the evidence behind every finding is shown in the report so it can be verified.',
        ],
      },
      {
        heading: '5. How to request a refund',
        paragraphs: [
          'Contact us through the contact page with the email address on the account, the approximate purchase date, and the audit ID if the request concerns a specific audit.',
          'We aim to respond within two business days. Approved refunds are returned to the original payment method through Stripe and typically appear within 5-10 business days depending on your bank.',
        ],
      },
      {
        heading: '6. Chargebacks',
        paragraphs: [
          'Please contact us before opening a chargeback. Most issues are resolved faster directly, and an open dispute may cause the account to be suspended until it is settled.',
        ],
      },
    ],
  },

  cookies: {
    slug: 'cookies',
    title: 'Cookie Policy',
    description: 'The cookies RankInAI uses and what they do.',
    lastUpdated: LAST_UPDATED,
    intro:
      'This policy describes the cookies and similar technologies used by RankInAI and why each one is needed.',
    sections: [
      {
        heading: '1. Strictly necessary cookies',
        paragraphs: [
          'These are required for the service to function and cannot be disabled while you are signed in.',
        ],
        bullets: [
          'Session cookie — keeps you signed in. HTTP-only, Secure in production, SameSite=Lax.',
          'CSRF token cookie — protects sign-in and form submissions against cross-site request forgery.',
          'Callback URL cookie — returns you to the page you were on after signing in.',
        ],
      },
      {
        heading: '2. Local browser storage',
        paragraphs: [
          'The application stores an anonymous session identifier in your browser’s session storage. It is used only to group product analytics events within a single visit, is not tied to your identity, and is cleared when you close the tab.',
        ],
      },
      {
        heading: '3. Analytics',
        paragraphs: [
          'RankInAI uses a first-party, privacy-conscious internal analytics system that records which product events occurred — a demo was started, a checkout completed — without storing form values or personal details.',
          'Third-party analytics such as Google Analytics are optional and are only loaded if the operator of this instance has explicitly configured them. The product functions fully without any third-party tracker.',
        ],
      },
      {
        heading: '4. Payment cookies',
        paragraphs: [
          'When you proceed to checkout, Stripe may set its own cookies to process the payment and detect fraud. These are governed by Stripe’s own privacy and cookie policies.',
        ],
      },
      {
        heading: '5. Managing cookies',
        paragraphs: [
          'You can block or delete cookies in your browser settings. Blocking strictly necessary cookies will prevent you from signing in and using the dashboard.',
        ],
      },
    ],
  },

  'acceptable-use': {
    slug: 'acceptable-use',
    title: 'Acceptable Use Policy',
    description: 'How RankInAI may and may not be used.',
    lastUpdated: LAST_UPDATED,
    intro:
      'This policy sets out how the RankInAI service may be used. It forms part of the Terms of Service. Breaching it may result in suspension or termination.',
    sections: [
      {
        heading: '1. Authorization',
        paragraphs: [
          'You may submit a website for a full audit only if you own it, operate it, or are authorized by the owner to have it analyzed. Auditing a website you have no relationship with, in breach of its terms or applicable law, is prohibited.',
        ],
      },
      {
        heading: '2. Prohibited uses',
        paragraphs: ['You must not use the service to:'],
        bullets: [
          'Attempt to overload, stress, degrade or deny service to any website, including through repeated or automated audit submission.',
          'Access or attempt to access private, internal, authenticated or otherwise non-public content.',
          'Probe internal networks, cloud metadata endpoints or infrastructure that is not a public website.',
          'Circumvent the platform’s rate limits, entitlement checks, authentication or authorization controls.',
          'Scrape, resell, sublicense or redistribute access to the platform itself, or represent the audit engine as your own software.',
          'Submit content that is unlawful, infringing, malicious or designed to harm others.',
          'Reverse engineer the service other than to the extent that restriction is prohibited by law.',
        ],
      },
      {
        heading: '3. How our crawler behaves',
        paragraphs: [
          'The RankInAI crawler identifies itself as RankInAI-Auditor. It honors robots.txt directives for its own agent, requests only publicly accessible pages, applies a request timeout and a response size limit, follows a bounded number of redirects, and paces its requests.',
          'It never submits forms, never authenticates to an audited website, never executes downloaded files, and never requests cart, checkout, account or login URLs.',
        ],
      },
      {
        heading: '4. Fair use of plan allowances',
        paragraphs: [
          'Plan allowances are intended for genuine audit work. Automated cycling of audits to extract bulk data, or sharing one account across multiple unrelated organizations, is not fair use and may result in suspension.',
        ],
      },
      {
        heading: '5. Reporting abuse',
        paragraphs: [
          'If you believe the RankInAI crawler has behaved improperly against a website you operate, or that an account is misusing the service, contact us through the contact page with the relevant details and we will investigate.',
        ],
      },
      {
        heading: '6. Enforcement',
        paragraphs: [
          'We may investigate suspected breaches and take proportionate action, including warning, rate limiting, suspension or termination of the account. Serious or unlawful conduct may be reported to the appropriate authorities.',
        ],
      },
    ],
  },
};

export const LEGAL_SLUGS = Object.keys(LEGAL_DOCUMENTS);
