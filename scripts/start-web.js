#!/usr/bin/env node
/**
 * Production web entrypoint for Railway.
 *
 * `next build` with `output: 'standalone'` emits a self-contained server at
 * .next/standalone/server.js. This wrapper:
 *   - binds to 0.0.0.0 and honors Railway's $PORT
 *   - copies the static assets the standalone bundle expects, if the platform
 *     did not already place them
 *   - forwards SIGTERM so deploys shut down gracefully
 */

const { existsSync, cpSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const standaloneDir = path.join(root, '.next', 'standalone');
const serverEntry = path.join(standaloneDir, 'server.js');

if (!existsSync(serverEntry)) {
  console.error(
    '[rankinai] .next/standalone/server.js is missing. Run `npm run build` before `npm run start`.',
  );
  process.exit(1);
}

// The standalone output does not include static assets or /public.
const copies = [
  { from: path.join(root, '.next', 'static'), to: path.join(standaloneDir, '.next', 'static') },
  { from: path.join(root, 'public'), to: path.join(standaloneDir, 'public') },
];

for (const { from, to } of copies) {
  if (existsSync(from) && !existsSync(to)) {
    try {
      cpSync(from, to, { recursive: true });
    } catch (error) {
      console.warn(`[rankinai] Could not copy ${from} -> ${to}:`, error.message);
    }
  }
}

process.env.PORT = process.env.PORT || '3000';
process.env.HOSTNAME = process.env.HOSTNAME || '0.0.0.0';

console.log(
  JSON.stringify({
    ts: new Date().toISOString(),
    level: 'info',
    service: 'rankinai-web',
    message: 'Starting web server',
    port: process.env.PORT,
    hostname: process.env.HOSTNAME,
    nodeEnv: process.env.NODE_ENV,
  }),
);

/**
 * Report database reachability at startup, in the background.
 *
 * A failing platform health check surfaces as one unhelpful line, and the
 * cause — wrong host, wrong credentials, database asleep, private network not
 * yet up — is invisible unless something asks and says so out loud. This
 * probes with backoff and writes a structured verdict either way.
 *
 * It never blocks the server and never exits the process: the app must still
 * come up and serve its health endpoint so the platform gets a real answer
 * rather than a crash loop.
 */
function probeDatabase() {
  const log = (level, fields) =>
    console[level === 'error' ? 'error' : 'log'](
      JSON.stringify({
        ts: new Date().toISOString(),
        level,
        service: 'rankinai-web',
        ...fields,
      }),
    );

  if (!process.env.DATABASE_URL) {
    log('error', {
      message: 'Database probe skipped — DATABASE_URL is not set',
      hint: 'The server will refuse every request until it is.',
    });
    return;
  }

  // Report where we are dialing without ever printing the credentials.
  let target = 'unparseable DATABASE_URL';
  try {
    const u = new URL(process.env.DATABASE_URL);
    target = `${u.hostname}:${u.port || '5432'}${u.pathname}`;
  } catch {
    /* keep the placeholder */
  }

  let PrismaClient;
  try {
    ({ PrismaClient } = require('@prisma/client'));
  } catch (error) {
    log('error', {
      message: 'Database probe could not load @prisma/client',
      target,
      error: error.message,
    });
    return;
  }

  const client = new PrismaClient({ log: [] });
  const delays = [0, 1000, 2000, 3000, 5000, 5000, 5000, 5000];

  (async () => {
    for (let attempt = 0; attempt < delays.length; attempt += 1) {
      if (delays[attempt]) await new Promise((r) => setTimeout(r, delays[attempt]));
      const started = Date.now();
      try {
        await client.$queryRaw`SELECT 1`;
        log('info', {
          message: 'Database reachable',
          target,
          latencyMs: Date.now() - started,
          attempt: attempt + 1,
        });
        await client.$disconnect().catch(() => {});
        return;
      } catch (error) {
        const reason =
          String(error && error.message)
            .split('\n')
            .map((l) => l.trim())
            .find((l) => l.length > 0 && !l.endsWith('invocation:')) ?? 'unknown error';
        const last = attempt === delays.length - 1;
        log(last ? 'error' : 'warn', {
          message: last
            ? 'Database UNREACHABLE — this is why the health check is failing'
            : 'Database not reachable yet, retrying',
          target,
          attempt: attempt + 1,
          of: delays.length,
          reason,
        });
      }
    }
    await client.$disconnect().catch(() => {});
  })();
}

probeDatabase();

// Run the standalone server in-process so signals propagate directly.
process.chdir(standaloneDir);
require(serverEntry);
