import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseFromAddress, sendEmail } from '@/lib/email';
import { resetEnvCache } from '@/lib/env';

/**
 * The SocketLabs provider.
 *
 * The behavior that matters is not "it posts JSON" but "it never claims to have
 * sent something SocketLabs refused". Their Injection API answers HTTP 200 with
 * an `ErrorCode` in the body, so a status-only check would report an undelivered
 * password reset as sent — and the user would sit waiting for an email that
 * never existed.
 */

const KEYS = [
  'EMAIL_PROVIDER',
  'EMAIL_PROVIDER_API_KEY',
  'EMAIL_SOCKETLABS_SERVER_ID',
  'EMAIL_FROM',
] as const;

const MESSAGE = {
  to: 'owner@example.com',
  subject: 'Reset your RankClear password',
  html: '<p>Reset</p>',
  text: 'Reset https://rankclear.ai/reset-password?token=secret',
};

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of KEYS) saved[key] = process.env[key];

  process.env.EMAIL_PROVIDER = 'socketlabs';
  process.env.EMAIL_PROVIDER_API_KEY = 'test-api-key';
  process.env.EMAIL_SOCKETLABS_SERVER_ID = '12345';
  process.env.EMAIL_FROM = 'RankClear <no-reply@rankclear.ai>';
  resetEnvCache();
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetEnvCache();
  vi.unstubAllGlobals();
});

function stubFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  });
  return calls;
}

describe('parseFromAddress', () => {
  it('splits a display name from the address, as SocketLabs requires', () => {
    expect(parseFromAddress('RankClear <no-reply@rankclear.ai>')).toEqual({
      address: 'no-reply@rankclear.ai',
      name: 'RankClear',
    });
  });

  it('accepts a bare address', () => {
    expect(parseFromAddress('no-reply@rankclear.ai')).toEqual({
      address: 'no-reply@rankclear.ai',
      name: null,
    });
  });

  it('strips quotes around a display name', () => {
    expect(parseFromAddress('"RankClear Support" <help@rankclear.ai>')).toEqual({
      address: 'help@rankclear.ai',
      name: 'RankClear Support',
    });
  });

  it('treats an empty display name as absent rather than sending an empty one', () => {
    expect(parseFromAddress('<no-reply@rankclear.ai>')).toEqual({
      address: 'no-reply@rankclear.ai',
      name: null,
    });
  });
});

describe('sendEmail via socketlabs', () => {
  it('posts the message in the shape the Injection API expects', async () => {
    const calls = stubFetch(200, { ErrorCode: 'Success', MessageResults: [] });

    const result = await sendEmail(MESSAGE);

    expect(result).toEqual({ ok: true, provider: 'socketlabs', error: null });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://inject.socketlabs.com/api/v1/email');

    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.ServerId).toBe(12345);
    expect(body.ApiKey).toBe('test-api-key');
    expect(body.Messages[0].To).toEqual([{ EmailAddress: 'owner@example.com' }]);
    expect(body.Messages[0].From).toEqual({
      EmailAddress: 'no-reply@rankclear.ai',
      FriendlyName: 'RankClear',
    });
    expect(body.Messages[0].Subject).toBe(MESSAGE.subject);
    expect(body.Messages[0].HtmlBody).toBe(MESSAGE.html);
    expect(body.Messages[0].TextBody).toBe(MESSAGE.text);
  });

  it('fails when SocketLabs answers 200 with a non-Success ErrorCode', async () => {
    stubFetch(200, {
      ErrorCode: 'InvalidAuthentication',
      MessageResults: [],
    });

    const result = await sendEmail(MESSAGE);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('InvalidAuthentication');
  });

  it('surfaces a per-message rejection, which is where an unverified domain shows up', async () => {
    stubFetch(200, {
      ErrorCode: 'Warning',
      MessageResults: [{ Index: 0, ErrorCode: 'InvalidFromAddress' }],
    });

    const result = await sendEmail(MESSAGE);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('InvalidFromAddress');
  });

  it('reports an HTTP failure', async () => {
    stubFetch(401, { ErrorCode: 'InvalidAuthentication' });

    const result = await sendEmail(MESSAGE);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('HTTP 401');
  });

  it('treats a body it cannot parse as a failure, not a send', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('not json');
      },
      text: async () => 'not json',
    }));

    const result = await sendEmail(MESSAGE);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('unrecognized response');
  });

  it('refuses to try without an API key', async () => {
    delete process.env.EMAIL_PROVIDER_API_KEY;
    resetEnvCache();
    const calls = stubFetch(200, { ErrorCode: 'Success' });

    const result = await sendEmail(MESSAGE);

    expect(result).toMatchObject({ ok: false, provider: 'socketlabs' });
    expect(result.error).toContain('EMAIL_PROVIDER_API_KEY');
    expect(calls).toHaveLength(0);
  });

  it('refuses to try without a server id, rather than guessing one', async () => {
    delete process.env.EMAIL_SOCKETLABS_SERVER_ID;
    resetEnvCache();
    const calls = stubFetch(200, { ErrorCode: 'Success' });

    const result = await sendEmail(MESSAGE);

    expect(result.error).toContain('EMAIL_SOCKETLABS_SERVER_ID');
    expect(calls).toHaveLength(0);
  });

  it('ignores a server id that is not a positive number', async () => {
    process.env.EMAIL_SOCKETLABS_SERVER_ID = 'not-a-number';
    resetEnvCache();

    const result = await sendEmail(MESSAGE);

    expect(result.error).toContain('EMAIL_SOCKETLABS_SERVER_ID');
  });

  it('reports a network failure instead of throwing into the caller', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('socket hang up');
    });

    const result = await sendEmail(MESSAGE);

    expect(result).toEqual({
      ok: false,
      provider: 'socketlabs',
      error: 'socket hang up',
    });
  });
});
