#!/usr/bin/env tsx

import { generate } from '@storyblok/openapi-codegen';
import { dirname, resolve } from 'pathe';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

await generate({
  outDir: resolve(packageRoot, 'src/generated'),
  sdk: 'mapi',
  include: [
    // Wrapper templates (transitively pull block, field, story, mapi-story).
    'Component',
    'MapiStory',
    'StoryCreate',
    'StoryUpdate',
    'BlockContent',
    'BlockContentInput',
    // Aliased MAPI entity shapes re-exported on the public surface.
    'Asset',
    'AssetCreate',
    'AssetUpdate',
    'AssetFolder',
    'AssetFolderCreate',
    'AssetFolderUpdate',
    'ComponentFolder',
    'ComponentFolderCreate',
    'ComponentFolderUpdate',
    'MapiDatasource',
    'DatasourceCreate',
    'DatasourceUpdate',
    'MapiDatasourceEntry',
    'DatasourceEntryCreate',
    'DatasourceEntryUpdate',
    'InternalTag',
    'InternalTagCreate',
    'InternalTagUpdate',
    'Preset',
    'PresetCreate',
    'PresetUpdate',
    'Space',
    'SpaceCreate',
    'SpaceUpdate',
    'User',
    'UserUpdate',
    'StoryTranslatedSlug',
    'StoryLocalizedPath',
  ],
});
