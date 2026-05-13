import { storyblokLintConfig } from '@storyblok/eslint-config';

export default storyblokLintConfig(
  {},
  {
    files: ['src/seeds/**/*.ts'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    },
  },
);
