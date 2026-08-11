# Handover Notes

For a prospective buyer or a new owner-operator. Written to be read before an offer,
not after.

## Read this first: the demonstration data is fabricated

The repository ships with a seeded demonstration dataset covering April 2026 —
3 signups, 5 one-time $49 payments, $245.00 gross revenue, 5 audit credits issued,
5 completed audits. It is visible at `/business-snapshot` and, when an administrator
explicitly turns on "Include demo data", in the admin metrics.

**Every one of those figures is invented.** They exist so the product can be
demonstrated with a populated interface. They are not revenue, not customers, and not
historical performance.

**These fabricated or seeded metrics must never be represented to a buyer as genuine
financial performance.** Doing so would be misrepresentation in a sale.

Safeguards built into the product:

- Every demonstration row carries `isDemo: true` in the database.
- Real admin metrics exclude demo rows by default on every screen.
- Turning the toggle on displays a warning stating the figures must never be
  presented to a buyer as genuine financial results.
- `/business-snapshot` is excluded from navigation, sends
  `X-Robots-Tag: noindex, nofollow, noarchive`, is watermarked, and carries this
  banner twice, verbatim:

  > DEMO BUSINESS DATA — FOR PRODUCT PRESENTATION ONLY. THIS IS NOT VERIFIED REVENUE
  > OR ACTUAL HISTORICAL PERFORMANCE.

- There is **no feature that removes a demo disclaimer from a fabricated record**, and
  one must not be added.

Real Stripe transactions are recorded with `isDemo: false` and appear in real metrics
automatically. If this deployment has genuine trading history, it is those rows — and
the Stripe dashboard, which is the authoritative source — that a buyer should be shown.

## What is being sold

A complete, working SaaS product: an AI visibility and Generative Engine Optimization
auditing platform for US businesses, agencies and consultants. Source code, database
schema, audit engine, billing integration, admin tooling, test suite and
documentation.

**It is code and product, not a trading business.** As shipped, there are no
customers, no revenue and no traffic.

## Current state

|             |                                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code        | Complete. No stubs, no dead buttons, no unimplemented pages.                                                                                                  |
| Tests       | 265 unit, 94 integration, 38 end-to-end. All pass.                                                                                                            |
| Build       | `npm run build` succeeds; standalone output ready for Railway.                                                                                                |
| Deployment  | **Live** on Railway at https://rankinai-production.up.railway.app — `/api/health` reports ok. The worker service is not yet running; see RAILWAY_SETUP.md §3. |
| Stripe      | Integrated and tested through a simulated path that runs the real fulfillment code. Needs a Stripe account and the setup script to take live payments.        |
| Legal pages | Editable templates, flagged as such in the admin area. Not reviewed by a lawyer.                                                                              |

`BUILD_STATUS.md` has the detailed breakdown, including everything found and fixed
during the build.

## What a new owner needs

1. **A Railway account** (or any Node + PostgreSQL host). `RAILWAY_SETUP.md` gives the
   exact services, commands, environment variables and post-deploy checks. Expect
   roughly $10–25/month for the database, web service and worker at low volume.
2. **A Stripe account.** `npm run stripe:setup` creates the products and prints the
   price IDs. `STRIPE_SETUP.md` covers the webhook and the go-live checklist.
3. **A domain**, pointed at the web service.
4. **A legal review** of the five legal templates before taking payments.
5. Optionally an OpenAI key (adds AI-written narrative; scores never depend on it),
   a Serper key (adds public-web search observations), and an email provider key.

## Running costs

| Item                                | Rough monthly cost at low volume |
| ----------------------------------- | -------------------------------- |
| Railway (PostgreSQL + web + worker) | $10–25                           |
| Domain                              | ~$1                              |
| Stripe                              | 2.9% + $0.30 per transaction     |
| OpenAI (optional)                   | Cents per audit on a small model |
| Serper (optional)                   | Free tier covers early volume    |

There is no per-audit infrastructure cost beyond compute — the crawler and the
scoring engine are entirely in-house, and PDFs are rendered without a headless
browser.

## Where the value is

- **The audit engine.** 76 deterministic checks across seven weighted categories,
  built from scratch. Reproducible scoring is what makes progress tracking — and
  therefore subscriptions — defensible.
- **Honest positioning.** The product never claims it can guarantee a mention on
  ChatGPT, Perplexity, Gemini or Copilot, because nobody can. It reports readiness and
  labels the difference between measured signals, search observations, AI
  interpretation and sample data. That is a durable position when competitors
  overclaim and get caught.
- **The security work.** Three-layer SSRF protection with connection pinning is the
  hard part of shipping a product that fetches user-supplied URLs, and it is done.
- **The test suite.** 368 tests mean a new owner can change things without guessing.

## Known risks

- **No trading history.** Pre-revenue.
- **Platform dependence.** Retrieval and citation behavior at OpenAI, Google,
  Perplexity and Microsoft is undocumented and changes without notice. The checks
  encode current best understanding of GEO and will need maintenance. This is the
  category's central risk, and it applies to every competitor equally.
- **A crowded and young category.** GEO/AEO tooling is growing quickly.
- **Legal templates are unreviewed.**
- **Next.js 16 upgrade pending** to clear three transitive dependency advisories.
  Neither is reachable from user input as the code stands; `BUILD_STATUS.md` has the
  analysis.

## Handover checklist

- [ ] Repository transferred
- [ ] Domain transferred
- [ ] Railway project transferred, or redeployed under the buyer's account
- [ ] A new `AUTH_SECRET` generated — the seller's must not be reused
- [ ] `SUPER_ADMIN_EMAIL` changed to the buyer's address and the account re-seeded
- [ ] The super-admin password rotated, and `SUPER_ADMIN_SEED_PASSWORD` removed from
      the environment afterwards
- [ ] Stripe account transferred, or new keys and a new webhook endpoint configured
- [ ] All four `STRIPE_PRICE_*` variables updated to the buyer's price IDs
- [ ] Optional provider keys rotated or removed
- [ ] `npm run verify` passes against the buyer's environment
- [ ] The buyer has been told, in writing, that the April 2026 dataset is fabricated
      demonstration data and not financial performance
