# CLAUDE.md

Working notes for anyone — human or AI — changing this codebase. Read this before
making structural changes; several of the decisions below look arbitrary and are not.

## Shape of the repository

```
src/
  app/
    (marketing)/      public pages — permanently dark shell
    (auth)/           sign in, sign up, reset, verify
    (app)/            authenticated dashboard
    (admin)/          super-admin area
    api/              health, preview, audit status, report PDF, Stripe webhook
    checkout/         checkout bridge, success, cancelled
  components/         UI primitives, brand, report, demo, admin widgets
  lib/
    audit/            crawler, fetcher, parser, checks, scoring, engine
    billing/          Stripe client, checkout, webhook processing
    report/           report data assembly, PDF rendering
    auth/             Auth.js config, guards, pure role predicates
    demo/             seeded sample audit and the April 2026 buyer dataset
  worker/             the queue worker process
prisma/               schema, migrations, seed
tests/                unit, integration, e2e, fixtures, shared test env
scripts/              start-web, verify, stripe-setup, full-audit-validation
```

## Conventions

- **TypeScript strict.** No `any` in `src/` — ESLint enforces it.
- **Zod at every boundary.** Form data, API bodies, environment variables.
  Use the `formValue` / `optionalFormValue` / `formChecked` helpers in
  `src/lib/validation.ts` rather than `formData.get()` directly: `get()` returns
  `null` for a missing field, and Zod's `.optional()` rejects `null`, which
  silently makes every optional field required.
- **Server-side authorization only.** Hiding a link is not access control. Every
  privileged path calls `requireUser` / `requireAdmin` (pages) or `requireApiUser` /
  `requireApiAdmin` (route handlers), and each re-reads the user row so a
  suspension or role change takes effect immediately rather than at the next token
  refresh.
- **US English and US dollars** throughout, in code and in copy.
- **Honest positioning.** Never claim RankInAI can guarantee a mention on any AI
  platform. The vocabulary is "AI visibility readiness", "GEO readiness", "may
  improve discoverability".

## Things that will bite you

### The test environment must beat `.env`

Next.js loads `.env` itself and lets the file win over values already in
`process.env`. Passing settings through a child process's environment is therefore
not enough — the app would read the developer's `.env` and use the development
database while the worker used the test one.

`tests/test-env.ts` is the single definition of the test environment. It writes
`.env.test` on every run, and the E2E web server runs with `NODE_ENV=test` so Next
reads `.env.test` ahead of `.env`. Both Vitest's integration setup and
`playwright.config.ts` call `writeTestEnvFile()`. Do not reintroduce a hand-edited
`.env.test`; it is git-ignored and regenerated.

### Dark mode has exactly one trigger

`dark:` utilities are bound to the `.dark` class via `@custom-variant` in
`globals.css`, _not_ to `prefers-color-scheme`. The design tokens are switched by the
same class. When those two disagreed, the marketing shell — which is dark in every
theme — rendered headings at a 1.06:1 contrast ratio, because the tokens stayed
light while the utilities went dark. One trigger, no drift.

The marketing layout carries `className="dark"` for this reason.

### The crawler's SSRF protection is layered, and the layers are separate files

1. `src/lib/audit/url-safety.ts` — syntactic validation. **Contains no Node-only
   imports** so it can be bundled into client components (the onboarding form
   validates URLs in the browser). That is why it has a hand-written `ipVersion()`
   instead of `node:net`'s `isIP`.
2. `src/lib/audit/dns-safety.ts` — DNS resolution, server-only. Rejects when _any_
   returned address is internal, rather than filtering, because a mixed answer is
   almost certainly a rebinding attempt.
3. `src/lib/audit/fetcher.ts` — pins the socket to the already-validated IP with a
   custom `lookup`, re-validates every redirect hop, caps the response size while
   streaming.

`ALLOW_TEST_FIXTURE_HOST` names an exact origin (`127.0.0.1:4321`), not a host. A
host-only entry would open every service on the loopback interface — the database
included — to the crawler. `src/lib/env.ts` refuses to boot production with it set
at all.

### Credits are reserved, not deducted optimistically

`reserveAuditCredit` runs a conditional `updateMany` inside a transaction, so two
concurrent requests cannot both spend the last credit. The ledger row is written in
the same transaction as the balance change, so they cannot diverge. If the job fails
before producing results, `restoreAuditCredit` returns it — idempotently, guarded by
`job.creditRestored`.

### Stripe webhooks are the source of truth

Entitlements are never granted by the browser. `processStripeEvent` claims an event
by inserting a `StripeWebhookEvent` row with a unique `stripeEventId`; a P2002 means
a replay and the handler returns early. The purchase row is a second guard against
double-granting.

Billing test mode runs `fulfillSimulatedCheckout`, which is the _same_ fulfillment
code the webhook calls — so the simulated path exercises the production entitlement
logic rather than a parallel implementation.

### Demo data is segregated by a flag, not by convention

Every business table has `isDemo`. Admin metrics exclude demo rows unless the
`?demo=1` toggle is on, and when it is on the page says so in plain language. There
is deliberately no feature that removes a demo disclaimer from a fabricated record.

## Adding an audit check

1. Add it to the right file in `src/lib/audit/checks/`. Return a finding with a
   category, stable check id, title, status, severity, evidence, explanation,
   recommended action, effort and impact.
2. Give it a stable `checkId` — scores are compared across runs over time.
3. Keep it deterministic. No randomness, no clock-dependent scoring. The suite
   asserts that the same site scores identically on repeat runs.
4. Add a unit test in `tests/unit/audit-checks.test.ts`.
5. If it should show up on the fixture site, extend `tests/fixtures/site.ts`.

## Before you commit

```bash
npm run typecheck && npm run lint && npm run format:check
npm test
npm run test:e2e
```

`npm run verify` reports what an environment is missing before deploying to it.
