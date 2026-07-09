#!/usr/bin/env -S node --experimental-strip-types --no-warnings=ExperimentalWarning
/**
 * Generates `storyblok` CLI's OpenAPI-derived richtext types from the pinned
 * overlay spec cache. Produces `RichtextDoc`, `RichTextNode`, and
 * `RichTextMark` in `src/generated/` — the types for the richtext document
 * format consumed by story content.
 *
 * Re-run after `pnpm --filter @storyblok/openapi-codegen pull[:update]`.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from '@storyblok/openapi-codegen';
import { execSync } from 'node:child_process';

const PKG_ROOT = resolve(fileURLToPath(import.meta.url), '../..');

await generate({
  outDir: resolve(PKG_ROOT, 'src/generated'),
  include: ['RichtextDoc', 'RichTextNode', 'RichTextMark'],
});
const GENERATED_PATH = resolve(PKG_ROOT, 'src/generated');
execSync(`pnpm eslint ${GENERATED_PATH} --fix`, {
  stdio: 'inherit',
});
