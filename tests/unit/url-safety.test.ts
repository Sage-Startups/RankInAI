import { describe, expect, it } from 'vitest';

import {
  classifyBlockedAddress,
  ipVersion,
  registrableDomain,
  validateAuditUrl,
} from '@/lib/audit/url-safety';
import { resolveHostSafely } from '@/lib/audit/dns-safety';

describe('validateAuditUrl — accepted input', () => {
  it('accepts a plain https URL', () => {
    const result = validateAuditUrl('https://example.com/services');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hostname).toBe('example.com');
      expect(result.domain).toBe('example.com');
    }
  });

  it('assumes https when no scheme is supplied', () => {
    const result = validateAuditUrl('example.com');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url.protocol).toBe('https:');
  });

  it('accepts plain http without upgrading it', () => {
    const result = validateAuditUrl('http://example.com');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url.protocol).toBe('http:');
  });

  it('strips tracking parameters and fragments', () => {
    const result = validateAuditUrl(
      'https://example.com/page?utm_source=x&gclid=y&keep=1#section',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized).toContain('keep=1');
      expect(result.normalized).not.toContain('utm_source');
      expect(result.normalized).not.toContain('gclid');
      expect(result.normalized).not.toContain('#section');
    }
  });

  it('handles a trailing dot in the hostname', () => {
    const result = validateAuditUrl('https://example.com./');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.hostname).toBe('example.com');
  });
});

describe('validateAuditUrl — SSRF rejections', () => {
  it.each([
    ['', 'EMPTY'],
    ['   ', 'EMPTY'],
    ['not a url at all', 'MALFORMED'],
  ])('rejects %j', (input, code) => {
    const result = validateAuditUrl(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(code);
  });

  it.each([
    'file:///etc/passwd',
    'ftp://example.com',
    'gopher://example.com',
    'data:text/html,<script>alert(1)</script>',
    'javascript:alert(1)',
    'about:blank',
  ])('rejects unsupported scheme %s', (input) => {
    const result = validateAuditUrl(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNSUPPORTED_SCHEME');
  });

  it('rejects embedded credentials', () => {
    const result = validateAuditUrl('https://admin:hunter2@example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('CREDENTIALS_IN_URL');
  });

  it.each([
    'http://localhost/admin',
    'http://localhost.localdomain',
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://instance-data/latest/meta-data/',
    'http://kubernetes.default.svc',
    'http://host.docker.internal:3000',
  ])('rejects internal hostname %s', (input) => {
    const result = validateAuditUrl(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('BLOCKED_HOSTNAME');
  });

  it.each([
    'http://service.internal',
    'http://printer.local',
    'http://box.lan',
    'http://app.test',
    'http://thing.invalid',
    'http://svc.cluster.local',
  ])('rejects internal suffix %s', (input) => {
    const result = validateAuditUrl(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('BLOCKED_HOSTNAME');
  });

  it.each([
    ['http://127.0.0.1/', 'LOOPBACK_ADDRESS'],
    ['http://127.1.2.3/', 'LOOPBACK_ADDRESS'],
    ['http://10.0.0.5/', 'PRIVATE_ADDRESS'],
    ['http://172.16.4.1/', 'PRIVATE_ADDRESS'],
    ['http://172.31.255.254/', 'PRIVATE_ADDRESS'],
    ['http://192.168.1.1/', 'PRIVATE_ADDRESS'],
    ['http://100.64.0.1/', 'PRIVATE_ADDRESS'],
    ['http://0.0.0.0/', 'PRIVATE_ADDRESS'],
    ['http://169.254.1.1/', 'LINK_LOCAL_ADDRESS'],
    ['http://169.254.169.254/', 'METADATA_ENDPOINT'],
    ['http://[::1]/', 'LOOPBACK_ADDRESS'],
    ['http://[fd00::1]/', 'PRIVATE_ADDRESS'],
    ['http://[fe80::1]/', 'LINK_LOCAL_ADDRESS'],
  ])('rejects literal address %s as %s', (input, code) => {
    // The fixture bypass names an exact origin (127.0.0.1:4321), so every one
    // of these — including 127.0.0.1 on any other port — is refused.
    const result = validateAuditUrl(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(code);
  });

  it('rejects IPv4-mapped IPv6 addresses that wrap a private address', () => {
    expect(classifyBlockedAddress('::ffff:10.0.0.1')).toBe('PRIVATE_ADDRESS');
    expect(classifyBlockedAddress('::ffff:127.0.0.1')).toBe('LOOPBACK_ADDRESS');
    expect(classifyBlockedAddress('::ffff:169.254.169.254')).toBe('METADATA_ENDPOINT');
  });

  it('allows genuinely public addresses', () => {
    expect(classifyBlockedAddress('93.184.216.34')).toBeNull();
    expect(classifyBlockedAddress('8.8.8.8')).toBeNull();
    expect(classifyBlockedAddress('2606:2800:220:1:248:1893:25c8:1946')).toBeNull();
  });

  it.each([22, 25, 3306, 5432, 6379, 9200, 27017])('rejects reserved port %d', (port) => {
    const result = validateAuditUrl(`https://example.com:${port}/`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('BLOCKED_PORT');
  });

  it('allows common web ports', () => {
    expect(validateAuditUrl('https://example.com:8443/').ok).toBe(true);
    expect(validateAuditUrl('http://example.com:8080/').ok).toBe(true);
  });

  it('rejects a bare hostname with no dot', () => {
    const result = validateAuditUrl('https://intranet/');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('BLOCKED_HOSTNAME');
  });
});

describe('resolveHostSafely', () => {
  it('rejects a literal private address', async () => {
    const result = await resolveHostSafely('10.1.2.3');
    expect(result.ok).toBe(false);
  });

  it('rejects a hostname that does not resolve', async () => {
    const result = await resolveHostSafely('this-domain-should-not-exist-rankinai-test.invalid');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(['DNS_FAILURE', 'NO_ADDRESSES']).toContain(result.code);
  });

  it('permits the whitelisted test fixture host', async () => {
    const result = await resolveHostSafely('127.0.0.1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.addresses[0]?.address).toBe('127.0.0.1');
  });
});

describe('ipVersion (pure isIP replacement)', () => {
  it.each([
    ['192.168.0.1', 4],
    ['8.8.8.8', 4],
    ['255.255.255.255', 4],
    ['::1', 6],
    ['fe80::1', 6],
    ['2606:2800:220:1:248:1893:25c8:1946', 6],
    ['::ffff:10.0.0.1', 6],
    ['example.com', 0],
    ['256.1.1.1', 0],
    ['1.2.3', 0],
    ['010.0.0.1', 0],
    ['', 0],
    ['::1::2', 0],
    ['gggg::1', 0],
  ])('classifies %s as IPv%d', (input, expected) => {
    expect(ipVersion(input)).toBe(expected);
  });
});

describe('registrableDomain', () => {
  it.each([
    ['example.com', 'example.com'],
    ['www.example.com', 'example.com'],
    ['blog.shop.example.com', 'example.com'],
    ['example.co.uk', 'example.co.uk'],
    ['www.example.co.uk', 'example.co.uk'],
    ['shop.example.com.au', 'example.com.au'],
    // IP literals have no registrable domain and must survive untouched.
    ['127.0.0.1', '127.0.0.1'],
    ['203.0.113.9', '203.0.113.9'],
    ['[2001:db8::1]', '2001:db8::1'],
  ])('reduces %s to %s', (input, expected) => {
    expect(registrableDomain(input)).toBe(expected);
  });
});

describe('production safety', () => {
  it('never enables the fixture bypass when NODE_ENV is production', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalHost = process.env.ALLOW_TEST_FIXTURE_HOST;
    try {
      // @ts-expect-error deliberately overriding a readonly-typed env value
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_TEST_FIXTURE_HOST = '127.0.0.1';

      const result = validateAuditUrl('http://127.0.0.1:4321/');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('LOOPBACK_ADDRESS');
    } finally {
      // @ts-expect-error restoring the original value
      process.env.NODE_ENV = originalEnv;
      process.env.ALLOW_TEST_FIXTURE_HOST = originalHost;
    }
  });

  it('limits the fixture bypass to the exact port it names', () => {
    const originalHost = process.env.ALLOW_TEST_FIXTURE_HOST;
    try {
      process.env.ALLOW_TEST_FIXTURE_HOST = '127.0.0.1:4321';

      // The fixture website itself is reachable…
      expect(validateAuditUrl('http://127.0.0.1:4321/').ok).toBe(true);

      // …but nothing else on the loopback interface is. Opening the whole host
      // would expose the database, the app itself and any other local service.
      for (const url of [
        'http://127.0.0.1:5432/',
        'http://127.0.0.1:3000/',
        'http://127.0.0.1/',
      ]) {
        const result = validateAuditUrl(url);
        expect(result.ok, `${url} must be refused`).toBe(false);
        if (!result.ok) expect(result.code).toBe('LOOPBACK_ADDRESS');
      }
    } finally {
      process.env.ALLOW_TEST_FIXTURE_HOST = originalHost;
    }
  });

  it('still supports a host-only entry, allowing any port on that host', () => {
    const originalHost = process.env.ALLOW_TEST_FIXTURE_HOST;
    try {
      process.env.ALLOW_TEST_FIXTURE_HOST = '127.0.0.1';
      expect(validateAuditUrl('http://127.0.0.1:4321/').ok).toBe(true);
      expect(validateAuditUrl('http://127.0.0.1:9999/').ok).toBe(true);
      // A different loopback address is still not covered.
      expect(validateAuditUrl('http://127.0.0.2:4321/').ok).toBe(false);
    } finally {
      process.env.ALLOW_TEST_FIXTURE_HOST = originalHost;
    }
  });
});
