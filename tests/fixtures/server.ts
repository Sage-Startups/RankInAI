import http from 'node:http';

import { FIXTURE_PAGES } from './site';

/**
 * Fixture HTTP server.
 *
 * Serves the controlled audit fixture on 127.0.0.1 so the crawler can be
 * exercised end to end without touching the public internet. The crawler only
 * reaches it because ALLOW_TEST_FIXTURE_HOST is set, which `src/lib/env.ts`
 * refuses to accept in production.
 */

export const FIXTURE_PORT = Number(process.env.FIXTURE_PORT ?? 4321);
export const FIXTURE_HOST = '127.0.0.1';

const routes = new Map(FIXTURE_PAGES.map((page) => [page.path, page]));

export function createFixtureServer(): http.Server {
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${FIXTURE_HOST}:${FIXTURE_PORT}`);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    // Deliberate 404 so the broken-internal-link check has something to find.
    if (path === '/booking-calendar') {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html lang="en"><head><title>Not found</title></head><body><h1>Not found</h1></body></html>');
      return;
    }

    const page = routes.get(path);
    if (!page) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html lang="en"><head><title>Not found</title></head><body><h1>Not found</h1></body></html>');
      return;
    }

    const body = Buffer.from(page.body, 'utf8');
    res.writeHead(200, {
      'Content-Type': page.contentType ?? 'text/html; charset=utf-8',
      'Content-Length': body.byteLength,
      'Cache-Control': 'no-store',
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(body);
  });
}

export function startFixtureServer(port = FIXTURE_PORT): Promise<http.Server> {
  const server = createFixtureServer();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, FIXTURE_HOST, () => resolve(server));
  });
}

export function stopFixtureServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
    // Close idle keep-alive sockets so the process can exit promptly.
    server.closeAllConnections?.();
  });
}

// Allow running standalone: `npm run fixture:serve`
const isEntrypoint = process.argv[1]?.endsWith('fixtures/server.ts');
if (isEntrypoint) {
  startFixtureServer()
    .then(() => {
      console.log(`[fixture] Serving audit fixture at http://${FIXTURE_HOST}:${FIXTURE_PORT}`);
      console.log(`[fixture] ${FIXTURE_PAGES.length} routes available. Ctrl-C to stop.`);
    })
    .catch((error) => {
      console.error('[fixture] Failed to start:', error);
      process.exit(1);
    });
}
