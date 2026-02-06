import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  // TODO multiple endpoints?!
  input: './node_modules/@storyblok/openapi/dist/capi/stories.yaml',
  output: './src/generated',
  plugins: [
    '@hey-api/typescript',
    '@hey-api/client-ky',
    {
      name: '@hey-api/sdk',
    },
  ],
});
