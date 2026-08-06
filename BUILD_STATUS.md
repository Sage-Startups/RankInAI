# Build Status

Last updated: 2026-08-06

## Summary

The application is complete and verified locally. **It is not deployed** — this
environment has no Railway, Stripe, OpenAI or search-provider credentials, so no
deployment was performed and no live URL exists. The repository is deployment-ready;
`RAILWAY_SETUP.md` has the exact steps and `npm run verify` reports what any given
environment is still missing.

## Test results

Every figure below is from an actual run, not an estimate.

| Suite                 | Result                     | Command                    |
| --------------------- | -------------------------- | -------------------------- |
| Unit                  | **237 passed**, 0 failed   | `npm run test:unit`        |
| Integration           | **94 passed**, 0 failed    | `npm run test:integration` |
| End-to-end            | **37 passed**, 0 failed    | `npm run test:e2e`         |
| Type check            | clean                      | `npm run typecheck`        |
| Lint                  | clean, 0 errors 0 warnings | `npm run lint`             |
| Format                | clean                      | `npm run format:check`     |
| Production build      | succeeds                   | `npm run build`            |
| Full audit validation | passed                     | `npm run audit:full-test`  |

No test is skipped. The E2E suite includes axe-core accessibility scans of eight
screens with serious and critical violations set to fail the build; all are clean.

The full audit validation run is recorded in `FULL_AUDIT_TEST_REPORT.md`: a complete
audit of the fixture site scoring 75/100 across 10 pages, 75 findings, 25
recommendations and a valid PDF, with identical scores across a repeat run.

## Built and verified

### Public site

Home (announcement bar, hero, instant demo, capability list, workflow, category
explainer, scoring weights, dashboard and report previews, free live preview,
pricing, comparison table, testimonials labeled as samples, FAQ, CTA band), pricing,
how it works, features, sample report, demo, about, contact (database-backed with
honeypot and rate limiting), and five legal pages rendered from editable templates
with an admin warning.

### Demo experience

An instant sample demo — six named steps over roughly five seconds, then an
interactive mini report for the fictional Atlas Roofing & Exteriors, every figure
badged as demonstration data — and a free live preview that analyzes a real homepage,
shows at most five findings, is rate limited, and stores only hashed operational
metadata.

### Audit engine

76 deterministic checks across seven categories, weighted 15/17/18/17/13/15/5 with
proportional rebalancing when Competitive Visibility is unavailable. Works with no
LLM key; the optional LLM adds narrative and never changes a score. Three-layer SSRF
protection with connection pinning and per-hop redirect revalidation.

### Jobs

Database-backed queue, separate worker process, conditional-UPDATE job claiming,
progress heartbeats, exponential backoff, stale-lock reclaim, idempotent credit
restoration, graceful `SIGTERM` shutdown that requeues held work.

### Accounts and billing

Auth.js credentials authentication with bcrypt at cost 12, onboarding, dashboard,
audit history, settings. Stripe Checkout and Customer Portal with webhook-driven
fulfillment, stored event IDs for idempotency, and a simulated billing mode that runs
the same fulfillment code.

### Reports

Nineteen-section interactive report plus a branded PDF with running headers, footers,
page numbers and correct page breaks. Agency white-labeling retains a "Powered by
RankInAI" footer. PDFs are rendered with PDFKit and cached in PostgreSQL — no
headless browser, no local disk.

### Super admin

Overview, users, user detail, audits, audit detail, jobs, payments, subscriptions,
analytics, contacts, settings, system, demo data. Real metrics exclude demonstration
records unless "Include demo data" is explicitly turned on, which is off by default
everywhere and displays a warning when on. Every privileged action writes to an audit
trail.

### Buyer preview

`/business-snapshot` — not in navigation, `noindex, nofollow, noarchive`, watermarked,
and carrying the required disclaimer twice. Seeded April 2026 dataset: 3 signups,
5 one-time $49 payments, $245.00 gross, $0 subscription revenue, 5 credits issued,
5 completed audits, every row `isDemo: true`.

## Fixed during the build

Problems found by the test suite and fixed properly rather than worked around:

- **Optional form fields were effectively required.** `formData.get()` returns `null`
  for a missing field and Zod's `.optional()` rejects `null`, so any form with an
  untouched optional field failed validation with no visible error. Fixed with
  `formValue` / `optionalFormValue` / `formChecked` helpers applied across all seven
  server-action files.
- **The test-fixture SSRF bypass was too broad.** It allow-listed a whole host, which
  exposed every service on the loopback interface — the database included — whenever
  it was enabled. Narrowed to an exact origin.
- **Dark mode had two disagreeing triggers.** Tailwind's `dark:` variant followed
  `prefers-color-scheme` while the design tokens followed a `.dark` class. On the
  permanently dark marketing shell this rendered headings at a 1.06:1 contrast ratio.
  Bound both to the class.
- **Accessibility defects:** brand and muted text below 4.5:1, a `<dl>` whose
  `<dt>`/`<dd>` were nested two levels deep, and scrollable `<pre>` blocks keyboard
  users could not reach.
- **`isProductKey('__proto__')` returned true** — a prototype-pollution gap caught by
  a unit test. Now uses `Object.hasOwn`.
- **Simulated checkout redirected to an absolute URL** built from
  `NEXT_PUBLIC_APP_URL`, which broke whenever that did not match the browser's host.
  Now relative; the Stripe path still uses the absolute URL it requires.
- **`registrableDomain('127.0.0.1')` returned `'0.1'`** — IP literals are now returned
  unchanged.
- **Bracketed IPv6 literals were misclassified** as blocked hostnames rather than as
  the address type they are.

## Outstanding — needs credentials, not code

None of these are code gaps. Each needs a secret this environment does not have.

| Item                             | What is needed                                                                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deployment                       | A Railway account. Follow `RAILWAY_SETUP.md`.                                                                                                                                      |
| Live payments                    | A Stripe account. Run `npm run stripe:setup`, set the four price IDs and the webhook secret.                                                                                       |
| Real Stripe webhook verification | Test-mode keys plus `stripe listen`. The simulated path exercises the same fulfillment code, but the signature verification itself has only been tested with synthetic signatures. |
| AI narrative enhancement         | `OPENAI_API_KEY`. Optional — audits are fully functional without it and scores never depend on it.                                                                                 |
| Public-web search observations   | `SEARCH_PROVIDER=serper` and `SERPER_API_KEY`. Optional — the report states when they are unavailable.                                                                             |
| Transactional email              | An email provider key. Falls back to console logging.                                                                                                                              |
| Legal review                     | The five legal pages are editable templates and are marked as such in the admin area. They are not legal advice and should be reviewed before taking payments.                     |

## Known limitations

- The E2E suite runs Chromium only.
- No load or performance testing has been done.
- JavaScript-rendered content is not executed during a crawl; RankInAI reads
  server-delivered HTML, as most AI crawlers do. This is documented in
  `AUDIT_METHODOLOGY.md` and stated in each report's limitations section.
- `npm audit` reports 3 high-severity advisories, all in Next.js 15's own transitive
  dependencies. `npm audit fix --force` resolves them only by installing Next 16, a
  breaking major upgrade, so they are documented rather than silently applied:

  | Package   | Advisories                                                                                              | Exposure here                                                                                                                          |
  | --------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
  | `postcss` | 4 (XSS via unescaped `</style>`, arbitrary `.map` file read via attacker-controlled `sourceMappingURL`) | Build-time only. It processes this repository's own stylesheets, never user input. Not in the runtime bundle.                          |
  | `sharp`   | libvips CVEs via `next/image` optimization                                                              | The codebase does not import `next/image` anywhere and configures no remote image patterns, so no user-supplied image reaches `sharp`. |

  Neither is reachable from user input as the application is written today. The
  upgrade to Next 16 should still be scheduled — re-check with
  `npm run security:audit` before release, and again if `next/image` is ever adopted.
