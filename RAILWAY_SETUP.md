# Railway Setup

RankClear runs on Railway as **three services in one project**: a PostgreSQL database,
a web service and a worker service. The worker is separate on purpose — an audit takes
tens of seconds and must not occupy a request thread.

## 1. Project and database

1. Create a new Railway project.
2. **New → Database → PostgreSQL.** Railway provisions it and exposes
   `${{Postgres.DATABASE_URL}}` to the other services.

## 2. Web service

**New → GitHub Repo →** this repository.

Railway reads `railway.json` from the repo root:

| Setting        | Value                                                             |
| -------------- | ----------------------------------------------------------------- |
| Build          | `npm install --include=dev --no-audit --no-fund && npm run build` |
| Pre-deploy     | `npm run db:migrate`                                              |
| Start          | `npm run start`                                                   |
| Health check   | `/api/health`, 120 s timeout                                      |
| Restart policy | On failure, max 5 retries                                         |

Two things about that build command, both learned the hard way:

**`npm install --include=dev`, not `npm ci`.** Nixpacks' own install phase runs
`npm ci`, which honors `NODE_ENV=production` by skipping devDependencies — and this
project needs several of them (`@tailwindcss/postcss`, `typescript`, `prisma`) to
compile. The explicit `--include=dev` restores them whatever `NODE_ENV` says. Do
**not** substitute `npm ci` here: it removes `node_modules` wholesale, which cannot
be done to the Docker cache mount Nixpacks places there, and the build dies with
`EBUSY: resource busy or locked, rmdir '/app/node_modules'`.

**Do not set `NODE_ENV` as a Railway variable.** Nixpacks already sets
`NODE_ENV=production` in the runtime image. Setting it yourself additionally applies
it at _build_ time, where it makes npm skip the tooling the build needs. The build
command above survives it either way, but there is no reason to add the variable.

Then generate a public domain: **Settings → Networking → Generate Domain**.

`npm run start` runs `scripts/start-web.js`, which serves the standalone Next.js
build, honors `$PORT`, binds **dual-stack `::`** (with an automatic IPv4 fallback in
environments without IPv6), copies the static assets the standalone bundle expects,
and runs the server in-process so `SIGTERM` propagates for graceful shutdown.

The dual-stack bind is load-bearing: Railway's health checks and edge proxy connect
over the private network, which is IPv6. An app bound only to `0.0.0.0` starts
cleanly and then never receives a single request.

## Adding an administrator later

### The way that needs no shell

`SUPER_ADMIN_EMAIL` is authoritative, and the web service applies it **on every
boot**:

1. **Variables** on the **web** service → set `SUPER_ADMIN_EMAIL` to the
   address, exactly as it is spelled in the account (case does not matter).
2. **Deploy** — Railway redeploys when a variable changes; if it did not, use
   **Deploy → Redeploy**.
3. Sign out and sign back in. `/admin` opens.

The startup log says which of the three things happened:

| Log line                                              | Meaning                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| `Granted SUPER_ADMIN to the configured owner address` | The account was an ordinary user (or suspended) and has been fixed. |
| nothing about the owner address                       | It already held the role — there was nothing to change.             |
| `Owner address has no account yet`                    | **Sign up with that address.** Registration grants the role.        |

Only that one exact address is ever touched, an account is never created for
it, a deleted account is left deleted, and the grant is written to the admin
audit trail. The authority is the environment, which is the same authority that
supplies `DATABASE_URL` and `AUTH_SECRET`.

Setting the variable on the worker service does nothing — the worker does not
serve the admin area. Set it on the **web** service.

### Locked out of the admin area

The role is useless without a way to sign in, and **"Forgot password" cannot help
on a deployment with no email provider**: with `EMAIL_PROVIDER` unset the mail is
written to the log, and outside development the reset _link is deliberately left
out_ of that line — a reset token is a credential, and a platform's logs are not a
private place.

So the password comes from a variable, the same one the seed uses:

1. **Variables** on the **web** service → `SUPER_ADMIN_SEED_PASSWORD` → a password
   you choose, at least 12 characters.
2. Redeploy. The log says
   `Set the owner account's password from SUPER_ADMIN_SEED_PASSWORD`.
3. Sign in as `SUPER_ADMIN_EMAIL` with that password.
4. Change it under **Settings**, then **delete the variable**.

Step 4 matters: while the variable is set, every deploy resets that account's
password back to it, and the log says so on each boot. It applies to the
`SUPER_ADMIN_EMAIL` account only, it is never written to the log, and the change
is recorded in the admin audit trail.

### The way that needs a shell

To grant the role to an address that is _not_ the configured owner, run this
from the web service's shell (Railway → the service → the shell, or
`railway run` locally against the production `DATABASE_URL`):

```bash
npm run admin:grant -- someone@rankclear.ai
```

It promotes the account if it exists and creates it if it does not, clearing
any suspension so the granted role is actually usable. When it creates an
account and no `--password` is given it prints a strong generated password
**once** — it is never stored in plaintext and cannot be recovered, so capture
it then, sign in, and change it. The grant is written to the admin audit trail.

Pass `--password '<at least 12 characters>'` to set one explicitly instead.

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
| `SUPER_ADMIN_EMAIL`   | The owner's address — gets the admin role on boot    |

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
| `SUPER_ADMIN_SEED_PASSWORD` | Needed once to set the owner's password, then remove it — while it is set, every deploy resets that password to it. See "Locked out of the admin area".  |
| `NODE_ENV`                  | Nixpacks sets it in the runtime image already. Setting it yourself also applies it at build time, where npm reads it as "skip devDependencies".          |

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
build command contains `npm ci`. Use `npm install --include=dev` instead; see the note
under the web service above.

**Build fails with `Cannot find module '@tailwindcss/postcss'`** (or `typescript`, or
another tool) — devDependencies were skipped during install. The give-away is the
package count in the log: a healthy install reports ~627 packages, a dev-less one
~218. Caused by `NODE_ENV=production` being set as a service variable. Remove it, and
make sure the build command carries `--include=dev`.

**Build fails on `AUTH_SECRET`** — it should not. The production guards for
`AUTH_SECRET`, `ALLOW_TEST_FIXTURE_HOST` and `BILLING_TEST_MODE` warn during
`next build` and only refuse at runtime, because a build produces an artifact rather
than serving traffic. If the build genuinely stops, read the error: it is something
else.

**Build ✓, Deploy ✓, `Network > Healthcheck` ✗ and the app logs show NOTHING after
startup** — no `Health check failed` lines, no requests at all. The probes are not
reaching the app: it is bound to IPv4 only while Railway probes over IPv6. The
entrypoint binds dual-stack for exactly this reason; if you override `HOSTNAME`,
never set it to `0.0.0.0` on Railway. Confirm the boot log line says
`"hostname":"::"`.

**Build ✓, Deploy ✓, `Network > Healthcheck` ✗ with `Health check failed` lines in
the logs** — the application is running but `/api/health` is not returning 200. It never throws and always says why, so read the
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
