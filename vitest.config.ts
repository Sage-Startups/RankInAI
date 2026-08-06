import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Two projects:
 *   - unit: pure functions, no database, fast
 *   - integration: hits a real PostgreSQL database, runs serially
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    projects: [
      {
        resolve: {
          alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
        },
        test: {
          name: 'unit',
          environment: 'node',
          globals: true,
          include: ['tests/unit/**/*.test.ts'],
          setupFiles: ['tests/setup/unit.ts'],
        },
      },
      {
        resolve: {
          alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
        },
        test: {
          name: 'integration',
          environment: 'node',
          globals: true,
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['tests/setup/integration.ts'],
          // Integration tests share one database. Each file namespaces its own
          // fixtures (see tests/helpers/db.ts), and a single fork keeps the
          // fixture HTTP server and connection pool predictable.
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          sequence: { concurrent: false },
          testTimeout: 120_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
