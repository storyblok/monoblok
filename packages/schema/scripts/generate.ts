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
  // `@storyblok/schema` now defines only content shapes, so the surface is the
  // block/field/datasource definitions plus the story/content types derived
  // from them. Payload builders and wire-only entities live in the typed
  // clients, not here.
  include: [
    'Story',
    'RootBlock',
    'Block',
    'BlockContent',
    'BlockContentInput',
    'MapiStory',
    'StoryCreate',
    'StoryUpdate',
    'StoryAlternate',
    'StoryTranslatedSlug',
    'StoryLocalizedPath',
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
  // Emit internal Zod v4 schemas for the overlay content-value shapes
  // (asset, richtext, link, table, plugin, block-content). These power the
  // runtime validators; they are never imported by public types.
  zod: { spec: 'overlay' },
});
