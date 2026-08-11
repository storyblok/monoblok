#!/usr/bin/env tsx

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { generate } from '@storyblok/openapi-codegen';

const PKG_ROOT = resolve(fileURLToPath(import.meta.url), '../..');

// Step 1 – fetch OpenAPI spec and emit src/generated/overlay/types.gen.ts
await generate({
  outDir: resolve(PKG_ROOT, 'src/generated'),
  include: ['RichTextDoc', 'RichTextNode', 'RichTextMark'],
});
execSync(`pnpm eslint ${resolve(PKG_ROOT, 'src/generated')} --fix`, {
  stdio: 'inherit',
});
