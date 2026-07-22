import { createEslintConfig } from 'super-configs/eslint';
import eslintVitest from 'super-configs/eslint/vitest';

export default [
  ...createEslintConfig({
    runtime: 'node',
    language: 'ts',
    ignores: ['dist/**', 'docs/**', 'coverage/**'],
  }),
  ...eslintVitest,
];
