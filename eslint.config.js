// eslint.config.js
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import astroParser from 'astro-eslint-parser';
import pluginAstro from 'eslint-plugin-astro';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules',
      'dist',
      '.astro',
      '.astro/types',
      '.build',
      '.cache',
      'out',
      '.next',
      '.vercel',
      '.netlify',
      'coverage',
      '.venv',
      '.tmp',
      'VERSION.md',
      'CHANGELOG.md',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
    ],
  },
  // JavaScript rules
  js.configs.recommended,

  // TypeScript rules
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      globals: {
        ...globals.browser, // ✅ DOM types (document, fetch, etc.)
        ...globals.node, // ✅ Node.js types (process, Buffer, etc.)
        NodeJS: 'readonly', // ✅ @types/node namespace used in signatures
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettierPlugin,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      'prettier/prettier': 'error', // enforce Prettier formatting
    },
  },

  // Astro rules
  ...pluginAstro.configs['flat/recommended'],
  {
    files: ['**/*.astro'],
    languageOptions: {
      parser: astroParser,
      parserOptions: {
        parser: tsParser, // use TS parser inside <script>
      },
      globals: {
        ...globals.browser,
        gtag: 'readonly', // ✅ allow gtag without no-undef
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
      // Omit-pattern via rest siblings (`const { x: _x, ...rest }`) is idiomatic.
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },

  // Local scripts, test harnesses, and root configs run under Node, not the
  // browser: without this block, `process`/`console`/`fetch` report as
  // undefined in every newsletter CLI and automation helper.
  {
    files: [
      'scripts/**/*.{js,mjs,cjs,ts}',
      'tests/**/*.{js,mjs,cjs}',
      '*.{js,mjs,cjs}',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Test helpers deliberately use `any` for mock posts and payloads; keep the
  // rule on for production code, where an explicit type is cheap.
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: {
        RequestInit: 'readonly', // ✅ DOM lib types used in fetch mocks
        BodyInit: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
