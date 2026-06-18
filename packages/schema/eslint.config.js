import { storyblokLintConfig } from '@storyblok/eslint-config';

export default storyblokLintConfig({}, {
  ignores: ['dist/', 'src/generated/', 'playground/'],
}, {
  rules: {
    'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
  },
});
