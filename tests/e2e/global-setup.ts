import { spawn, type ChildProcess } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { E2E_ENV } from '../../playwright.config';

/**
 * E2E global setup.
 *
 * Starts the fixture website and the audit worker as child processes, and
 * ensures the test database is migrated and seeded so the admin journey has
 * demonstration data to assert against.
 */

const PID_FILE = path.join(process.cwd(), 'test-results', '.e2e-pids.json');

function run(command: string, args: string[], label: string) {
  try {
    execFileSync(command, args, {
      stdio: 'pipe',
      env: { ...process.env, ...E2E_ENV },
    });
    console.log(`[e2e] ${label} ✓`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`[e2e] ${label} failed: ${detail}`);
  }
}

export default async function globalSetup() {
  console.log('[e2e] Preparing the test database…');
  run('npx', ['prisma', 'migrate', 'deploy'], 'migrations applied');
  run('npx', ['tsx', 'prisma/seed.ts'], 'database seeded');

  // Rate-limit counters are persisted in Postgres and survive between runs.
  // Start each run from a clean slate so a previous run's attempts do not
  // throttle this one.
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({
    datasources: { db: { url: E2E_ENV.DATABASE_URL } },
  });
  try {
    const cleared = await prisma.rateLimitEvent.deleteMany({});
    console.log(`[e2e] cleared ${cleared.count} rate-limit events ✓`);
  } finally {
    await prisma.$disconnect();
  }

  const children: Array<{ label: string; child: ChildProcess }> = [];

  // `detached` puts each child in its own process group. `npx` spawns a
  // grandchild, and signalling only the npx wrapper leaves the real server
  // running and holding port 4321 — which then breaks the next run.
  // Teardown signals the whole group instead.
  const startChild = (label: string, args: string[]) => {
    const child = spawn('npx', args, {
      env: { ...process.env, ...E2E_ENV },
      stdio: ['ignore', 'ignore', 'pipe'],
      detached: true,
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) console.error(`[e2e:${label}] ${text.slice(0, 500)}`);
    });
    children.push({ label, child });
    return child;
  };

  // A fixture left running by an interrupted run would make the new child die
  // with EADDRINUSE and hide the real state of things. Fail loudly instead.
  let fixtureAlreadyUp = false;
  try {
    const probe = await fetch('http://127.0.0.1:4321/', {
      signal: AbortSignal.timeout(2000),
    });
    fixtureAlreadyUp = probe.ok;
  } catch {
    fixtureAlreadyUp = false;
  }
  if (fixtureAlreadyUp) {
    throw new Error(
      '[e2e] Port 4321 is already serving. A fixture website from an interrupted run is still ' +
        'alive — stop it before running the suite again.',
    );
  }

  console.log('[e2e] Starting the fixture website on 127.0.0.1:4321…');
  startChild('fixture', ['tsx', 'tests/fixtures/server.ts']);

  console.log('[e2e] Starting the audit worker…');
  startChild('worker', ['tsx', 'src/worker/main.ts']);

  // Give both a moment to bind and connect.
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Confirm the fixture is actually serving before any test runs.
  const fixtureUrl = 'http://127.0.0.1:4321/';
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      const response = await fetch(fixtureUrl);
      if (response.ok) {
        console.log('[e2e] Fixture website is responding ✓');
        break;
      }
    } catch {
      // keep waiting
    }
    if (attempt === 9) {
      throw new Error('[e2e] The fixture website did not start.');
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  mkdirSync(path.dirname(PID_FILE), { recursive: true });
  writeFileSync(
    PID_FILE,
    JSON.stringify(children.map(({ label, child }) => ({ label, pid: child.pid }))),
    'utf8',
  );

  // Keep references alive for the duration of the run.
  (globalThis as { __e2eChildren?: unknown }).__e2eChildren = children;
}

export { PID_FILE };
