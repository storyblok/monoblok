#!/usr/bin/env tsx

import { generate } from '@storyblok/openapi-codegen';
import { dirname, resolve } from 'pathe';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

await generate({
  outDir: resolve(packageRoot, 'src/generated'),
  sdk: 'capi',
  include: [
    // Wrapper templates (transitively pull block, field, story).
    'Story',
    'BlockContent',
    // Aliased CAPI entity shapes re-exported on the public surface.
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
