import { storyblokLintConfig } from '@storyblok/eslint-config';

export default storyblokLintConfig({}, {
  ignores: ['.openapi-cache/'],
});
