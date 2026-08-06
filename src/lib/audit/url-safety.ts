/**
 * SSRF protection — layer 1: syntactic validation.
 *
 * This module is deliberately free of Node-only imports (`node:net`,
 * `node:dns`) so it can be bundled into client components that need to
 * validate a URL in a form. Layer 2 — DNS resolution and address pinning —
 * lives in `./dns-safety.ts`, which is server-only.
 *
 * Both layers must pass before any request leaves the process.
 */

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * Pure replacement for node:net's isIP. Returns 4, 6 or 0.
 */
export function ipVersion(value: string): 0 | 4 | 6 {
  const v4 = IPV4_PATTERN.exec(value);
  if (v4) {
    return v4.slice(1).every((part) => {
      const n = Number(part);
      // Reject leading zeros: "010.0.0.1" is not a canonical dotted quad.
      return n <= 255 && String(n) === part;
    })
      ? 4
      : 0;
  }

  // IPv6: hex groups separated by colons, optionally with a trailing IPv4 part
  // and at most one "::" compression.
  if (!value.includes(':')) return 0;
  if ((value.match(/::/g) ?? []).length > 1) return 0;
  const withoutZone = value.split('%')[0] ?? '';
  const trailingV4 = withoutZone.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  const head = trailingV4 ? withoutZone.slice(0, -trailingV4[1]!.length) : withoutZone;
  if (trailingV4 && ipVersion(trailingV4[1]!) !== 4) return 0;
  const groups = head.split(':').filter((g) => g.length > 0);
  if (groups.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) return 0;
  return 6;
}

export type UrlRejectionCode =
  | 'EMPTY'
  | 'MALFORMED'
  | 'UNSUPPORTED_SCHEME'
  | 'CREDENTIALS_IN_URL'
  | 'BLOCKED_HOSTNAME'
  | 'BLOCKED_PORT'
  | 'PRIVATE_ADDRESS'
  | 'LINK_LOCAL_ADDRESS'
  | 'LOOPBACK_ADDRESS'
  | 'METADATA_ENDPOINT'
  | 'DNS_FAILURE'
  | 'NO_ADDRESSES';

export interface UrlValidationSuccess {
  ok: true;
  url: URL;
  /** Origin + path with tracking noise removed; used as the canonical key. */
  normalized: string;
  hostname: string;
  domain: string;
}

export interface UrlValidationFailure {
  ok: false;
  code: UrlRejectionCode;
  message: string;
}

export type UrlValidationResult = UrlValidationSuccess | UrlValidationFailure;

/** Ports commonly used by internal services that a website audit never needs. */
const BLOCKED_PORTS = new Set([
  22, 23, 25, 53, 110, 143, 445, 465, 587, 993, 995, 1433, 1521, 2049, 2375, 2376, 3306, 3389, 5432,
  5601, 5672, 5900, 6379, 8020, 8086, 9000, 9042, 9200, 9300, 11211, 27017,
]);

/** Hostnames that always refer to the local machine or an internal service. */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'broadcasthost',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
  'instance-data.ec2.internal',
  'kubernetes',
  'kubernetes.default',
  'kubernetes.default.svc',
  'host.docker.internal',
  'gateway.docker.internal',
  'docker.for.mac.localhost',
  'docker.for.win.localhost',
]);

/** Internal-only TLDs and suffixes. */
const BLOCKED_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.intranet',
  '.private',
  '.corp',
  '.home',
  '.lan',
  '.test',
  '.example',
  '.invalid',
  '.localdomain',
  '.svc',
  '.cluster.local',
];

/** Cloud instance-metadata addresses. */
const METADATA_ADDRESSES = new Set([
  '169.254.169.254',
  '169.254.170.2',
  '100.100.100.200',
  'fd00:ec2::254',
]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

function inCidr(ip: string, cidr: string): boolean {
  const [range, bitsRaw] = cidr.split('/');
  const bits = Number(bitsRaw);
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range ?? '');
  if (ipInt == null || rangeInt == null) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

/** RFC1918 + special-use IPv4 ranges that must never be reachable. */
const BLOCKED_V4_CIDRS: Array<{ cidr: string; code: UrlRejectionCode }> = [
  { cidr: '0.0.0.0/8', code: 'PRIVATE_ADDRESS' },
  { cidr: '10.0.0.0/8', code: 'PRIVATE_ADDRESS' },
  { cidr: '100.64.0.0/10', code: 'PRIVATE_ADDRESS' }, // carrier-grade NAT
  { cidr: '127.0.0.0/8', code: 'LOOPBACK_ADDRESS' },
  { cidr: '169.254.0.0/16', code: 'LINK_LOCAL_ADDRESS' },
  { cidr: '172.16.0.0/12', code: 'PRIVATE_ADDRESS' },
  { cidr: '192.0.0.0/24', code: 'PRIVATE_ADDRESS' },
  { cidr: '192.0.2.0/24', code: 'PRIVATE_ADDRESS' }, // TEST-NET-1
  { cidr: '192.168.0.0/16', code: 'PRIVATE_ADDRESS' },
  { cidr: '198.18.0.0/15', code: 'PRIVATE_ADDRESS' }, // benchmarking
  { cidr: '198.51.100.0/24', code: 'PRIVATE_ADDRESS' }, // TEST-NET-2
  { cidr: '203.0.113.0/24', code: 'PRIVATE_ADDRESS' }, // TEST-NET-3
  { cidr: '224.0.0.0/4', code: 'PRIVATE_ADDRESS' }, // multicast
  { cidr: '240.0.0.0/4', code: 'PRIVATE_ADDRESS' }, // reserved
  { cidr: '255.255.255.255/32', code: 'PRIVATE_ADDRESS' },
];

function normalizeV6(ip: string): string {
  return (
    ip
      .toLowerCase()
      .replace(/^\[|\]$/g, '')
      .split('%')[0] ?? ''
  );
}

/**
 * Classify a literal IP address. Returns null when the address is acceptable.
 */
export function classifyBlockedAddress(address: string): UrlRejectionCode | null {
  const version = ipVersion(address);

  if (version === 4) {
    if (METADATA_ADDRESSES.has(address)) return 'METADATA_ENDPOINT';
    for (const entry of BLOCKED_V4_CIDRS) {
      if (inCidr(address, entry.cidr)) return entry.code;
    }
    return null;
  }

  if (version === 6) {
    const v6 = normalizeV6(address);
    if (METADATA_ADDRESSES.has(v6)) return 'METADATA_ENDPOINT';
    if (v6 === '::' || v6 === '::1') return 'LOOPBACK_ADDRESS';

    // IPv4-mapped (::ffff:10.0.0.1) and IPv4-compatible forms must be checked
    // against the IPv4 rules — otherwise they are a trivial bypass.
    const mapped = v6.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mapped?.[1]) return classifyBlockedAddress(mapped[1]);
    const embedded = v6.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (embedded?.[1] && v6.startsWith('::')) return classifyBlockedAddress(embedded[1]);

    if (
      v6.startsWith('fe80') ||
      v6.startsWith('fe9') ||
      v6.startsWith('fea') ||
      v6.startsWith('feb')
    ) {
      return 'LINK_LOCAL_ADDRESS';
    }
    // fc00::/7 unique local addresses
    if (v6.startsWith('fc') || v6.startsWith('fd')) return 'PRIVATE_ADDRESS';
    // ff00::/8 multicast
    if (v6.startsWith('ff')) return 'PRIVATE_ADDRESS';
    return null;
  }

  return null;
}

/**
 * Targets allowed to bypass loopback protection, used only by the automated
 * test fixture.
 *
 * Entries may be `host` or `host:port`. Naming the port matters: `127.0.0.1`
 * alone would open every service on the loopback interface — the database
 * among them — to the crawler whenever the bypass is on. `127.0.0.1:4321`
 * opens exactly the fixture website and nothing else.
 *
 * Reading the env var at call time (rather than module load) keeps the
 * behavior testable, and `src/lib/env.ts` refuses to boot production with it
 * set at all.
 */
interface FixtureTarget {
  host: string;
  /** null means "any port on this host". */
  port: string | null;
}

function unbracket(host: string): string {
  return host.replace(/^\[|\]$/g, '');
}

function parseFixtureEntry(entry: string): FixtureTarget {
  // A bare IP literal — including an unbracketed IPv6 like `::1`, whose colons
  // are part of the address — carries no port.
  if (ipVersion(entry) !== 0) return { host: entry, port: null };

  const bracketed = entry.match(/^\[(.+)\]:(\d{1,5})$/);
  if (bracketed) return { host: bracketed[1], port: bracketed[2] };

  const hostPort = entry.match(/^([^:]+):(\d{1,5})$/);
  if (hostPort) return { host: hostPort[1], port: hostPort[2] };

  return { host: unbracket(entry), port: null };
}

function testFixtureTargets(): FixtureTarget[] {
  if (process.env.NODE_ENV === 'production') return [];
  const raw = process.env.ALLOW_TEST_FIXTURE_HOST;
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .map(parseFixtureEntry);
}

/**
 * Host-level check, for the layers that only ever see a hostname (DNS
 * resolution and TLS SNI). The port is enforced by `validateAuditUrl`, which
 * every request and every redirect hop passes through first.
 */
export function isTestFixtureHost(hostname: string): boolean {
  const host = unbracket(hostname.toLowerCase());
  return testFixtureTargets().some((target) => target.host === host);
}

/** Full check, including the port. This is the one that gates a request. */
export function isTestFixtureTarget(hostname: string, port: string): boolean {
  const host = unbracket(hostname.toLowerCase());
  return testFixtureTargets().some(
    (target) => target.host === host && (target.port === null || target.port === port),
  );
}

function stripTrackingParams(url: URL): URL {
  const clone = new URL(url.toString());
  const noisy = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'utm_id',
    'gclid',
    'fbclid',
    'msclkid',
    'mc_cid',
    'mc_eid',
    'ref',
    'referrer',
  ];
  for (const key of noisy) clone.searchParams.delete(key);
  clone.hash = '';
  return clone;
}

/** Reduce a hostname to its registrable-looking domain for display/grouping. */
export function registrableDomain(hostname: string): string {
  const host = unbracket(hostname.toLowerCase()).replace(/^www\./, '');

  // An IP literal has no registrable domain — chopping it to its last two
  // labels would turn 127.0.0.1 into "0.1".
  if (ipVersion(host) !== 0) return host;

  const parts = host.split('.');
  if (parts.length <= 2) return host;
  // Handle common two-label public suffixes (co.uk, com.au, …) well enough for
  // grouping purposes; exactness is not required for scoring.
  const twoLevel = new Set(['co', 'com', 'net', 'org', 'gov', 'edu', 'ac']);
  const secondLast = parts[parts.length - 2];
  if (secondLast && twoLevel.has(secondLast) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

/**
 * Layer 1 — validate a user-supplied URL without touching the network.
 */
export function validateAuditUrl(input: string): UrlValidationResult {
  const trimmed = (input ?? '').trim();
  if (!trimmed) {
    return { ok: false, code: 'EMPTY', message: 'Enter a website address.' };
  }

  // Accept "example.com" by assuming https, but never rewrite an explicit scheme.
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return {
      ok: false,
      code: 'MALFORMED',
      message: 'That does not look like a valid website address.',
    };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return {
      ok: false,
      code: 'UNSUPPORTED_SCHEME',
      message: 'Only http:// and https:// addresses can be audited.',
    };
  }

  if (url.username || url.password) {
    return {
      ok: false,
      code: 'CREDENTIALS_IN_URL',
      message:
        'Remove the username and password from the address. RankInAI never signs in to a website.',
    };
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname) {
    return { ok: false, code: 'MALFORMED', message: 'That address has no hostname.' };
  }

  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  const allowFixture = isTestFixtureTarget(hostname, port);

  // WHATWG URL keeps IPv6 literals bracketed; strip them before classifying.
  const literalHost = hostname.replace(/^\[|\]$/g, '');
  const isLiteralIp = ipVersion(literalHost) !== 0;

  if (!allowFixture) {
    // Literal IP addresses are classified first — an IPv6 literal has no dot,
    // so the "must look like a public hostname" rule below would otherwise
    // swallow it with a less accurate rejection code.
    if (isLiteralIp) {
      const literal = classifyBlockedAddress(literalHost);
      if (literal) {
        return {
          ok: false,
          code: literal,
          message: 'That address points at a private or reserved network and cannot be audited.',
        };
      }
    } else {
      if (BLOCKED_HOSTNAMES.has(hostname)) {
        return {
          ok: false,
          code: 'BLOCKED_HOSTNAME',
          message: 'Internal and local addresses cannot be audited.',
        };
      }
      if (BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
        return {
          ok: false,
          code: 'BLOCKED_HOSTNAME',
          message: 'Internal and local addresses cannot be audited.',
        };
      }
      // A public website always has a dot in its hostname.
      if (!hostname.includes('.')) {
        return {
          ok: false,
          code: 'BLOCKED_HOSTNAME',
          message: 'Enter a full public website address, for example https://example.com.',
        };
      }
    }
  }

  if (url.port) {
    const port = Number(url.port);
    if (!Number.isFinite(port) || port <= 0 || port > 65535) {
      return { ok: false, code: 'BLOCKED_PORT', message: 'That port number is not valid.' };
    }
    if (!allowFixture && BLOCKED_PORTS.has(port)) {
      return {
        ok: false,
        code: 'BLOCKED_PORT',
        message: 'That port is reserved for internal services and cannot be audited.',
      };
    }
  }

  const normalized = stripTrackingParams(url);

  return {
    ok: true,
    url: normalized,
    normalized: normalized.toString(),
    hostname,
    domain: registrableDomain(hostname),
  };
}
