/**
 * Canonical filesystem locations for the codegen tool's on-disk assets.
 *
 * `injectWorkspacePackages: true` (pnpm-workspace.yaml) makes consumers import
 * a *copied* instance of this package from the pnpm store rather than a symlink
 * to `tools/openapi-codegen`. Resolving assets relative to the running module
 * therefore points at the injected copy — whose git-ignored `.openapi-cache` is
 * never refreshed by `pull`/`pull:update` (those run in the source package). That
 * divergence silently fed stale specs into `generate` (a fresh `pnpm install`
 * even wipes the injected cache entirely).
 *
 * To make "pull then generate" just work regardless of injection, every
 * filesystem asset resolves to the one source package, located by walking up to
 * the workspace root (the nearest `pnpm-workspace.yaml`) and into
 * `tools/openapi-codegen`. The injected copy is then used only for its compiled
 * code; all data assets come from the canonical source.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'pathe';

function findSourceToolRoot(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  let dir = moduleDir;
  for (;;) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      return resolve(dir, 'tools/openapi-codegen');
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  // Fallback for running the package in isolation (no workspace root found):
  // assume this module lives under the package's `src/` or bundled `dist/`.
  return resolve(moduleDir, '..');
}

export const TOOL_ROOT = findSourceToolRoot();
export const CACHE_DIR = resolve(TOOL_ROOT, '.openapi-cache');
export const OVERLAY_PATH = resolve(TOOL_ROOT, 'specs/overlay.openapi.yaml');
export const TEMPLATES_DIR = resolve(TOOL_ROOT, 'templates');
export const LOCK_PATH = resolve(TOOL_ROOT, 'spec.lock');

export const SPEC_PATHS = {
  capi: resolve(CACHE_DIR, 'capi/cdn-v2.openapi.yaml'),
  mapi: resolve(CACHE_DIR, 'mapi/management-v1.openapi.yaml'),
  overlay: OVERLAY_PATH,
} as const;
