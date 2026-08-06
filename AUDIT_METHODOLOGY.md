# Audit Methodology

How RankInAI produces an AI Visibility Score, what each check looks at, and what the
number does and does not mean.

## The honest version first

RankInAI measures signals it can read from a website. It cannot measure whether
ChatGPT, Perplexity, Gemini, Copilot or any other system actually mentions a business,
because none of them publish their retrieval or citation criteria and all of them
change without notice.

What the score reports is **GEO readiness**: how well a site is set up to be crawled,
understood, extracted from and trusted by systems that generate answers. Improving
readiness may improve discoverability. It guarantees nothing about any platform's
output, and any vendor claiming otherwise is guessing.

## Four kinds of information, always labeled

Every report distinguishes:

1. **Observed** — measured directly from the audited website. Always present.
2. **Search observation** — from a public-web search provider. Only when
   `SEARCH_PROVIDER` is configured; otherwise the section says so.
3. **AI-enhanced** — narrative interpretation written by a language model from the
   observed signals. Only when `OPENAI_API_KEY` is set. **Scores and evidence are
   rule-based either way** — the LLM never changes a score.
4. **Sample / demonstration** — fabricated data used for demos, badged as such.

## Crawling

A polite, identifiable crawler (`CRAWL_USER_AGENT`) fetches public pages:

- `robots.txt` is fetched first and honored. Disallowed paths are not fetched, and
  the report says which ones were skipped.
- Page budget by plan: 10 (one-time and Starter), 25 (Growth), 50 (Agency).
- Per-request timeout, redirect cap and byte cap, all configurable via `CRAWL_*`.
- Only HTML and text content types are read. Response bodies are analyzed in memory
  and not stored; the report keeps derived signals, not page contents.
- Every URL passes three layers of SSRF protection before a socket is opened. See
  `SECURITY.md`.

## The seven categories

| Category                | Weight | What it asks                                                 |
| ----------------------- | ------ | ------------------------------------------------------------ |
| Technical Accessibility | 15%    | Can an AI crawler reach and read the site at all?            |
| Entity Clarity          | 17%    | Is it unambiguous who this business is and what it does?     |
| Content Authority       | 18%    | Is there enough substantive, specific, first-party content?  |
| Answer Readiness        | 17%    | Can a passage be lifted from it to answer a question?        |
| Structured Data         | 13%    | Is the machine-readable layer present, valid and consistent? |
| Trust and Evidence      | 15%    | Is there attribution, contact detail and verifiable proof?   |
| Competitive Visibility  | 5%     | How do these signals compare with a named competitor?        |

When no competitor is supplied, Competitive Visibility is marked **unavailable** and
its 5% is redistributed proportionally across the other six. It is never scored as
zero — an absent measurement is not a bad measurement.

## Scoring

Each category scores 0–100 from its own checks. A check contributes according to its
severity, and severity reflects how much the issue actually impedes an AI system:

| Severity | Meaning                                          |
| -------- | ------------------------------------------------ |
| Critical | The site cannot be crawled, read or identified   |
| High     | A major signal is missing or actively misleading |
| Medium   | A meaningful gap that limits extraction or trust |
| Low      | A refinement                                     |

The overall score is the weighted mean of the available category scores.

| Band      | Score  | Reading                                          |
| --------- | ------ | ------------------------------------------------ |
| Excellent | 85–100 | Strong readiness across the board                |
| Good      | 70–84  | Solid foundations with specific gaps             |
| Fair      | 55–69  | Real obstacles to being understood               |
| Poor      | 40–54  | Substantial work needed                          |
| Critical  | 0–39   | AI systems will struggle to use this site at all |

**Scoring is deterministic.** The same content produces the same score every time —
there is no randomness and no clock-dependent behavior. `npm run audit:full-test`
runs an audit twice and compares every category score, because a number you cannot
reproduce is useless for tracking improvement.

## The checks

76 checks in total.

### Technical Accessibility (16)

`tech.https`, `tech.homepage-status`, `tech.crawl-success`, `tech.robots-txt`,
`tech.ai-crawler-access`, `tech.sitemap`, `tech.llms-txt`, `tech.indexability`,
`tech.canonical`, `tech.redirect-chains`, `tech.broken-links`, `tech.response-time`,
`tech.discoverable-pages`, `tech.lang`, `tech.viewport`, `tech.image-alt`

Covers TLS, HTTP status, `robots.txt` and whether it blocks known AI crawlers
(GPTBot, ClaudeBot, PerplexityBot, Google-Extended and others), `sitemap.xml`,
`llms.txt`, meta-robots directives, canonical correctness, redirect chains, broken
internal links, response time, crawl reach, language declaration, viewport and image
alternative text.

### Entity Clarity (11)

`entity.brand-name-prominence`, `entity.name-consistency`, `entity.what-we-do`,
`entity.service-specificity`, `entity.geographic-clarity`, `entity.audience-definition`,
`entity.about-page`, `entity.title-quality`, `entity.meta-description`,
`entity.duplicate-metadata`, `entity.open-graph`

Whether the business name appears consistently, whether the site states plainly what
it does and for whom, whether the service area is explicit, and whether titles and
descriptions are distinct and informative rather than boilerplate.

### Content Authority (12)

`content.homepage-substance`, `content.average-depth`, `content.thin-pages`,
`content.duplication`, `content.heading-structure`, `content.internal-linking`,
`content.freshness`, `content.factual-specificity`, `content.first-party-evidence`,
`content.editorial-presence`, `content.vague-language`,
`content.unsupported-superlatives`

Depth and substance, near-duplicate pages (compared on both a body excerpt and the
opening paragraph, since templated sites often differ only after the first screen),
heading hierarchy, internal linking, recency signals, concrete facts and figures
versus vague filler, and unsupported superlatives like "world-class" and
"industry-leading" that carry no information a retrieval system can use.

### Answer Readiness (10)

`answer.question-headings`, `answer.faq-coverage`, `answer.front-loaded`,
`answer.passage-sizing`, `answer.definitions`, `answer.lists-and-tables`,
`answer.process-content`, `answer.comparison-content`, `answer.homepage-summary`,
`answer.terminology-consistency`

Whether content is shaped so a passage can be extracted and quoted: question-form
headings, direct answers before elaboration, self-contained passages of a usable
length, definitions, lists and tables, step-by-step process content, comparison
content, and consistent terminology.

### Structured Data (11)

`schema.presence`, `schema.validity`, `schema.organization-present`,
`schema.organization-completeness`, `schema.name-agreement`, `schema.same-as`,
`schema.website`, `schema.breadcrumbs`, `schema.faq`, `schema.author`,
`schema.reviews`, `schema.content-types`

JSON-LD presence and validity, Organization/LocalBusiness completeness, agreement
between structured data and visible content (a mismatch is worse than an absence),
`sameAs` links, WebSite, BreadcrumbList, FAQPage, author markup and review markup.

### Trust and Evidence (10)

`trust.contact-details`, `trust.contact-page`, `trust.legitimacy-markers`,
`trust.author-attribution`, `trust.author-expertise`, `trust.attribution-clarity`,
`trust.customer-proof`, `trust.outbound-citations`, `trust.source-transparency`,
`trust.update-dates`

Full name/address/phone, a real contact route, registration or license numbers, named
authors with stated expertise, customer evidence, outbound citations to sources, and
visible update dates.

### Competitive Visibility (5)

`competitive.overall-signals`, `competitive.structured-data`,
`competitive.content-depth`, `competitive.answer-readiness`, `competitive.unavailable`

The same signal families measured on each supplied competitor and compared. This is a
comparison of _readiness signals_, not of ranking or of AI-platform mentions.

## Findings

Every finding records: category, stable check id, title, status
(pass / warn / fail / not applicable), severity, the evidence it was drawn from, an
explanation of why it matters, a recommended action, effort, impact, the page it
applies to, and whether it was observed or AI-enhanced.

## Recommendations

Findings become actions grouped by horizon:

- **Do first** — high impact, low effort, or blocking everything else
- **Next 30 days** — meaningful improvements with moderate effort
- **Longer-term** — structural work

Each carries an example implementation where one is useful.

## Limitations

- JavaScript-rendered content that requires execution is not seen. RankInAI reads
  server-delivered HTML, as most AI crawlers do.
- Pages behind authentication, paywalls or `robots.txt` disallow are not audited.
- Competitor comparison uses the same public signals; it infers nothing about a
  competitor's traffic, rankings or AI mentions.
- Scores describe the site as crawled on the day of the audit.
- A high score is not a promise of visibility, and a low score is not a prediction of
  invisibility. It is a readiness measurement of the things a website owner can
  actually control.
