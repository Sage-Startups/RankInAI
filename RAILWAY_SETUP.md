# Railway Setup

RankInAI runs on Railway as **three services in one project**: a PostgreSQL database,
a web service and a worker service. The worker is separate on purpose — an audit takes
tens of seconds and must not occupy a request thread.

## 1. Project and database

1. Create a new Railway project.
2. **New → Database → PostgreSQL.** Railway provisions it and exposes
   `${{Postgres.DATABASE_URL}}` to the other services.

## 2. Web service

**New → GitHub Repo →** this repository.

Railway reads `railway.json` from the repo root:

| Setting        | Value                        |
| -------------- | ---------------------------- |
| Build          | `npm run build`              |
| Pre-deploy     | `npm run db:migrate`         |
| Start          | `npm run start`              |
| Health check   | `/api/health`, 120 s timeout |
| Restart policy | On failure, max 5 retries    |

**Do not add `npm ci` to the build command.** Nixpacks installs dependencies in its
own phase and mounts `/app/node_modules` as a Docker cache mount. `npm ci` begins by
removing `node_modules` wholesale, which cannot remove a mount point, so the build
dies with `EBUSY: resource busy or locked, rmdir '/app/node_modules'`.

Then generate a public domain: **Settings → Networking → Generate Domain**.

`npm run start` runs `scripts/start-web.js`, which serves the standalone Next.js
build, honors `$PORT`, binds `0.0.0.0`, copies the static assets the standalone bundle
expects, and runs the server in-process so `SIGTERM` propagates for graceful shutdown.

## 3. Worker service

**New → GitHub Repo →** the same repository, a second service.

Because Railway reads `railway.json` by default, set this service's config path to
`railway.worker.json` (**Settings → Config-as-code → Railway Config File**), or set
the commands by hand:

| Setting        | Value                 |
| -------------- | --------------------- |
| Build          | `npm run db:generate` |
| Start          | `npm run worker`      |
| Restart policy | Always                |

Do **not** generate a domain for the worker. It has no HTTP surface.

The worker polls the queue, claims a job with a conditional UPDATE (so two replicas
cannot process the same job), heartbeats progress, retries with exponential backoff,
and restores the audit credit when a job fails permanently before producing results.
On `SIGTERM` it requeues whatever it holds and exits, so a deploy never strands a job.

## 4. Environment variables

Set these on **both** the web and worker services unless noted.

### Required

| Variable              | Value                                                |
| --------------------- | ---------------------------------------------------- |
| `DATABASE_URL`        | `${{Postgres.DATABASE_URL}}`                         |
| `AUTH_SECRET`         | 48 random bytes — `openssl rand -base64 48`          |
| `AUTH_TRUST_HOST`     | `true` (Railway terminates TLS in front of the app)  |
| `NEXT_PUBLIC_APP_URL` | `https://<your-domain>.up.railway.app` — web service |
| `SUPER_ADMIN_EMAIL`   | The address that gets the admin role at seed time    |
| `NODE_ENV`            | `production`                                         |

### Stripe (required for real payments)

| Variable                       | Value                            |
| ------------------------------ | -------------------------------- |
| `STRIPE_SECRET_KEY`            | `sk_live_…`                      |
| `STRIPE_WEBHOOK_SECRET`        | `whsec_…` from the live endpoint |
| `STRIPE_PRICE_ONE_TIME_AUDIT`  | `price_…`                        |
| `STRIPE_PRICE_STARTER_MONTHLY` | `price_…`                        |
| `STRIPE_PRICE_GROWTH_MONTHLY`  | `price_…`                        |
| `STRIPE_PRICE_AGENCY_MONTHLY`  | `price_…`                        |

`npm run stripe:setup` creates the products and prints these. See `STRIPE_SETUP.md`.

### Optional

| Variable                                                                                           | Effect when unset                                                                         |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`                                                                                   | Audits use deterministic report templates. Scores and evidence are rule-based either way. |
| `OPENAI_MODEL`                                                                                     | Defaults to a small, cheap model                                                          |
| `SEARCH_PROVIDER` / `SERPER_API_KEY`                                                               | Public-web search observations are omitted, and the report says so                        |
| `EMAIL_PROVIDER` / `EMAIL_PROVIDER_API_KEY` / `EMAIL_FROM`                                         | Email is logged to the console instead of sent                                            |
| `SUPPORT_EMAIL`                                                                                    | Falls back to a default shown on contact and legal pages                                  |
| `CRON_SECRET`                                                                                      | Scheduled maintenance endpoints are unauthenticated — set it if you use them              |
| `WORKER_POLL_INTERVAL_MS`                                                                          | Defaults to 5000                                                                          |
| `CRAWL_TIMEOUT_MS`, `CRAWL_MAX_BYTES`, `CRAWL_MAX_REDIRECTS`, `CRAWL_DELAY_MS`, `CRAWL_USER_AGENT` | Sensible defaults                                                                         |

### Should not be set in production

| Variable                    | Why                                                                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ALLOW_TEST_FIXTURE_HOST`   | **Ignored in production** — the crawler never relaxes SSRF protection there — but its presence is a mistake, warned about in the logs and `/api/health`. |
| `BILLING_TEST_MODE`         | **Forced off in production** unless `BILLING_TEST_MODE_ALLOW_PRODUCTION=true` explicitly acknowledges simulated billing. Warned, never silent.           |
| `SUPER_ADMIN_SEED_PASSWORD` | Needed once for the initial seed, then remove it.                                                                                                        |

## 5. First deploy

1. Deploy the web service. The pre-deploy command applies migrations.
2. Seed the super admin **once**, from the Railway shell on the web service:

   ```bash
   SUPER_ADMIN_SEED_PASSWORD='<a strong password you choose>' npm run db:seed
   ```

   The seed is idempotent and never overwrites an existing admin password unless
   that variable is present. **Remove the variable afterwards and do not commit it
   anywhere.**

3. Deploy the worker service.
4. Verify:

   ```bash
   npm run verify
   ```

   It reports every missing or blocking setting and exits non-zero if the environment
   is not ready.

## 6. Post-deploy checks

```bash
curl -s https://<your-domain>/api/health | jq
curl -sI https://<your-domain>/ | grep -iE 'content-security-policy|strict-transport|x-frame'
curl -sI https://<your-domain>/business-snapshot | grep -i x-robots-tag
```

- `/api/health` should return 200 with `"database": { "ok": true }`
- `/admin/jobs` should show the worker draining the queue
- Run one real audit end to end and download the PDF

## Troubleshooting

**Build fails with `EBUSY: resource busy or locked, rmdir '/app/node_modules'`** — the
build command contains `npm ci`. Remove it; see the note under the web service above.

**Build fails on `AUTH_SECRET`** — it should not. The production guards for
`AUTH_SECRET`, `ALLOW_TEST_FIXTURE_HOST` and `BILLING_TEST_MODE` warn during
`next build` and only refuse at runtime, because a build produces an artifact rather
than serving traffic. If the build genuinely stops, read the error: it is something
else.

**Build ✓, Deploy ✓, `Network > Healthcheck` ✗** — the application is running but
`/api/health` is not returning 200. It never throws and always says why, so read the
answer rather than guessing. Open the failed deployment's **Deploy logs** (not Build)
and look for `"message":"Health check failed"`:

```json
{ "message": "Health check failed", "configuration": "AUTH_SECRET must be set …", "database": "ok" }
{ "message": "Health check failed", "configuration": "ok", "database": "Can't reach database server at `…`" }
```

- A `database` message means the app cannot reach Postgres. Set `DATABASE_URL` to
  `${{Postgres.DATABASE_URL}}` — a reference, not a pasted connection string. This
  is the **only** environment problem that can fail the health check: every other
  configuration issue degrades gracefully and appears in `/api/health`'s
  `warnings` array instead.

Note that a passing pre-deploy step does **not** clear the database: `prisma migrate
deploy` reads `DATABASE_URL` directly and never loads the application's environment
schema, so migrations can succeed while the app still fails on a different variable.

**`AUTH_SECRET` missing** — the server no longer refuses. It generates an ephemeral
random secret, logs a warning, and lists the state in `/api/health`'s `warnings`.
Sign-in works, but every deploy or restart signs everyone out until a real
`AUTH_SECRET` is set — so set one, just not under time pressure.

**Worker builds but processes nothing** — confirm it has the same `DATABASE_URL` as
the web service. The two communicate only through the database.

## Notes

- **No local disk dependency.** PDFs are rendered with PDFKit and cached as bytes in
  PostgreSQL, so a container replacement loses nothing and no volume is needed.
- **No headless browser.** Nothing in the runtime needs Chromium — Playwright is a
  dev dependency only.
- **Scaling.** The worker can run more than one replica; job claiming is a conditional
  UPDATE, so two workers cannot take the same job. Stale locks are reclaimed after a
  timeout in case a container dies mid-job.
- **Rollback.** Migrations are additive. Redeploy the previous image from the Railway
  deployment history; no migration rollback is required for the current schema.
