#!/usr/bin/env tsx

import { generate } from '@storyblok/openapi-codegen';
import { dirname, resolve } from 'pathe';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

await generate({
  outDir: resolve(packageRoot, 'src/generated'),
  sdk: 'mapi',
  include: [
    'Component',
    'ComponentCreate',
    'ComponentUpdate',
    'MapiStory',
    'StoryCreate',
    'StoryUpdate',
    'BlockContent',
    'BlockContentInput',
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
