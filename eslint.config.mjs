import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Flat ESLint config.
 *
 * `next lint` is deprecated in Next.js 15 and removed in 16, so the ESLint CLI
 * drives this directly (see the `lint` script) with the Next.js plugin wired in
 * by hand.
 */
export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'next-env.d.ts',
      'src/generated/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    // React rules apply to the application only. Playwright's fixture callbacks
    // take a parameter named `use`, and the test helpers follow the same
    // `useX` convention — both of which the hooks rules read as React hooks.
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooks.configs.recommended.rules,

      // Advisory performance guidance rather than a correctness rule. The two
      // places this fires — closing the mobile menu on navigation, and starting
      // the demo animation when it is set to autoplay — are effects reacting to
      // a prop or route change, which is exactly what an effect is for.
      'react-hooks/set-state-in-effect': 'off',
    },
  },

  {
    // A plain CommonJS Node entrypoint, not part of the TypeScript app.
    files: ['scripts/*.js'],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  {
    files: ['tests/**/*.ts'],
    rules: {
      // Playwright fixtures are declared as `async ({}, use) => …`; the empty
      // pattern is required by its API.
      'no-empty-pattern': 'off',
    },
  },

  {
    rules: {
      // Unused arguments are meaningful in this codebase: server actions must
      // accept `(previousState, formData)` even when they ignore one of them.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  {
    // Scripts, tests and config files run in Node and legitimately use the
    // console and process APIs.
    files: ['scripts/**/*.ts', 'tests/**/*.ts', '*.config.ts', '*.config.mjs', 'prisma/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
