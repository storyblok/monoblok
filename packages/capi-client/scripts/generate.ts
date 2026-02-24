import { createClient } from '@hey-api/openapi-ts';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const endpoints = [
  { name: 'stories', input: 'stories.yaml' },
  { name: 'links', input: 'links.yaml' },
  { name: 'spaces', input: 'spaces.yaml' },
  { name: 'datasources', input: 'datasources.yaml' },
  { name: 'datasource-entries', input: 'datasource_entries.yaml' },
  { name: 'tags', input: 'tags.yaml' },
];

const distDir = resolve(__dirname, '../node_modules/@storyblok/openapi/dist/capi');

for (const endpoint of endpoints) {
  await createClient({
    input: resolve(distDir, endpoint.input),
    output: resolve(__dirname, `../src/generated/${endpoint.name}`),
    plugins: [
      '@hey-api/typescript',
      '@hey-api/client-ky',
      {
        name: '@hey-api/sdk',
      },
    ],
  });
}
