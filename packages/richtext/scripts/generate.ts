#!/usr/bin/env -S node --experimental-strip-types --no-warnings=ExperimentalWarning
/**
 * Generates `@storyblok/richtext`'s OpenAPI-derived types from the pinned
 * overlay spec cache. Produces `RichtextDoc`, `RichTextNode`, and
 * `RichTextMark` in `src/generated/` — the public-API types for the richtext
 * document format consumed by story content.
 *
 * These types mirror the hand-authored `src/static/types.generated.ts`
 * (which is driven by the live Tiptap schema) and serve as the
 * contract-first source of truth for consumers who only need the data shape.
 *
 * Re-run after `pnpm --filter @storyblok/openapi-codegen pull[:update]`.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from '@storyblok/openapi-codegen';

const PKG_ROOT = resolve(fileURLToPath(import.meta.url), '../..');

await generate({
  outDir: resolve(PKG_ROOT, 'src/generated'),
  include: ['RichtextDoc', 'RichTextNode', 'RichTextMark'],
});
