import { defineConfig } from 'oxlint';
import { base } from '@storyblok/lint-config';

export default defineConfig({
  extends: [base],
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', 'playground/', '.angular/'],
});
