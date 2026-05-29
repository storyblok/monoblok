#!/usr/bin/env tsx

import { generate } from '@storyblok/openapi-codegen';
import { dirname, resolve } from 'pathe';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

await generate({
  outDir: resolve(packageRoot, 'src/generated'),
  sdk: 'capi',
  include: [
    'Story',
    'BlockContent',
    'Datasource',
    'DatasourceEntry',
    'Link',
    'Tag',
    'StoryAlternate',
    'StoryTranslatedSlug',
    'StoryLocalizedPath',
    'Space',
  ],
});
