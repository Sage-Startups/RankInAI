import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { applyEnvFile, parseEnvFile, loadEnvFile } = require('../../scripts/load-env-file.js') as {
  applyEnvFile: (
    contents: string,
    env: Record<string, string | undefined>,
  ) => { loaded: string[]; skipped: string[] };
  parseEnvFile: (contents: string) => [string, string][];
  loadEnvFile: (
    path: string,
    env?: Record<string, string | undefined>,
  ) => { loaded: string[]; skipped: string[]; present: boolean };
};

/**
 * The boot script reads `.env` so its own checks are configured the way the app
 * is. The rule that matters is the precedence: a real environment variable is
 * the deployment's configuration and must never be replaced by a file that
 * happened to be copied into an image.
 */
describe('loadEnvFile', () => {
  it('never overwrites a value already in the environment', () => {
    const env = { DATABASE_URL: 'postgresql://real-platform-database/app' };
    const result = applyEnvFile('DATABASE_URL=postgresql://a-developers-laptop/dev', env);

    expect(env.DATABASE_URL).toBe('postgresql://real-platform-database/app');
    expect(result.loaded).toEqual([]);
    expect(result.skipped).toEqual(['DATABASE_URL']);
  });

  it('treats an empty environment value as absent', () => {
    const env: Record<string, string | undefined> = { SUPER_ADMIN_EMAIL: '' };
    applyEnvFile('SUPER_ADMIN_EMAIL=owner@rankclear.ai', env);

    expect(env.SUPER_ADMIN_EMAIL).toBe('owner@rankclear.ai');
  });

  it('fills in the values that are missing', () => {
    const env: Record<string, string | undefined> = {};
    const result = applyEnvFile(
      ['SUPER_ADMIN_EMAIL=owner@rankclear.ai', 'AUTH_TRUST_HOST=true'].join('\n'),
      env,
    );

    expect(env).toEqual({ SUPER_ADMIN_EMAIL: 'owner@rankclear.ai', AUTH_TRUST_HOST: 'true' });
    expect(result.loaded).toEqual(['SUPER_ADMIN_EMAIL', 'AUTH_TRUST_HOST']);
  });

  it('ignores comments, blank lines and anything that is not an assignment', () => {
    expect(
      parseEnvFile(
        ['# a comment', '', '   ', 'not an assignment', '=novalue', 'KEY=value'].join('\n'),
      ),
    ).toEqual([['KEY', 'value']]);
  });

  it('accepts an "export" prefix, as a shell-sourced file has', () => {
    expect(parseEnvFile('export SUPPORT_EMAIL=help@rankclear.ai')).toEqual([
      ['SUPPORT_EMAIL', 'help@rankclear.ai'],
    ]);
  });

  it('strips one layer of quotes and honors \\n inside double quotes', () => {
    expect(parseEnvFile('A="one"\nB=\'two\'\nC="line\\nbreak"')).toEqual([
      ['A', 'one'],
      ['B', 'two'],
      ['C', 'line\nbreak'],
    ]);
  });

  it('drops a trailing comment but keeps a # that is part of the value', () => {
    expect(parseEnvFile('A=value # a note')).toEqual([['A', 'value']]);
    // A password may legitimately contain '#', and truncating it would produce
    // a connection failure with no visible cause.
    expect(parseEnvFile('B=postgresql://user:pa#ss@host:5432/db')).toEqual([
      ['B', 'postgresql://user:pa#ss@host:5432/db'],
    ]);
  });

  it('keeps an equals sign inside a value', () => {
    expect(parseEnvFile('AUTH_SECRET=abc/def+gh==')).toEqual([['AUTH_SECRET', 'abc/def+gh==']]);
  });

  it('rejects a key that is not a valid variable name', () => {
    expect(parseEnvFile('not-a-key=value\n1KEY=value\nGOOD_KEY=value')).toEqual([
      ['GOOD_KEY', 'value'],
    ]);
  });

  it('reports a missing file rather than throwing — production has none', () => {
    const env: Record<string, string | undefined> = {};
    const result = loadEnvFile('/nonexistent/path/.env', env);

    expect(result).toEqual({ loaded: [], skipped: [], present: false });
    expect(env).toEqual({});
  });
});
