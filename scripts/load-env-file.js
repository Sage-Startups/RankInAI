#!/usr/bin/env node
/**
 * Read `.env` into the environment for the boot script itself.
 *
 * `scripts/start-web.js` runs before Next.js does, so the things it does
 * outside the app — probing the database, reconciling `SUPER_ADMIN_EMAIL` —
 * see only the real process environment. On a platform like Railway that is
 * exactly right: every variable is a real one. Run `npm start` on a machine
 * that keeps its configuration in a `.env` file, though, and both of those
 * steps quietly skip themselves for want of a `DATABASE_URL` that the
 * application itself can see perfectly well. A diagnostic that is silently
 * inert is worse than none.
 *
 * **A value already in the environment always wins.** This is the opposite of
 * what Next.js does with the same file, and it is deliberate: a platform
 * variable is the deployment's real configuration, and a stale `.env` that
 * happened to be copied into an image must never be able to redirect a
 * production server at a developer's database.
 *
 * `dotenv` is a devDependency and is not to be relied on at runtime, hence
 * this rather than a require of it.
 */

const { readFileSync } = require('node:fs');

/** Strip one layer of matching quotes, and an unquoted trailing comment. */
function parseValue(raw) {
  const value = raw.trim();

  const quote = value[0];
  if (
    (quote === '"' || quote === "'" || quote === '`') &&
    value.endsWith(quote) &&
    value.length > 1
  ) {
    const inner = value.slice(1, -1);
    // Escapes are only meaningful inside double quotes, as in dotenv.
    return quote === '"' ? inner.replace(/\\n/g, '\n').replace(/\\r/g, '\r') : inner;
  }

  // An unquoted value ends at a whitespace-preceded '#', so that
  // `KEY=value # note` does not become part of the value. A '#' with no
  // leading space is kept — it is a legitimate character in a password.
  return value.replace(/\s+#.*$/, '').trim();
}

/**
 * @returns { loaded: string[], skipped: string[] } — names set, and names that
 *          were already present in `env` and therefore left alone.
 */
function parseEnvFile(contents) {
  const entries = [];

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const eq = withoutExport.indexOf('=');
    if (eq <= 0) continue;

    const key = withoutExport.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    entries.push([key, parseValue(withoutExport.slice(eq + 1))]);
  }

  return entries;
}

function applyEnvFile(contents, env) {
  const loaded = [];
  const skipped = [];

  for (const [key, value] of parseEnvFile(contents)) {
    if (env[key] !== undefined && env[key] !== '') {
      skipped.push(key);
      continue;
    }
    env[key] = value;
    loaded.push(key);
  }

  return { loaded, skipped };
}

/** Best effort: a missing or unreadable file is the normal case in production. */
function loadEnvFile(path, env = process.env) {
  let contents;
  try {
    contents = readFileSync(path, 'utf8');
  } catch {
    return { loaded: [], skipped: [], present: false };
  }
  return { ...applyEnvFile(contents, env), present: true };
}

module.exports = { loadEnvFile, applyEnvFile, parseEnvFile, parseValue };
