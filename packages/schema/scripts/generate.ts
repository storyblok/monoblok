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
  include: [
    // Story + content (CAPI Story, MAPI write payloads)
    'Story',
    'StoryBlock',
    'Block',
    'BlockContent',
    'BlockContentInput',
    'MapiStory',
    'StoryCreate',
    'StoryUpdate',
    'StoryAlternate',
    'StoryTranslatedSlug',
    'StoryLocalizedPath',
    // Field
    'Field',
    'FieldType',
    'FieldValue',
    'FieldValueInput',
    'AssetFieldValue',
    'MultilinkFieldValue',
    'PluginFieldValue',
    'RichtextFieldValue',
    'TableFieldValue',
    // Component (Block) lifecycle
    'ComponentCreate',
    'ComponentUpdate',
    // Asset
    'Asset',
    'AssetCreate',
    'AssetUpdate',
    'AssetFolder',
    'AssetFolderCreate',
    'AssetFolderUpdate',
    // Component folder (MAPI-only)
    'ComponentFolder',
    'ComponentFolderCreate',
    'ComponentFolderUpdate',
    // Datasource
    'Datasource',
    'DatasourceCreate',
    'DatasourceUpdate',
    'DatasourceEntry',
    'DatasourceEntryCreate',
    'DatasourceEntryUpdate',
    'MapiDatasourceEntry',
    // Internal tag (MAPI-only)
    'InternalTag',
    'InternalTagCreate',
    'InternalTagUpdate',
    // Link (CAPI-only)
    'Link',
    // Preset (MAPI-only)
    'Preset',
    'PresetCreate',
    'PresetUpdate',
    // Space (MAPI-only)
    'Space',
    'SpaceCreate',
    'SpaceUpdate',
    // Tag (CAPI-only)
    'Tag',
    // User (MAPI-only)
    'User',
    'UserUpdate',
  ],
});
