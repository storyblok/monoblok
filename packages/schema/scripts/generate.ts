#!/usr/bin/env -S node --experimental-strip-types --no-warnings=ExperimentalWarning
/**
 * Generates `@storyblok/schema`'s typed public surface from the pinned OpenAPI
 * cache. The tool resolves transitive deps, applies aliases, slices unused
 * types, and stamps the wrapper-template generics into `src/generated/`.
 *
 * Re-run after `pnpm --filter @storyblok/openapi-codegen pull[:update]`.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from '@storyblok/openapi-codegen';

const PKG_ROOT = resolve(fileURLToPath(import.meta.url), '../..');

await generate({
  outDir: resolve(PKG_ROOT, 'src/generated'),
  // `@storyblok/schema` exposes content shapes only: block, field, and
  // datasource definitions plus the story and block-content types derived from
  // them. Story CRUD payloads (`StoryCreate`/`StoryUpdate`) are management-API
  // wire shapes and live in `@storyblok/management-api-client`.
  include: [
    'Story',
    'MapiStory',
    'RootBlock',
    'Block',
    'BlockContent',
    'BlockContentInput',
    'Field',
    'FieldType',
    'FieldValue',
    'FieldValueInput',
    'AssetFieldValue',
    'MultilinkFieldValue',
    'PluginFieldValue',
    'RichtextFieldValue',
    'TableFieldValue',
    'Datasource',
  ],
  // Emit internal Zod v4 schemas for the overlay content-value shapes. These
  // power the runtime validators.
  zod: { spec: 'overlay' },
});
