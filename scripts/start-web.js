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

const { existsSync, cpSync, writeSync } = require('node:fs');
const path = require('node:path');

/**
 * Boot logging is written synchronously.
 *
 * Node buffers stdout when it is a pipe, which every container platform uses.
 * If the process dies during startup the buffer is discarded, and the platform
 * shows a container that started and said nothing — which is indistinguishable
 * from a hang and impossible to diagnose. `writeSync` cannot be lost.
 */
function bootLog(level, fields) {
  const line = `${JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: 'rankinai-web',
    ...fields,
  })}\n`;
  try {
    writeSync(level === 'error' ? 2 : 1, line);
  } catch {
    // A closed descriptor must not become the reason the server fails to boot.
  }
}

/**
 * Nothing should ever kill this process without saying why. Without these the
 * only evidence of a crash is silence — a container that started and said
 * nothing. Exiting on an uncaught exception preserves Node's default
 * behavior; the handler only adds the explanation.
 */
process.on('uncaughtException', (error) => {
  bootLog('error', {
    message: 'Fatal: uncaught exception',
    error: error && error.message,
    stack: error && error.stack && error.stack.split('\n').slice(0, 6).join(' | '),
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  bootLog('error', {
    message: 'Unhandled promise rejection',
    error: reason instanceof Error ? reason.message : String(reason),
  });
});

const root = path.resolve(__dirname, '..');
const standaloneDir = path.join(root, '.next', 'standalone');
const serverEntry = path.join(standaloneDir, 'server.js');

if (!existsSync(serverEntry)) {
  bootLog('error', {
    message: 'Fatal: .next/standalone/server.js is missing',
    hint: 'Run `npm run build` before `npm run start`.',
    expectedAt: serverEntry,
  });
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

bootLog('info', {
  message: 'Starting web server',
  port: process.env.PORT,
  hostname: process.env.HOSTNAME,
  nodeEnv: process.env.NODE_ENV,
});

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
  const log = bootLog;

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

  // Loading the client and constructing it are both fallible — the generated
  // client may be absent, or its query engine binary may not have survived
  // output-file tracing into the standalone build. Neither is a reason for the
  // web server to die, so both are contained here.
  let client;
  try {
    const { PrismaClient } = require('@prisma/client');
    client = new PrismaClient({ log: [] });
  } catch (error) {
    log('error', {
      message: 'Database probe could not start — Prisma client unavailable',
      target,
      error: error && error.message,
      hint: 'The server will still start; /api/health will report the database as failing.',
    });
    return;
  }

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

// Belt and braces: a diagnostic must never be the reason the server fails to
// boot, so even an unanticipated throw here is swallowed and reported.
try {
  probeDatabase();
} catch (error) {
  bootLog('error', {
    message: 'Database probe failed to run — continuing to start the server',
    error: error && error.message,
  });
}

// Run the standalone server in-process so signals propagate directly.
process.chdir(standaloneDir);
require(serverEntry);
