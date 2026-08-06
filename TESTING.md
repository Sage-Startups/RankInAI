# Testing

## What exists

| Suite       | Count | Runner     | Needs                |
| ----------- | ----- | ---------- | -------------------- |
| Unit        | 237   | Vitest     | nothing              |
| Integration | 94    | Vitest     | PostgreSQL           |
| End-to-end  | 37    | Playwright | PostgreSQL, Chromium |

All 368 pass. See `BUILD_STATUS.md` for the last recorded run.

## Running them

```bash
npm test              # unit + integration
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:e2e:install   # first time only, installs Chromium
```

The test database is `rankinai_test`. Integration setup refuses to run against a
`DATABASE_URL` whose name does not contain `test`, so a mistyped variable cannot
wipe development data.

## How the test environment is configured

`tests/test-env.ts` is the single definition, and it writes `.env.test` on every run.

This is not incidental. Next.js loads `.env` itself and lets the file win over values
already present in `process.env`, so passing settings to a child process is not
enough — the application would read the developer's `.env` and use the development
database while the worker used the test one. Running the E2E web server with
`NODE_ENV=test` makes Next read `.env.test` first, and that file is authoritative.

`.env.test` is git-ignored and regenerated. Do not hand-edit it.

## Unit tests

`tests/unit/` — pure logic, no database, no network.

- `url-safety.test.ts` — the full SSRF rejection table (loopback, private ranges,
  CGNAT, link-local, the metadata endpoint, IPv4-mapped IPv6, bracketed IPv6,
  internal hostnames, reserved ports, credentials in URLs, non-HTTP schemes), plus
  the fixture bypass being refused in production and scoped to a single port
- `scoring.test.ts` — category weighting, weight rebalancing when Competitive
  Visibility is unavailable, band boundaries, determinism
- `audit-checks.test.ts` — each check against crafted page signals
- `plans.test.ts` — the pricing catalog, entitlements per tier, and `isProductKey`
  rejecting `__proto__`
- `auth-password.test.ts` — hashing, verification, salting, and the work factor
- `preview.test.ts` — the free preview's five-finding cap and its disclaimer
- `demo-data.test.ts` — the April 2026 dataset totals exactly as specified

## Integration tests

`tests/integration/` — real Prisma against a real PostgreSQL.

- `credits.test.ts` — reservation, restoration, ledger/balance agreement, and
  concurrent reservation of a single credit racing under `Promise.allSettled` (only
  one wins)
- `billing-webhook.test.ts` — signature verification, idempotency for a replayed
  event ID _and_ for a repeated checkout session, subscription lifecycle events,
  payment failure
- `auth-and-access.test.ts` — registration, duplicate email, sign-in, password reset,
  suspension taking effect immediately, cross-tenant access refusal
- `audit-pipeline.test.ts` — queue claim under concurrency, retry with backoff,
  credit restoration on permanent failure, a full audit against the fixture, and
  identical scores across repeat runs
- `demo-segregation.test.ts` — before/after deltas proving demo rows are excluded
  from real metrics and included only when explicitly requested

Each file namespaces its data with `useTestScope()` so files cannot clobber each
other; the integration project runs in a single fork, serially, for the same reason.

## End-to-end journeys

`tests/e2e/`. `global-setup.ts` migrates and seeds the test database, clears
rate-limit state, and starts the fixture website and the audit worker as child
processes; `global-teardown.ts` signals their process groups so nothing is orphaned.

| File                           | Journey                                                                                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-landing-demo.spec.ts`      | Instant sample demo through to the mini report, demo labeling, pricing CTA, replay                                                                                                       |
| `02-registration.spec.ts`      | Register, onboard, sign out, sign back in; duplicate email, weak password, enumeration resistance                                                                                        |
| `03-one-time-purchase.spec.ts` | Buy the $49 audit, run it against the fixture, confirm the credit is consumed exactly once, open every report section, download and validate the PDF                                     |
| `04-subscription.spec.ts`      | Subscribe to Growth, receive the allowance, spend it (not a credit), switch plans, billing portal state                                                                                  |
| `05-super-admin.spec.ts`       | Admin metrics excluding demo data by default, the toggle revealing exactly the seeded $245, credit grant with a recorded reason and audit-trail entry, every admin screen, buyer preview |
| `06-authorization.spec.ts`     | Admin area and admin data refused server-side, cross-tenant audit and PDF refused, private routes redirected, unsigned webhook rejected, suspension effective immediately                |
| `07-live-preview.spec.ts`      | Anonymous preview against the fixture, five-finding cap, loopback refusal, rate limiting, no page content stored                                                                         |
| `08-accessibility.spec.ts`     | axe-core scans of home, pricing, sign in, sign up, dashboard, new-audit form, a completed report and the admin dashboard                                                                 |

### Per-test client IP

Each E2E test presents a unique `x-forwarded-for` address from `100.64.0.0/10`. The
per-IP rate limits are deliberately tight, and without this a full run looks like one
address registering a dozen accounts in a few minutes — the limiter would correctly
start refusing. Each journey represents a different visitor, so each test presents a
different address.

### Assertions are deltas, not absolutes

The E2E database accumulates across runs and earlier journeys create genuine
(non-demo) payments. Journey 5 therefore asserts that turning the demo toggle on
changes gross revenue by _exactly_ $245.00 and the sale count by exactly 5, rather
than asserting a total. An absolute figure would be asserting the order tests
happened to run in.

## The fixture website

`tests/fixtures/site.ts` — Northbridge Plumbing Co., served on `127.0.0.1:4321` with
deliberate strengths and weaknesses so checks have something real to find.

**Strengths:** `Plumber` schema with `sameAs` and `areaServed`, `FAQPage` schema, a
named author with stated credentials, full name/address/phone, a license number,
question-form headings, lists and tables, a valid `robots.txt` and `sitemap.xml`.

**Weaknesses:** a 53-word service page, a duplicated opening paragraph across two
service pages, "world-class" / "industry-leading" / "the best", a missing meta
description, a broken internal link to `/booking-calendar`, no `llms.txt`, no
comparison content, images without alternative text.

The crawler is allowed to reach it because `ALLOW_TEST_FIXTURE_HOST` names that exact
origin — host **and** port. Production refuses to start with the variable set at all.

## Accessibility

`08-accessibility.spec.ts` runs axe-core with the `wcag2a`, `wcag2aa`, `wcag21a` and
`wcag21aa` rule sets. **Serious and critical violations fail the build.** Minor and
moderate ones are printed to the test output but do not block, because a number of
them are advisory heuristics rather than defects.

Getting to zero required fixing real problems, not adjusting thresholds: a dark-mode
trigger mismatch that rendered marketing headings at 1.06:1 contrast, brand and muted
text colors below 4.5:1, a `<dl>` whose `<dt>`/`<dd>` were nested two levels deep, and
horizontally scrollable `<pre>` blocks that keyboard users could not reach.

## Full audit validation

```bash
npm run audit:full-test
```

Runs a complete audit against the fixture — crawl, checks, scoring, findings,
recommendations, competitor comparison, PDF — then writes
`FULL_AUDIT_TEST_REPORT.md` from what actually happened. It also runs the audit twice
and compares every category score, and once more without a competitor to confirm
weight rebalancing. It exits non-zero if the audit fails, the PDF is malformed, or
the scores are not identical across runs. Records it creates are removed afterwards.

## Adding tests

- New audit check → a case in `tests/unit/audit-checks.test.ts`, and extend
  `tests/fixtures/site.ts` if it should fire on the fixture.
- New server action → an integration test; assert the authorization failure as well
  as the success.
- New user-facing flow → extend the relevant journey rather than adding a new file,
  so the run stays sequential and fast.
- Import `test` and `expect` from `./helpers`, not from `@playwright/test`, so the
  per-test client IP fixture applies.

## What is not covered

- Live Stripe API calls. Checkout is exercised through the simulated path, which runs
  the same fulfillment code the webhook calls. Verify the real integration with
  Stripe test-mode keys and the CLI before going live — see `STRIPE_SETUP.md`.
- Real OpenAI calls. Audits run without a key; the LLM adds narrative only and never
  changes a score.
- Cross-browser. The E2E suite runs Chromium.
- Load and performance testing.
