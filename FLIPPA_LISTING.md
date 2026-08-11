# Flippa listing copy

Paste-ready text for each section of the Flippa listing form.

**One rule governs all of it:** this asset has no customers and no revenue. Every
figure below is a property of the software, not of a trading business, and the
copy says so plainly in the sections where a buyer expects numbers. A listing
that implies traction collapses at diligence — and the demonstration data inside
the product is labeled as fabricated everywhere it appears, so a buyer _will_
find the discrepancy. Selling this honestly as a finished build is both the
truthful position and the stronger one.

---

## Key Highlights

- **A finished, deployed SaaS — not a template, a prototype, or a landing page.**
  The full stack is built and running: audit engine, user accounts, billing,
  customer dashboard, PDF report generation, background job queue, and a
  super-admin area. No stub pages, no dead buttons, no "coming soon".

- **It sells into the fastest-moving gap in search right now.** Buyers ask AI
  assistants questions instead of typing keywords, and the agencies that have
  sold SEO for twenty years have nothing to sell for it yet. This audits how
  ready a website is to be found, understood and cited by AI systems — and
  produces a report a consultant can put their name on.

- **76 deterministic checks across 7 weighted categories.** Technical
  accessibility, entity clarity, content authority, answer readiness, structured
  data, trust and evidence, competitive visibility. The same site scores
  identically on a repeat run — the test suite asserts it — which is what makes
  month-over-month tracking meaningful and defensible to a client.

- **Two revenue models, both wired to Stripe and already coded.** A $49 one-time
  audit that removes the commitment objection at the moment a visitor sees a
  problem on their own site, and three monthly plans at $29, $79 and $199 with
  enforced entitlements, credit ledgers and a customer billing portal.

- **397 automated tests, all passing, none skipped.** 265 unit, 94 integration
  and 38 end-to-end tests covering seven complete user journeys, plus accessibility
  scans of nine screens that fail the build on any serious or critical violation.
  A buyer can change something and know within minutes whether they broke it.

- **Built to be handed over.** Twelve documentation files covering architecture,
  the scoring methodology, security posture, testing, Railway and Stripe setup,
  and a handover document written for a buyer to read _before_ an offer. A
  `npm run verify` command reports exactly what any environment is still missing.

- **Security is designed in, not bolted on.** Three-layer defense against
  server-side request forgery in the crawler, server-side authorization on every
  privileged route, bcrypt at cost 12, Stripe webhooks as the sole source of
  entitlement truth, and rate limiting on every public endpoint.

### The biggest opportunities for a new owner

- **Turn on payments and start selling.** Stripe is fully integrated and tested;
  it needs an account, the included setup script, and the keys. That is the
  shortest path from purchase to first dollar.
- **Sell the $49 audit as the wedge, upgrade to the $79 plan.** The one-time buyer
  arrives with a completed audit, a delivered report and a visible problem list —
  the three things that make a subscription upgrade a conversation rather than a
  cold pitch.
- **White-label it for agencies.** Agency-tier white-labeled reports are already
  built. One agency reselling audits to its client base is worth more than dozens
  of individual buyers, and the product already supports it.
- **Own the content niche while it is still open.** "GEO" and "AI visibility" are
  early enough that a determined content and outreach effort can still rank for
  the category terms.
- **Add the platform observation layer.** The architecture reserves space for
  search-provider and LLM integrations, both currently optional and switched off.
  A new owner can extend the engine without restructuring anything.

---

## Operations

**What the business does.** RankInAI audits a website's readiness to be found,
understood and cited by AI assistants and AI-powered search. A visitor enters a
URL; the platform crawls up to ten pages, runs 76 deterministic checks across
seven weighted categories, and produces an overall AI Visibility Score with
category breakdowns, evidence for every finding, a prioritized action plan sorted
by impact against effort, and a branded PDF report.

**How it makes money.** Two ways, both already built:

| Product             | Price      | What the customer gets                                  |
| ------------------- | ---------- | ------------------------------------------------------- |
| One-Time Full Audit | $49        | One complete audit, PDF report, credit never expires    |
| Starter             | $29/month  | 3 audits per period, saved history                      |
| Growth              | $79/month  | More audits, competitor comparison, historical tracking |
| Agency              | $199/month | White-labeled reports, CSV export, priority queue       |

Payment runs through Stripe Checkout. Entitlements are granted only by verified
Stripe webhooks — never by the browser — and every webhook event is recorded with
a unique ID so a replayed delivery cannot grant a second credit.

**What keeps it running.** The software is designed to need very little. The audit
engine is fully automated: a customer starts an audit, a background worker claims
the job, crawls, scores and generates the report without anyone touching it.
Failed jobs retry with backoff, stale locks are reclaimed, and a credit is
returned automatically if a job fails before producing results.

Recurring operational work, honestly estimated:

- **Infrastructure monitoring** — roughly 1 hour per week. Railway hosts the web
  service, the worker and PostgreSQL. A health endpoint reports database and queue
  status; the admin area shows the job queue and system state.
- **Customer support** — email only, and volume scales with customers. At the
  current zero-customer baseline this is zero. Budget 1–3 hours per week early on.
- **Dependency and security updates** — 1–2 hours per month.

**Total: approximately 2–4 hours per week to keep the platform running**, excluding
any marketing or sales effort. Marketing is where a new owner's real time goes,
and how much is entirely their decision.

**What it does not require.** No inventory, no fulfillment, no staff, no manual
report writing, no phone support, and no headless browser farm — PDFs are rendered
in-process and cached in the database.

**Current infrastructure cost:** Railway hosting for two services and a PostgreSQL
database, in the region of $10–25 per month at low volume. The LLM and
search-provider integrations are optional and currently switched off, so they cost
nothing; enabling them adds per-audit API costs a new owner controls.

---

## Customers

**There are none. This asset is pre-revenue and pre-traffic.**

The platform was built and deployed but has not been marketed, has never been
opened to the public, and has never taken a live payment. There are no customers,
no email list, no traffic history and no social following. A buyer is purchasing a
finished product and the position it occupies, not a book of business.

Please read that alongside the demonstration data inside the product. The
application ships with clearly fabricated sample records so the interface can be
shown populated rather than empty. Every one of those rows is stored with an
`isDemo` flag, is excluded from real reporting by default, and is labeled as
demonstration data wherever it appears. **None of it represents a real customer or
a real payment, and there is deliberately no feature that removes those labels.**

**Who the product is built for.** The target market is US-based:

- Small and mid-sized businesses that depend on being found — home services, legal,
  dental and medical practices, accountants, local trades
- SEO and digital marketing agencies who need something new to sell to existing
  clients
- Independent SEO consultants and freelancers
- Website owners and in-house marketers responsible for organic visibility

**How a new owner would acquire them.** The product is designed around a specific
acquisition path, and that path is built:

1. A visitor lands on the site and runs the **instant demo** — a fictional sample
   report, no signup, no waiting.
2. Or they run the **free live preview** on their own homepage, which returns a
   real partial result with up to five real findings about their actual website.
3. Seeing a genuine problem on their own site is the conversion moment. The $49
   one-time audit is priced to be an easy decision at exactly that point.
4. The completed audit, the delivered report and the visible problem list then make
   a monthly plan a natural next step.

The free preview is rate-limited and stores only hashed operational metadata, so
it can be promoted without becoming an abuse vector or a privacy liability.

**Expected geography:** domestic US. Copy, currency and examples are US English and
US dollars throughout. Nothing prevents international use, and the audit engine is
language-agnostic in its technical checks.

**Repeat purchase behavior:** untested, because there have been no customers. What
can be said is structural rather than empirical — the audit engine is deterministic,
so re-auditing the same site after fixes produces a directly comparable score, which
is the mechanism that makes a subscription worth keeping. Whether customers value
that in practice is exactly what a new owner will find out first.

---

## Financials

**Revenue to date: $0. Profit to date: $0. There is no trading history to analyze,
and no P&L to explain.**

This is a newly completed software asset being sold before commercialization. There
are no financial anomalies, no seasonality, no decline and no growth — there is no
trading period at all. Any listed valuation reflects development cost, the finished
state of the software, and the market position; it is not a multiple of earnings.

**On the demonstration figures inside the product.** The application contains seeded
sample data — including a June–July 2026 snapshot showing three one-time audits and
one subscription, and an April 2026 dataset showing five one-time sales. These exist
solely so the analytics screens can be demonstrated with data in them. **Every figure
is invented.** They are labeled as demonstration data on screen, excluded from real
reporting by default, and stored in the database with a flag that separates them from
genuine records. They must not be read as revenue, and they are not offered as such.

**Costs a new owner inherits.** Hosting on Railway of roughly $10–25 per month at
low volume, plus a domain. Stripe charges standard processing fees on transactions
only. The optional LLM and search-provider integrations are switched off and cost
nothing unless a new owner enables them.

**What the buyer is actually acquiring:** the complete source code and its full
history, the audit engine and its scoring methodology, the database schema and
migrations, the Stripe integration, the test suite, all documentation, the deployed
Railway environment, and the RankInAI brand and domain.

**Unit economics, stated as design rather than as results.** The one-time audit is
priced at $49 against a marginal cost per audit measured in fractions of a cent —
the crawl and the 76 checks run on the buyer's own infrastructure, and the PDF is
generated in-process. Gross margin per audit is therefore very high by construction.
The number that determines whether this is a business is customer acquisition cost,
and that number is unknown because no acquisition has been attempted. A buyer should
treat their own marketing test as the first real experiment, not as a formality.

---

## Additional Notes

**How this came to exist.** RankInAI was built as a complete, production-grade
product from a single detailed specification, then deployed. The intent was to
build the whole thing properly — engine, payments, admin, tests, documentation,
deployment — rather than a demo to flip. The commit history is intact and comes
with the sale, including the deployment work: the failures, the diagnosis and the
fixes are all in the record.

**Technology.** Next.js 15 with React 19 and the App Router, TypeScript in strict
mode, PostgreSQL with Prisma, Auth.js for authentication, Stripe for payments,
Tailwind CSS v4, PDFKit for report generation, and a separate worker process for the
job queue. Deployed on Railway. Every one of these is a mainstream, well-documented
choice — a new owner or a hired developer will not be learning a bespoke framework.

**What is genuinely complete.** The audit engine and its 76 checks. Accounts,
onboarding, dashboard and audit history. Stripe checkout, webhooks, the customer
portal and credit ledgers. The interactive report and the branded PDF. The
super-admin area with users, audits, jobs, payments, subscriptions, analytics,
contacts, settings and demo-data segregation. The public marketing site with the
instant demo and free live preview. The test suite. The documentation.

**What a new owner still needs to do — stated plainly, because they will find out
anyway:**

1. **Connect a Stripe account.** The integration is complete and tested through a
   simulated path that runs the identical fulfillment code, but taking live payments
   needs a Stripe account and the keys. A setup script creates the products and
   prices.
2. **Start the background worker service.** The web application is live; the worker
   that processes audits is a second service that needs to be created from the same
   repository. The setup document has the exact steps.
3. **Configure an email provider.** Verification and notification emails currently
   log to the console rather than sending.
4. **Have the legal pages reviewed.** Terms, privacy policy, refund policy, cookie
   policy and disclaimer are editable templates flagged in the admin area as
   requiring legal review. They are a starting point, not legal advice, and they
   have not been reviewed by a lawyer.
5. **Optionally enable the LLM narrative layer.** An OpenAI-compatible key adds
   written narrative to reports. It is off by default, and — deliberately — it never
   changes a score, so the audit stays deterministic with or without it.

**On honest positioning, which matters commercially.** The product never claims it
can guarantee that ChatGPT, Perplexity, Gemini or Copilot will mention a company,
because no one can. It measures readiness against published, checkable criteria and
says so. That constraint is written into the copy, the report, the methodology
document and the disclaimers. A new owner is strongly advised to keep it: the
category will attract operators making guarantees they cannot keep, and the ones
who do will collect the refund requests and the complaints.

**What is not included.** No customer list, no traffic, no revenue, no email list,
no social accounts, no backlink profile, and no third-party accounts — a buyer
creates their own Stripe, email and hosting accounts. No trademark registration.

**Handover.** The repository contains a handover document written specifically for a
buyer, covering the demonstration-data caveat, the current state of every component,
the setup sequence and the known gaps. A reasonable transition-support window can be
agreed as part of the sale. Everything a buyer needs to run this is in the
repository — nothing important lives only in the seller's head.
