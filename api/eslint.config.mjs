import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ...js.configs.recommended,
    files: ['test/**/*.cjs'],
    languageOptions: {
      globals: { fetch: 'readonly' },
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['src/**/*.ts'],
  })),
];
