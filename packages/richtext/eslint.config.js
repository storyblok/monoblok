import { storyblokLintConfig } from '@storyblok/eslint-config';

export default storyblokLintConfig({

}, {
  ignores: ['tests/unit/coverage/', 'dist/', 'playground/astro/.astro/', 'playground/vanilla/public/', 'README.md', 'src/static/render-map.generated.ts', 'src/static/types.generated.ts'],
});
