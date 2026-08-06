# RankInAI

An AI visibility and Generative Engine Optimization (GEO) auditing platform for US
businesses, agencies and consultants.

RankInAI crawls a website, runs 76 deterministic checks across seven categories, and
produces an evidence-backed report with a prioritized action plan — as an interactive
web report and a downloadable PDF.

## What it measures, and what it does not

RankInAI measures **signals it can read from your website**: whether AI crawlers are
allowed in, whether your business entity is stated clearly, whether your content is
substantive and attributable, whether it is structured in a way retrieval systems can
extract, and whether it carries the trust markers that make a citation defensible.

It does **not** measure whether ChatGPT, Perplexity, Gemini or Copilot actually mention
your business, and no audit can establish that. Those systems do not publish their
retrieval or citation criteria, and their behavior changes without notice. RankInAI
reports GEO readiness. Improving readiness may improve discoverability; it guarantees
nothing about any specific platform's output.

Every report separates four kinds of information, and labels each one:

1. Signals measured directly from your website
2. Optional public-web search observations (only when a search provider is configured)
3. AI-generated interpretation of those signals (only when an LLM key is configured)
4. Sample or demonstration information

## Stack

| Layer     | Choice                                                 |
| --------- | ------------------------------------------------------ |
| Framework | Next.js 15 (App Router, React 19, standalone output)   |
| Language  | TypeScript, strict mode                                |
| Styling   | Tailwind CSS v4, hand-written Radix-based primitives   |
| Database  | PostgreSQL via Prisma                                  |
| Auth      | Auth.js v5, credentials provider, bcrypt at cost 12    |
| Payments  | Stripe Checkout and Customer Portal, webhook-driven    |
| Reports   | PDFKit (no headless browser needed at runtime)         |
| Jobs      | Database-backed queue with a separate worker process   |
| Tests     | Vitest (unit, integration), Playwright (E2E), axe-core |
| Hosting   | Railway                                                |

## Quick start

```bash
# 1. Dependencies
npm ci

# 2. Environment
cp .env.example .env
#    Set DATABASE_URL and AUTH_SECRET at minimum.
#    Generate a secret with:  openssl rand -base64 48

# 3. Database
npm run db:migrate
npm run db:seed

# 4. Run the web app and the worker together
npm run dev:all
```

The app is at http://localhost:3000. Sign in with the address in `SUPER_ADMIN_EMAIL`
and the password you put in `SUPER_ADMIN_SEED_PASSWORD` before seeding.

Without Stripe keys the app starts in **billing test mode**: checkout is simulated
locally through the same fulfillment code the webhook uses, and a banner says so on
every billing screen. The application refuses to start in production with test mode on
unless you explicitly acknowledge it.

## Scripts

| Command                                                       | Purpose                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                                                 | Web app on port 3000                                                |
| `npm run dev:all`                                             | Web app and worker together                                         |
| `npm run worker`                                              | Audit worker only                                                   |
| `npm run build`                                               | Prisma client + production build                                    |
| `npm run start`                                               | Production server (Railway entrypoint)                              |
| `npm run verify`                                              | Report what is configured, missing or blocking                      |
| `npm run lint` / `npm run typecheck` / `npm run format:check` | Static checks                                                       |
| `npm test`                                                    | Unit + integration                                                  |
| `npm run test:e2e`                                            | Playwright journeys and accessibility scans                         |
| `npm run db:migrate` / `db:seed` / `db:studio`                | Database                                                            |
| `npm run stripe:setup`                                        | Create Stripe products and print the price-ID env vars              |
| `npm run audit:full-test`                                     | Run one real audit end to end and write `FULL_AUDIT_TEST_REPORT.md` |
| `npm run security:audit`                                      | `npm audit --audit-level=high`                                      |

## Pricing

All amounts in US dollars.

| Product             | Price        | Audits        | Pages | Competitors |
| ------------------- | ------------ | ------------- | ----- | ----------- |
| One-Time Full Audit | $49 once     | 1             | 10    | 1           |
| Starter             | $29 / month  | 3 per period  | 10    | 1           |
| Growth              | $79 / month  | 15 per period | 25    | 3           |
| Agency              | $199 / month | 60 per period | 50    | 5           |

Stripe price IDs are never hard-coded. They come from `STRIPE_PRICE_ONE_TIME_AUDIT`,
`STRIPE_PRICE_STARTER_MONTHLY`, `STRIPE_PRICE_GROWTH_MONTHLY` and
`STRIPE_PRICE_AGENCY_MONTHLY`; `npm run stripe:setup` creates the products and prints
the values to set.

## Documentation

| File                        | Contents                                                                  |
| --------------------------- | ------------------------------------------------------------------------- |
| `CLAUDE.md`                 | Architecture and conventions for anyone (or anything) working on the code |
| `AUDIT_METHODOLOGY.md`      | Every check, how categories are weighted, what the score means            |
| `SECURITY.md`               | Threat model, controls, and the pre-deployment checklist                  |
| `TESTING.md`                | What is tested, how to run it, how to add to it                           |
| `RAILWAY_SETUP.md`          | Deploying the web service and the worker                                  |
| `STRIPE_SETUP.md`           | Products, prices, webhooks, going live                                    |
| `BUILD_STATUS.md`           | What is built, what is verified, what is outstanding                      |
| `FLIPPA_HANDOVER.md`        | Handover notes for a prospective buyer                                    |
| `FULL_AUDIT_TEST_REPORT.md` | Output of the last real end-to-end audit run                              |

## License

Proprietary. All rights reserved.
