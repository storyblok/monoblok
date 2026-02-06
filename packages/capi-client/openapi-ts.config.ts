import { defineConfig } from '@hey-api/openapi-ts';
// -i ./node_modules/@storyblok/openapi/dist/capi/stories.yaml -o ./src
export default defineConfig({
  // TODO multiple endpoints?!
  input: './node_modules/@storyblok/openapi/dist/capi/stories.yaml',
  output: './src/generated',
  plugins: [
    {
      name: '@hey-api/client-fetch',
      // runtimeConfigPath: './src/hey-api.ts', Maybe useful
    },
    '@hey-api/typescript',
    {
      auth: true,
      name: '@hey-api/sdk',
    },
  ],
});
