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
    },
  },

  // API routes (Node.js + Web APIs like Response, URLSearchParams)
  {
    files: ['src/pages/api/**/*.{js,ts}'],
    languageOptions: {
      parser: tsParser,
      globals: {
        ...globals.node, // ✅ Node globals
        ...globals.browser, // ✅ fetch, Response, URLSearchParams
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },
];
