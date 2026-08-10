import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { isBindAddress, pickHostname } = require('../../scripts/bind-host.js') as {
  isBindAddress: (value: string) => boolean;
  pickHostname: (
    env: Record<string, string | undefined>,
    done: (hostname: string, why: string, ignored: string | null) => void,
  ) => void;
};

function pick(env: Record<string, string | undefined>) {
  return new Promise<{ hostname: string; why: string; ignored: string | null }>((resolve) => {
    pickHostname(env, (hostname, why, ignored) => resolve({ hostname, why, ignored }));
  });
}

/**
 * Docker sets HOSTNAME to the container id, and Next's standalone server
 * hands whatever it finds there to listen(). Honoring it bound the server to
 * a single interface, which on Railway meant health probes — arriving over
 * the IPv6 private network — reached nothing at all, silently.
 */
describe('web server bind address', () => {
  it('rejects a Docker container id, which is a machine name and not an address', () => {
    expect(isBindAddress('7097ab5995d3')).toBe(false);
  });

  it('accepts the addresses a person would actually pin', () => {
    expect(isBindAddress('0.0.0.0')).toBe(true);
    expect(isBindAddress('127.0.0.1')).toBe(true);
    expect(isBindAddress('::')).toBe(true);
    expect(isBindAddress('[::1]')).toBe(true);
    expect(isBindAddress('localhost')).toBe(true);
  });

  it('rejects other hostnames that resolve but are not bind specifications', () => {
    expect(isBindAddress('rankinai.up.railway.app')).toBe(false);
    expect(isBindAddress('postgres.railway.internal')).toBe(false);
  });

  it('ignores a container id and reports what it discarded', async () => {
    const chosen = await pick({ HOSTNAME: '7097ab5995d3' });
    expect(chosen.hostname).not.toBe('7097ab5995d3');
    expect(['::', '0.0.0.0']).toContain(chosen.hostname);
    expect(chosen.ignored).toBe('7097ab5995d3');
  });

  it('binds every interface when no address is configured', async () => {
    const chosen = await pick({});
    expect(['::', '0.0.0.0']).toContain(chosen.hostname);
    expect(chosen.ignored).toBeNull();
  });

  it('honors an explicit address', async () => {
    const chosen = await pick({ WEB_BIND_HOST: '127.0.0.1' });
    expect(chosen.hostname).toBe('127.0.0.1');
    expect(chosen.ignored).toBeNull();
  });

  it('lets WEB_BIND_HOST override the container id rather than the other way round', async () => {
    const chosen = await pick({
      WEB_BIND_HOST: '0.0.0.0',
      HOSTNAME: '7097ab5995d3',
    });
    expect(chosen.hostname).toBe('0.0.0.0');
  });
});
