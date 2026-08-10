# Security

## Threat model

RankInAI accepts an arbitrary URL from a user and fetches it from a server holding a
database and API credentials. That makes **server-side request forgery the primary
risk**, ahead of everything else. The secondary risks are ordinary for a paid SaaS:
authorization bypass between tenants, payment fraud through forged webhooks, and
credential attacks on the auth endpoints.

## SSRF protection

Three independent layers. Each assumes the previous one may have been bypassed.

### Layer 1 — syntactic validation (`src/lib/audit/url-safety.ts`)

Rejects before any network call:

- Non-HTTP(S) schemes (`file:`, `gopher:`, `ftp:`, `data:`, …)
- Credentials embedded in the URL
- Loopback: `127.0.0.0/8`, `::1`
- Private ranges: `10/8`, `172.16/12`, `192.168/16`, `fc00::/7`
- Carrier-grade NAT: `100.64/10`
- Link-local: `169.254/16`, `fe80::/10`
- The cloud metadata endpoint `169.254.169.254`, called out separately so the
  rejection reason is accurate
- `0.0.0.0`, multicast, and IPv4-mapped IPv6 wrappers of any of the above
  (`::ffff:127.0.0.1`)
- Internal hostnames: `localhost`, `.local`, `.internal`, `.localdomain`, and
  hostnames with no dot
- Reserved service ports

This module contains **no Node-only imports** so it can also run in the browser for
form validation. It has a hand-written `ipVersion()` rather than `node:net`'s `isIP`
for that reason.

### Layer 2 — DNS resolution (`src/lib/audit/dns-safety.ts`)

Resolves the hostname and classifies every returned address. If **any** address is
internal the request is rejected — not filtered. A host that answers with a mix of
public and private addresses is almost certainly a rebinding attempt, and there is no
legitimate reason to proceed.

### Layer 3 — connection pinning (`src/lib/audit/fetcher.ts`)

The socket is pinned to the address that was already validated, using a custom
`lookup` passed to the HTTP agent. A second DNS answer arriving between validation
and connection cannot be used. The pinned address is re-classified immediately before
dialing.

Every redirect hop goes back through layers 1–3. A public URL that redirects to
`http://169.254.169.254/` is refused at the hop.

### The test-fixture bypass

`ALLOW_TEST_FIXTURE_HOST` relaxes loopback protection for the automated tests. Two
constraints on it:

- It names an **exact origin** (`127.0.0.1:4321`), not a host. A host-only entry
  would expose every other service on the loopback interface — the database among
  them — to the crawler.
- In production the variable is **ignored outright**: `url-safety.ts` returns an
  empty bypass set whenever `NODE_ENV=production`, regardless of the environment,
  and the unit suite asserts it. `src/lib/env.ts` additionally logs a warning and
  surfaces the mistake in `/api/health` when the variable is present.
  The E2E suite therefore runs with `NODE_ENV=test` and works with the guard rather
  than around it.

## Authentication and sessions

- Passwords hashed with bcrypt at cost 12. Never logged, never returned by an API.
- If `AUTH_SECRET` is absent in production the server generates a cryptographically
  random per-instance secret rather than refusing to serve: tokens cannot be
  forged, but sessions reset on every restart. The state is logged and reported by
  `/api/health` until a real secret is configured.
- Password strength is validated server-side, not only in the browser.
- Session cookies are `httpOnly`, `sameSite=lax` and `secure` in production.
- Sign-in failures return an identical message whether or not the account exists.
  Password reset does the same.
- Reset tokens and rate-limit identifiers are stored as peppered SHA-256 hashes, so
  the tables never contain a usable token, a raw email address or a raw IP address.
- Reset tokens are single-use and time-limited.

## Authorization

- Every privileged page calls `requireUser` or `requireAdmin`; every privileged route
  handler calls `requireApiUser` or `requireApiAdmin`.
- Guards re-read the user row on each request rather than trusting the JWT claim, so
  a suspension or role change takes effect immediately instead of at the next token
  refresh.
- A non-admin who navigates to `/admin` is redirected to the dashboard rather than
  shown a 403, so the admin area's existence is not confirmed.
- Audits, reports and PDFs are scoped by owner in the query itself. Requesting
  another account's audit returns not-found, not a filtered empty page.
- The last remaining super admin cannot be demoted, and an admin cannot suspend
  their own account.

## Payments

- **No card data ever touches RankInAI.** Stripe Checkout and the Customer Portal are
  hosted by Stripe; the application stores a customer ID and payment metadata only.
- Webhook signatures are verified with `STRIPE_WEBHOOK_SECRET` against the raw body.
  Unsigned or badly signed requests are rejected before any parsing.
- Every processed event ID is stored with a unique constraint. A replayed event hits
  the constraint and returns early, so fulfillment is idempotent. The purchase row is
  a second guard against double-granting.
- Entitlements are granted only by the webhook (or, in test mode, by the same
  fulfillment function). The browser can never grant itself anything.
- `BILLING_TEST_MODE` displays a prominent banner wherever billing appears. In
  production it is **forced off** unless `BILLING_TEST_MODE_ALLOW_PRODUCTION=true`
  explicitly acknowledges that no real payments are being taken — a stray variable
  can therefore never cause simulated checkouts on a live storefront, and the
  forced-off state is logged and reported by `/api/health`.

## Input handling

- Zod schemas at every boundary: forms, API bodies, environment.
- All database access goes through Prisma's parameterized query builder.
- Raw SQL appears in exactly one place — the `SELECT 1` health probe and a
  table-existence check in `scripts/verify.ts` — with no interpolated input.
- The contact form has a honeypot field and a per-IP rate limit, and stores only a
  hashed IP.

## Rate limiting

Database-backed sliding windows, so the limit holds across the web and worker
services and survives a container restart.

| Action                 | Limit      |
| ---------------------- | ---------- |
| Sign in                | 8 / 15 min |
| Sign up                | 10 / hour  |
| Password reset request | 5 / hour   |
| Password reset confirm | 10 / hour  |
| Contact form           | 5 / hour   |
| Free preview           | 6 / hour   |
| Audit creation         | 30 / hour  |
| Report download        | 60 / hour  |

## Data handling

- **Page contents are not stored.** The crawler analyzes responses in memory and
  persists derived signals and short evidence excerpts, not page bodies.
- The free preview stores only a domain, a hashed domain, a hashed IP and a timestamp.
- Deletions are soft, so financial and usage history survives, but the customer's
  view is cleared.
- Secrets live in environment variables only — never in the database, never in the
  admin UI, never in a client bundle. The admin System page reports whether a
  provider is configured, never the value.
- Logs are structured JSON with no secrets and no page contents.

## HTTP security headers

Set in `next.config.ts` for every response:

- `Content-Security-Policy` — `default-src 'self'`, `object-src 'none'`,
  `base-uri 'self'`, `frame-ancestors 'none'`, with `https://js.stripe.com` and
  `https://hooks.stripe.com` allowed for Checkout and 3-D Secure. `'unsafe-eval'` is
  granted **only** under `NODE_ENV=development` or `test`, where the webpack dev
  server requires it.
- `Strict-Transport-Security` with a two-year max-age and `includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` denying camera, microphone, geolocation and payment
- `/business-snapshot` additionally sends `X-Robots-Tag: noindex, nofollow, noarchive`

## Admin audit trail

Every privileged action — credit adjustments, suspensions, role changes, job retries
and cancellations, settings changes — writes an `AdminActivity` row with the acting
administrator, the target, a human-readable summary, structured detail and a hashed
IP. The trail is visible on the admin overview.

## Demo-data integrity

Fabricated demonstration records carry `isDemo: true` and are excluded from every
real business metric unless an administrator explicitly turns on "Include demo data",
which is off by default on every screen and displays a warning when on.

There is deliberately **no feature that removes a demo disclaimer from a fabricated
record**. Presenting seeded figures as genuine financial performance would be fraud;
the product does not provide a mechanism for it.

## Pre-deployment checklist

Run `npm run verify` against the target environment first — it checks most of this
mechanically and exits non-zero when something would break.

- [ ] `AUTH_SECRET` is at least 32 characters and unique to this deployment
- [ ] `DATABASE_URL` points at the production database, with TLS
- [ ] `NEXT_PUBLIC_APP_URL` is the real `https://` origin
- [ ] `ALLOW_TEST_FIXTURE_HOST` is **not set**
- [ ] `BILLING_TEST_MODE` is **not set** (or the override is a deliberate choice)
- [ ] `STRIPE_SECRET_KEY` is the live key and `STRIPE_WEBHOOK_SECRET` matches the
      live endpoint
- [ ] All four `STRIPE_PRICE_*` variables are set to live price IDs
- [ ] `SUPER_ADMIN_SEED_PASSWORD` was used once for seeding and then **removed** from
      the environment
- [ ] The super-admin password has been rotated away from the seeded value
- [ ] No `.env` file is committed — `git check-ignore .env` confirms it
- [ ] `npm run security:audit` reports no high or critical advisories
- [ ] `/api/health` returns 200 from the deployed URL
- [ ] Security headers are present on a live response
- [ ] The worker service is running and `/admin/jobs` shows it draining the queue

## Reporting a vulnerability

Email the address in `SUPPORT_EMAIL`. Please include reproduction steps and do not
open a public issue.
