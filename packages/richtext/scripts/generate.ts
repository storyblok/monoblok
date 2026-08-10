#!/usr/bin/env tsx

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from '@storyblok/openapi-codegen';

const PKG_ROOT = resolve(fileURLToPath(import.meta.url), '../..');

// Fetch the OpenAPI spec and emit src/generated/overlay/types.gen.ts. The output
// is not formatted: `src/generated/` is excluded from `vp fmt` (see
// .prettierignore) so regenerating never fights the formatter.
await generate({
  outDir: resolve(PKG_ROOT, 'src/generated'),
  include: ['RichTextDoc', 'RichTextNode', 'RichTextMark'],
});
