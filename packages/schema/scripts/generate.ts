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
    'ComponentCreate',
    'ComponentUpdate',
    'Asset',
    'AssetCreate',
    'AssetUpdate',
    'AssetFolder',
    'AssetFolderCreate',
    'AssetFolderUpdate',
    'ComponentFolder',
    'ComponentFolderCreate',
    'ComponentFolderUpdate',
    'Datasource',
    'DatasourceCreate',
    'DatasourceUpdate',
    'DatasourceEntry',
    'DatasourceEntryCreate',
    'DatasourceEntryUpdate',
    'MapiDatasourceEntry',
    'InternalTag',
    'InternalTagCreate',
    'InternalTagUpdate',
    'Link',
    'Preset',
    'PresetCreate',
    'PresetUpdate',
    'Space',
    'SpaceCreate',
    'SpaceUpdate',
    'Tag',
    'User',
    'UserUpdate',
  ],
});
