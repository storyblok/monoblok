import { storyblokLintConfig } from '@storyblok/eslint-config';

export default storyblokLintConfig({}, {
  ignores: ['tests/unit/coverage/', 'dist/', 'playground/astro/.astro/', 'playground/vanilla/public/', 'README.md'],
});
