#!/usr/bin/env -S node --experimental-strip-types --no-warnings=ExperimentalWarning
/**
 * Verifies that `.openapi-cache/` on disk matches `spec.lock`.
 *
 * This is a standalone manual/CI check. The package `build` target compiles the
 * generator with tsdown, and consumer `generate` targets build the generator
 * before importing it.
 */

import { existsSync } from 'node:fs';
import { CACHE_DIR, hashCache, LOCK_PATH, readLock } from './lock.ts';

const lock = readLock();
if (!lock) {
  console.error(`spec.lock not found at ${LOCK_PATH}.`);
  console.error('Run `pnpm --filter @storyblok/openapi-codegen pull:update` to bootstrap.');
  process.exit(1);
}

if (!existsSync(CACHE_DIR)) {
  console.error(`OpenAPI cache not found at ${CACHE_DIR}.`);
  console.error('Run `pnpm --filter @storyblok/openapi-codegen pull` to populate it.');
  process.exit(1);
}

const computed = hashCache();
if (computed !== lock.hash) {
  console.error('Spec cache hash mismatch:');
  console.error(`  expected (spec.lock): ${lock.hash}`);
  console.error(`  computed:             ${computed}`);
  console.error('Cache is out of sync with spec.lock. Run `pnpm --filter @storyblok/openapi-codegen pull`.');
  process.exit(1);
}

console.warn(`spec.lock OK — sha ${lock.sha.slice(0, 12)}, hash ${lock.hash.slice(7, 19)}…`);
