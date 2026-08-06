import { promises as dns } from 'node:dns';

import {
  classifyBlockedAddress,
  ipVersion,
  isTestFixtureHost,
  validateAuditUrl,
  type UrlValidationFailure,
  type UrlValidationResult,
} from '@/lib/audit/url-safety';

/**
 * SSRF protection — layer 2: DNS resolution and address validation.
 *
 * Server-only: it imports node:dns. Resolved addresses are returned so the
 * caller can pin the socket to an already-validated IP, which is what closes
 * the DNS-rebinding window between validation and connect.
 */

export interface ResolvedHost {
  ok: true;
  /** Validated addresses; the socket must connect to one of these. */
  addresses: Array<{ address: string; family: 4 | 6 }>;
}

export type HostResolution = ResolvedHost | UrlValidationFailure;

/**
 * Layer 2 — resolve a hostname and reject if any address is internal.
 *
 * Rejecting when *any* returned address is private (rather than filtering) is
 * the conservative choice: a host that mixes public and private answers is
 * almost certainly a rebinding attempt.
 */
export async function resolveHostSafely(hostname: string): Promise<HostResolution> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (isTestFixtureHost(host)) {
    const family = ipVersion(host);
    if (family === 4 || family === 6) {
      return { ok: true, addresses: [{ address: host, family: family as 4 | 6 }] };
    }
  }

  // Literal IPs need no lookup — they were already classified in layer 1, but
  // re-check so this function is safe to call on its own.
  const literalFamily = ipVersion(host);
  if (literalFamily === 4 || literalFamily === 6) {
    const blocked = classifyBlockedAddress(host);
    if (blocked) {
      return {
        ok: false,
        code: blocked,
        message: 'That address points at a private or reserved network and cannot be audited.',
      };
    }
    return { ok: true, addresses: [{ address: host, family: literalFamily as 4 | 6 }] };
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    return {
      ok: false,
      code: 'DNS_FAILURE',
      message: 'We could not find that domain. Check the spelling of the address.',
    };
  }

  if (!records.length) {
    return {
      ok: false,
      code: 'NO_ADDRESSES',
      message: 'That domain does not resolve to a reachable server.',
    };
  }

  for (const record of records) {
    const blocked = classifyBlockedAddress(record.address);
    if (blocked) {
      return {
        ok: false,
        code: blocked,
        message: 'That domain resolves to a private or reserved network address and cannot be audited.',
      };
    }
  }

  return {
    ok: true,
    addresses: records.map((r) => ({
      address: r.address,
      family: (r.family === 6 ? 6 : 4) as 4 | 6,
    })),
  };
}

/**
 * Full check: syntax + DNS. Convenience wrapper for callers that do not need
 * the resolved address list.
 */
export async function assertSafeUrl(input: string): Promise<UrlValidationResult> {
  const validated = validateAuditUrl(input);
  if (!validated.ok) return validated;
  const resolution = await resolveHostSafely(validated.hostname);
  if (!resolution.ok) return resolution;
  return validated;
}
