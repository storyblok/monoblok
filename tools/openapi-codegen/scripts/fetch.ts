#!/usr/bin/env -S node --experimental-strip-types --no-warnings=ExperimentalWarning
/**
 * Populates `.openapi-cache/{mapi,capi}/` from the private storyblok/openapi-wdx repo.
 *
 *   pnpm --filter @storyblok/openapi-codegen pull
 *     → clones at the SHA pinned in spec.lock; fails if computed hash doesn't match.
 *
 *   pnpm --filter @storyblok/openapi-codegen pull:update
 *     → clones upstream HEAD, writes a new SHA + hash into spec.lock.
 *
 * Requires `gh auth status`. Specs are git-ignored — external contributors
 * without org access build from committed `src/generated/` in each consumer.
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'pathe';
import { generateKnownTypes } from './known-types.ts';
import { CACHE_DIR, hashCache, readLock, UPSTREAM_REPO, writeLock } from './lock.ts';

const SPECS = [
  { surface: 'capi', file: 'cdn-v2.openapi.yaml' },
  { surface: 'mapi', file: 'management-v1.openapi.yaml' },
] as const;

function ensureGhAuth(): void {
  const result = spawnSync('gh', ['auth', 'status'], { stdio: 'pipe' });
  if (result.status !== 0) {
    console.error('gh CLI is not authenticated. Run `gh auth login` first.');
    console.error('Specs live in a private repo; external contributors should build from committed src/generated/.');
    process.exit(1);
  }
}

function run(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(' ')}`);
    process.exit(1);
  }
}

function captureStdout(cmd: string, args: string[]): string {
  const result = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'] });
  if (result.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(' ')}`);
    process.exit(1);
  }
  return result.stdout.toString().trim();
}

function clonePinned(sha: string): string {
  const clonePath = resolve(mkdtempSync(resolve(tmpdir(), 'openapi-wdx-')), 'repo');
  run('gh', ['repo', 'clone', UPSTREAM_REPO, clonePath, '--', '--no-checkout']);
  run('git', ['-C', clonePath, 'fetch', '--depth', '1', 'origin', sha]);
  run('git', ['-C', clonePath, 'checkout', sha]);
  return clonePath;
}

function cloneHead(): { clonePath: string; sha: string } {
  const clonePath = resolve(mkdtempSync(resolve(tmpdir(), 'openapi-wdx-')), 'repo');
  run('gh', ['repo', 'clone', UPSTREAM_REPO, clonePath, '--', '--depth', '1']);
  const sha = captureStdout('git', ['-C', clonePath, 'rev-parse', 'HEAD']);
  return { clonePath, sha };
}

function populateCache(clonePath: string): void {
  rmSync(CACHE_DIR, { recursive: true, force: true });
  mkdirSync(CACHE_DIR, { recursive: true });

  for (const { surface, file } of SPECS) {
    const src = resolve(clonePath, 'specs', file);
    if (!existsSync(src)) {
      throw new Error(`Expected ${surface} spec at ${src} — upstream layout has changed.`);
    }
    const dest = resolve(CACHE_DIR, surface);
    mkdirSync(dest, { recursive: true });
    copyFileSync(src, resolve(dest, file));
  }
}

function main(): void {
  const update = process.argv.slice(2).includes('--update');
  ensureGhAuth();

  const lock = readLock();
  if (!update && !lock) {
    console.error('No spec.lock found. Run `pnpm --filter @storyblok/openapi-codegen pull:update` to bootstrap.');
    process.exit(1);
  }

  const { clonePath, sha } = update
    ? cloneHead()
    : { clonePath: clonePinned(lock!.sha), sha: lock!.sha };

  try {
    populateCache(clonePath);
  }
  finally {
    rmSync(dirname(clonePath), { recursive: true, force: true });
  }

  generateKnownTypes();

  const computedHash = hashCache();

  if (update) {
    writeLock({ repo: UPSTREAM_REPO, sha, hash: computedHash });
    console.warn(`Updated spec.lock → ${sha}`);
  }
  else if (computedHash !== lock!.hash) {
    console.error('Hash mismatch after pinned fetch:');
    console.error(`  expected (spec.lock): ${lock!.hash}`);
    console.error(`  computed:             ${computedHash}`);
    console.error('Upstream content at the pinned SHA may have shifted (force-push?). Run `fetch:update`.');
    process.exit(1);
  }

  console.warn(`Cache populated at ${CACHE_DIR}`);
}

main();
