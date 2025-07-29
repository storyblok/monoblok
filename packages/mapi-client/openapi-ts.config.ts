import { defaultPlugins } from '@hey-api/openapi-ts';

export default {
  input: require.resolve('@storyblok/openapi/dist/datasources.yaml'),
  output: 'src/generated',
  plugins: [
    "@hey-api/schemas",
    "@hey-api/client-fetch",
    {
      enums: 'javascript',
      name: '@hey-api/typescript',
    },
    {
      asClass: false,
      client: true,
      name: '@hey-api/sdk',
    },
  ],
};
