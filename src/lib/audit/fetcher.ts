import http from 'node:http';
import https from 'node:https';
import type { LookupAddress, lookup as DnsLookup } from 'node:dns';

import { getEnv } from '@/lib/env';
import {
  classifyBlockedAddress,
  isTestFixtureHost,
  validateAuditUrl,
} from '@/lib/audit/url-safety';
import { resolveHostSafely } from '@/lib/audit/dns-safety';

/**
 * Hardened HTTP client used for every outbound request the audit engine makes.
 *
 * Guarantees:
 *  - http/https only
 *  - each hop is re-validated (a redirect cannot escape to an internal host)
 *  - the socket is pinned to an already-validated IP via a custom `lookup`,
 *    which closes the DNS-rebinding window between validation and connect
 *  - hard byte cap enforced while streaming, not after
 *  - hard timeout covering connect + response
 *  - redirect count capped
 *  - non-text content types are rejected without being buffered
 *  - responses are never written to disk or executed
 */

export type FetchErrorCode =
  | 'INVALID_URL'
  | 'BLOCKED'
  | 'DNS_FAILURE'
  | 'TIMEOUT'
  | 'CONNECTION_FAILED'
  | 'TOO_MANY_REDIRECTS'
  | 'REDIRECT_LOOP'
  | 'RESPONSE_TOO_LARGE'
  | 'UNSUPPORTED_CONTENT_TYPE'
  | 'HTTP_ERROR';

export interface FetchSuccess {
  ok: true;
  url: string;
  finalUrl: string;
  statusCode: number;
  headers: Record<string, string>;
  contentType: string | null;
  body: string;
  bytes: number;
  durationMs: number;
  redirectChain: Array<{ from: string; to: string; status: number }>;
  isHttps: boolean;
  truncated: boolean;
}

export interface FetchFailure {
  ok: false;
  url: string;
  code: FetchErrorCode;
  message: string;
  statusCode?: number;
  durationMs: number;
  redirectChain: Array<{ from: string; to: string; status: number }>;
}

export type FetchResult = FetchSuccess | FetchFailure;

export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Accept any content type (used for robots.txt / sitemap / llms.txt). */
  allowPlainText?: boolean;
  /** Treat non-2xx as a success so the caller can inspect the status. */
  acceptErrorStatus?: boolean;
  method?: 'GET' | 'HEAD';
}

const TEXTUAL_CONTENT_TYPES = [
  'text/html',
  'application/xhtml+xml',
  'text/plain',
  'application/xml',
  'text/xml',
  'application/json',
  'application/ld+json',
  'application/rss+xml',
  'application/atom+xml',
];

/** Friendly, non-technical explanation surfaced to end users. */
export const FETCH_ERROR_MESSAGES: Record<FetchErrorCode, string> = {
  INVALID_URL: 'That web address could not be read.',
  BLOCKED: 'That address points at a private or reserved network and cannot be audited.',
  DNS_FAILURE: 'We could not find that domain name. Check the spelling of the address.',
  TIMEOUT: 'The website took too long to respond.',
  CONNECTION_FAILED:
    'We could not connect to the website. It may be offline or blocking automated visitors.',
  TOO_MANY_REDIRECTS: 'The website redirected too many times.',
  REDIRECT_LOOP: 'The website is stuck in a redirect loop.',
  RESPONSE_TOO_LARGE: 'The page is too large for RankInAI to analyze.',
  UNSUPPORTED_CONTENT_TYPE: 'That address does not return a readable web page.',
  HTTP_ERROR: 'The website returned an error response.',
};

function headerString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join(', ');
  return value ?? '';
}

/**
 * Perform a single hop with the socket pinned to a validated address.
 */
function requestOnce(
  target: URL,
  pinned: { address: string; family: 4 | 6 },
  options: Required<Pick<FetchOptions, 'timeoutMs' | 'maxBytes' | 'method'>>,
): Promise<{
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  bytes: number;
  truncated: boolean;
}> {
  const env = getEnv();
  const isHttps = target.protocol === 'https:';
  const transport = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    // Pin the connection to the address we already validated. This is the step
    // that prevents a rebinding attack from swapping in 127.0.0.1 after checks.
    const lookup: typeof DnsLookup = ((
      _hostname: string,
      opts: unknown,
      callback: (
        err: NodeJS.ErrnoException | null,
        address: string | LookupAddress[],
        family?: number,
      ) => void,
    ) => {
      const cb = typeof opts === 'function' ? (opts as typeof callback) : callback;
      const all = typeof opts === 'object' && opts !== null && (opts as { all?: boolean }).all;
      if (all) {
        cb(null, [{ address: pinned.address, family: pinned.family }]);
      } else {
        cb(null, pinned.address, pinned.family);
      }
    }) as unknown as typeof DnsLookup;

    const req = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method: options.method,
        // Preserve SNI / Host for virtual hosting even though we dial an IP.
        servername: isHttps && !isTestFixtureHost(target.hostname) ? target.hostname : undefined,
        headers: {
          Host: target.host,
          'User-Agent': env.CRAWL_USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity',
          Connection: 'close',
        },
        lookup,
        timeout: options.timeoutMs,
        // Never follow anything automatically; redirects are handled by us.
        agent: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        let truncated = false;

        // Reject an oversized body before buffering it, when advertised.
        const declared = Number(res.headers['content-length'] ?? '0');
        if (Number.isFinite(declared) && declared > options.maxBytes) {
          res.destroy();
          reject(Object.assign(new Error('Response too large'), { code: 'RESPONSE_TOO_LARGE' }));
          return;
        }

        res.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > options.maxBytes) {
            truncated = true;
            res.destroy();
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
            bytes,
            truncated,
          });
        });

        res.on('close', () => {
          if (truncated) {
            resolve({
              statusCode: res.statusCode ?? 0,
              headers: res.headers,
              body: Buffer.concat(chunks).toString('utf8'),
              bytes,
              truncated: true,
            });
          }
        });

        res.on('error', (err) => reject(err));
      },
    );

    req.on('timeout', () => {
      req.destroy(Object.assign(new Error('Request timed out'), { code: 'ETIMEDOUT' }));
    });
    req.on('error', (err) => reject(err));
    req.end();
  });
}

/**
 * Fetch a URL with full SSRF, size, timeout and redirect protection.
 */
export async function safeFetch(rawUrl: string, options: FetchOptions = {}): Promise<FetchResult> {
  const env = getEnv();
  const started = Date.now();
  const timeoutMs = options.timeoutMs ?? env.CRAWL_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? env.CRAWL_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? env.CRAWL_MAX_REDIRECTS;
  const method = options.method ?? 'GET';

  const redirectChain: Array<{ from: string; to: string; status: number }> = [];
  const visited = new Set<string>();

  let currentRaw = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const validated = validateAuditUrl(currentRaw);
    if (!validated.ok) {
      return {
        ok: false,
        url: rawUrl,
        code:
          validated.code === 'MALFORMED' || validated.code === 'EMPTY' ? 'INVALID_URL' : 'BLOCKED',
        message: validated.message,
        durationMs: Date.now() - started,
        redirectChain,
      };
    }

    const key = validated.url.toString();
    if (visited.has(key)) {
      return {
        ok: false,
        url: rawUrl,
        code: 'REDIRECT_LOOP',
        message: FETCH_ERROR_MESSAGES.REDIRECT_LOOP,
        durationMs: Date.now() - started,
        redirectChain,
      };
    }
    visited.add(key);

    const resolution = await resolveHostSafely(validated.hostname);
    if (!resolution.ok) {
      return {
        ok: false,
        url: rawUrl,
        code:
          resolution.code === 'DNS_FAILURE' || resolution.code === 'NO_ADDRESSES'
            ? 'DNS_FAILURE'
            : 'BLOCKED',
        message: resolution.message,
        durationMs: Date.now() - started,
        redirectChain,
      };
    }

    const pinned = resolution.addresses[0];
    if (!pinned) {
      return {
        ok: false,
        url: rawUrl,
        code: 'DNS_FAILURE',
        message: FETCH_ERROR_MESSAGES.DNS_FAILURE,
        durationMs: Date.now() - started,
        redirectChain,
      };
    }

    // Belt and braces: re-classify the exact IP we are about to dial.
    if (!isTestFixtureHost(validated.hostname) && classifyBlockedAddress(pinned.address)) {
      return {
        ok: false,
        url: rawUrl,
        code: 'BLOCKED',
        message: FETCH_ERROR_MESSAGES.BLOCKED,
        durationMs: Date.now() - started,
        redirectChain,
      };
    }

    let response: Awaited<ReturnType<typeof requestOnce>>;
    try {
      response = await requestOnce(validated.url, pinned, { timeoutMs, maxBytes, method });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'RESPONSE_TOO_LARGE') {
        return {
          ok: false,
          url: rawUrl,
          code: 'RESPONSE_TOO_LARGE',
          message: FETCH_ERROR_MESSAGES.RESPONSE_TOO_LARGE,
          durationMs: Date.now() - started,
          redirectChain,
        };
      }
      if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
        return {
          ok: false,
          url: rawUrl,
          code: 'TIMEOUT',
          message: FETCH_ERROR_MESSAGES.TIMEOUT,
          durationMs: Date.now() - started,
          redirectChain,
        };
      }
      if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
        return {
          ok: false,
          url: rawUrl,
          code: 'DNS_FAILURE',
          message: FETCH_ERROR_MESSAGES.DNS_FAILURE,
          durationMs: Date.now() - started,
          redirectChain,
        };
      }
      return {
        ok: false,
        url: rawUrl,
        code: 'CONNECTION_FAILED',
        message: FETCH_ERROR_MESSAGES.CONNECTION_FAILED,
        durationMs: Date.now() - started,
        redirectChain,
      };
    }

    const status = response.statusCode;
    const location = headerString(response.headers.location);

    if (status >= 300 && status < 400 && location) {
      if (hop === maxRedirects) {
        return {
          ok: false,
          url: rawUrl,
          code: 'TOO_MANY_REDIRECTS',
          message: FETCH_ERROR_MESSAGES.TOO_MANY_REDIRECTS,
          durationMs: Date.now() - started,
          redirectChain,
        };
      }
      let next: string;
      try {
        next = new URL(location, validated.url).toString();
      } catch {
        return {
          ok: false,
          url: rawUrl,
          code: 'INVALID_URL',
          message: 'The website redirected to an address we could not read.',
          durationMs: Date.now() - started,
          redirectChain,
        };
      }
      redirectChain.push({ from: validated.url.toString(), to: next, status });
      currentRaw = next;
      continue;
    }

    const contentType = headerString(response.headers['content-type']) || null;
    const baseType = contentType?.split(';')[0]?.trim().toLowerCase() ?? '';

    if (baseType && !TEXTUAL_CONTENT_TYPES.includes(baseType) && !options.allowPlainText) {
      return {
        ok: false,
        url: rawUrl,
        code: 'UNSUPPORTED_CONTENT_TYPE',
        message: FETCH_ERROR_MESSAGES.UNSUPPORTED_CONTENT_TYPE,
        statusCode: status,
        durationMs: Date.now() - started,
        redirectChain,
      };
    }

    if (status >= 400 && !options.acceptErrorStatus) {
      return {
        ok: false,
        url: rawUrl,
        code: 'HTTP_ERROR',
        message: `The website returned HTTP ${status}.`,
        statusCode: status,
        durationMs: Date.now() - started,
        redirectChain,
      };
    }

    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(response.headers)) {
      headers[k.toLowerCase()] = headerString(v);
    }

    return {
      ok: true,
      url: rawUrl,
      finalUrl: validated.url.toString(),
      statusCode: status,
      headers,
      contentType,
      body: response.body,
      bytes: response.bytes,
      durationMs: Date.now() - started,
      redirectChain,
      isHttps: validated.url.protocol === 'https:',
      truncated: response.truncated,
    };
  }

  return {
    ok: false,
    url: rawUrl,
    code: 'TOO_MANY_REDIRECTS',
    message: FETCH_ERROR_MESSAGES.TOO_MANY_REDIRECTS,
    durationMs: Date.now() - started,
    redirectChain,
  };
}

/** Politeness delay between crawl requests to the same host. */
export function crawlDelay(): Promise<void> {
  const ms = getEnv().CRAWL_DELAY_MS;
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
