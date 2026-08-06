/**
 * Static marketing/site metadata. Safe to import from client components —
 * contains no secrets.
 */

export const SITE = {
  name: 'RankInAI',
  tagline: 'See whether AI can find, understand and recommend your brand.',
  description:
    'RankInAI audits your website’s technical accessibility, entity clarity, content authority and answer readiness, then gives you a prioritized plan for improving AI-search visibility.',
  shortDescription: 'AI visibility and Generative Engine Optimization audits for US businesses.',
  locale: 'en_US',
  twitterHandle: '@rankinai',
} as const;

export function appUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

export function absoluteUrl(path = ''): string {
  const base = appUrl();
  if (!path) return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export const MAIN_NAV = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/sample-report', label: 'Sample report' },
  { href: '/demo', label: 'Demo' },
] as const;

export const FOOTER_NAV: Array<{
  heading: string;
  links: Array<{ href: string; label: string }>;
}> = [
  {
    heading: 'Product',
    links: [
      { href: '/how-it-works', label: 'How it works' },
      { href: '/features', label: 'Features' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/demo', label: 'Free demo' },
      { href: '/sample-report', label: 'Sample report' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
      { href: '/signup', label: 'Create an account' },
      { href: '/signin', label: 'Sign in' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/legal/terms', label: 'Terms of Service' },
      { href: '/legal/privacy', label: 'Privacy Policy' },
      { href: '/legal/refunds', label: 'Refund Policy' },
      { href: '/legal/cookies', label: 'Cookie Policy' },
      { href: '/legal/acceptable-use', label: 'Acceptable Use Policy' },
    ],
  },
];

/** Sample testimonials — clearly labeled as samples until replaced with real ones. */
export const SAMPLE_TESTIMONIALS = [
  {
    quote:
      'The audit told us exactly why our service pages were invisible to answer engines. Adding FAQ schema and rewriting six headings took an afternoon.',
    name: 'Sample testimonial',
    role: 'Marketing lead, home services company',
  },
  {
    quote:
      'We run RankInAI on every new client during onboarding. The prioritized action plan is what we present in the first strategy meeting.',
    name: 'Sample testimonial',
    role: 'Founder, digital marketing agency',
  },
  {
    quote:
      'What sold me was the evidence panel. Every finding shows what was actually found on the page rather than a generic recommendation.',
    name: 'Sample testimonial',
    role: 'Independent SEO consultant',
  },
] as const;

export const TESTIMONIAL_NOTICE =
  'These are sample testimonials illustrating the kind of feedback the product is designed to earn. They will be replaced with attributed customer quotes as they are collected.';

export const HOME_FAQS = [
  {
    question: 'What is Generative Engine Optimization (GEO)?',
    answer:
      'GEO is the practice of structuring a website so that generative AI systems and answer engines can crawl it, understand what the business does, extract useful answer passages and attribute them correctly. It overlaps with SEO but optimizes for retrieval and citation rather than for a ranked list of blue links.',
  },
  {
    question: 'Can RankInAI guarantee that ChatGPT or Perplexity will recommend my business?',
    answer:
      'No, and any tool that claims otherwise is overstating what is possible. No third party controls what a given AI system says. RankInAI measures the website signals that influence whether those systems can discover, understand, retrieve and attribute your content — and tells you which ones are missing.',
  },
  {
    question: 'How is this different from a standard SEO audit?',
    answer:
      'A traditional SEO audit optimizes for ranking a page in a results list. RankInAI evaluates whether individual passages can be extracted and reused as answers: entity clarity, answer-ready structure, first-party evidence, authorship and machine-readable schema. Technical accessibility overlaps; the rest largely does not.',
  },
  {
    question: 'What does the audit actually look at?',
    answer:
      'RankInAI crawls up to 50 pages depending on your plan and inspects robots.txt, sitemaps, llms.txt, HTTP status and redirects, canonicals, indexability, metadata, heading structure, content depth and freshness, JSON-LD schema completeness, FAQ and question coverage, authorship, contact and trust signals, internal linking and outbound citations.',
  },
  {
    question: 'Do the scores change if I run the same audit twice?',
    answer:
      'No. The audit engine is deterministic and rule-based. The same website content always produces the same category scores. An optional AI enhancement can improve the wording of summaries and explanations, but it can never change a score or alter observed evidence.',
  },
  {
    question: 'Do I need a subscription to try it?',
    answer:
      'No. The instant demo and the free homepage preview both run without an account. A single complete audit is $49 as a one-time purchase, or you can subscribe from $29 per month.',
  },
  {
    question: 'Is it safe to point RankInAI at my site?',
    answer:
      'Yes. The crawler identifies itself as RankInAI-Auditor, honors robots.txt, never submits forms, never signs in, never executes downloaded files and requests only public pages. It reads your site the way a search crawler does.',
  },
  {
    question: 'Can I audit a competitor’s website?',
    answer:
      'You can supply competitor URLs for comparison, and RankInAI fetches a single public homepage from each. It does not crawl a competitor’s site in depth. When you create an audit you confirm you are authorized to audit the primary website you submit.',
  },
];
