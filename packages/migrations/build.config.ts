import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  // Type-only imports, but rollup resolves them before TS strips them.
  // Without this, unbuild fails on unresolvable subpath warnings.
  externals: [
    '@storyblok/management-api-client',
    '@storyblok/management-api-client/resources/stories',
    '@storyblok/management-api-client/resources/assets',
    '@storyblok/management-api-client/resources/components',
    '@storyblok/management-api-client/resources/datasources',
  ],
});
