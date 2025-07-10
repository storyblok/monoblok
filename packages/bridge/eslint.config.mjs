import { storyblokLintConfig } from '@storyblok/eslint-config';

export default storyblokLintConfig({
  ignores: ['**/node_modules/**', 'playground', 'README.md'],
  rules: {
    'ts/no-unsafe-function-type': 'off',
    'jsonc/sort-keys': 'off',
  },
});
