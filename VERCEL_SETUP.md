# Vercel Setup

## Read this first: Vercel cannot run the whole product

Vercel hosts the **web application** well. It cannot run the **audit worker**, and
the worker is what actually produces audits.

The worker is a long-running process that polls a database queue and executes an
audit — crawling up to 50 pages, running 76 checks, scoring and writing a report.
That takes tens of seconds to a few minutes. Vercel is serverless: there is no
always-on process, and functions are capped (10s on Hobby, 60s by default on Pro,
300s maximum). A queued audit on a Vercel-only deployment simply never runs. The
marketing site, sign-up, dashboard and billing all work; the core product does not.

There is also a licensing constraint. Vercel's Hobby plan prohibits commercial use,
and RankInAI charges money. A real deployment needs **Pro at $20/month**, which is
more than the ~$10–25/month a complete Railway setup costs — so Vercel is unlikely
to be the cheaper option here.

## Three ways to make it work

### Option A — Railway for everything (simplest, recommended)

One platform, no split. See `RAILWAY_SETUP.md`. Web service, worker service and
Postgres in a single project.

### Option B — Vercel for web, somewhere else for the worker and database

Workable and legitimate, just more moving parts:

- Vercel: the Next.js app
- Neon / Supabase / Railway: PostgreSQL
- Railway / Fly.io / Render / any small VM: `npm run worker`, running continuously

The worker only needs `DATABASE_URL`. It talks to the app exclusively through the
database, so it does not need to be near it or reachable from the internet.

### Option C — Vercel only, with cron-driven job processing

Only viable on Pro, and with caveats. Add a scheduled function that claims and
processes one job per invocation, using the existing `processNextJob` export from
`src/worker/main.ts`. Constraints you are accepting:

- Audits must complete inside the function timeout. Set `maxDuration` to 300 and
  reduce the crawl page limit; a 50-page Agency audit will not fit.
- Vercel Cron fires at most once per minute, so throughput is one audit per minute.
- A timeout mid-audit leaves the job locked until the stale-lock reclaim releases it.

This is a degradation of the product, not a port of it. Option A or B keeps the
audit engine behaving as designed and as tested.

## Deploying the web app to Vercel

### 1. Import the repository

Vercel detects Next.js automatically. No build command override is needed — the
default `npm run build` is correct. Do **not** set a custom install command.

### 2. Provision Postgres

Vercel Postgres, Neon and Supabase all work. Copy the **pooled** connection string;
serverless functions open many short-lived connections and a direct connection will
exhaust the server's limit under any real traffic.

Append `?pgbouncer=true&connection_limit=1` when the provider gives you a PgBouncer
pooled URL, which Prisma needs in order to behave correctly behind a pooler.

### 3. Environment variables

Set these in **Settings → Environment Variables**, for the Production environment
(and Preview, if you want previews to work):

| Variable              | Value                                                     |
| --------------------- | --------------------------------------------------------- |
| `DATABASE_URL`        | The pooled Postgres connection string                     |
| `AUTH_SECRET`         | 48 random bytes — `openssl rand -base64 48`               |
| `AUTH_TRUST_HOST`     | `true`                                                    |
| `NEXT_PUBLIC_APP_URL` | `https://<your-project>.vercel.app` or your custom domain |
| `SUPER_ADMIN_EMAIL`   | The address that becomes the administrator                |

Stripe variables as per `STRIPE_SETUP.md` once you are taking payments.

**Must not be set:** `ALLOW_TEST_FIXTURE_HOST`, `BILLING_TEST_MODE`. Either one makes
production refuse every request.

The build no longer fails when `DATABASE_URL` is absent — it warns and continues,
because a build compiles an artifact rather than serving traffic. The deployed app
still refuses every request until the variable is set, so a missing value shows up
as a clear runtime error rather than a confusing build failure.

### 4. Migrations

Vercel has no pre-deploy hook, so migrations do not run automatically. Run them from
your own machine against the production database:

```bash
DATABASE_URL='<direct, non-pooled connection string>' npx prisma migrate deploy
```

Use the **direct** connection string here, not the pooled one — migrations need a
real session and fail through PgBouncer.

### 5. Seed the administrator

```bash
DATABASE_URL='<direct connection string>' \
SUPER_ADMIN_EMAIL='you@example.com' \
SUPER_ADMIN_SEED_PASSWORD='<a strong password you choose>' \
npx tsx prisma/seed.ts
```

### 6. Check it

```bash
curl -s https://<your-domain>/api/health | jq
```

`"status": "ok"` means the app and database are both healthy. Anything else names the
failing check in the response body — see the troubleshooting section of
`RAILWAY_SETUP.md`, which applies identically here.

Then confirm the limitation for yourself: create an audit. It will sit at "Queued"
forever until a worker is running somewhere. That is the constraint at the top of
this document, not a bug.
