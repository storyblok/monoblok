import { storyblokLintConfig } from '@storyblok/eslint-config';

export default storyblokLintConfig({
  vue: true,
}, {
  ignores: ['tests/unit/coverage/', 'dist/', '**/*.d.ts', '**/node_modules/**', 'README.md'],
});
