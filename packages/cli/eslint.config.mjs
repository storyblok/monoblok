import { storyblokLintConfig } from '@storyblok/eslint-config';

export default storyblokLintConfig({
  rules: {
    'no-console': 'off',
    'style/max-statements-per-line': 'off',
  },
}, {
  // This fixture must stay byte-identical to `renderSchemaTypes`'s actual output,
  // which the drift test in `fixture-drift.test.ts` compares it against; linting
  // it would reformat it out of sync with the renderer.
  ignores: ['src/commands/types/generate/schema-types/__fixtures__/expected-types.d.ts'],
});
