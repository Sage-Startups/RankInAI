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

// Run the standalone server in-process so signals propagate directly.
process.chdir(standaloneDir);
require(serverEntry);
