/**
 * Canonical filesystem locations for the codegen tool's on-disk assets.
 *
 * `injectWorkspacePackages: true` (pnpm-workspace.yaml) makes consumers import
 * a *copied* instance of this package from the pnpm store rather than a symlink
 * to `tools/openapi-codegen`. Resolving assets relative to the running module
 * therefore points at the injected copy, which `pull` never updates (it runs in
 * the source package) and which only holds the files listed in `files`. That
 * divergence silently fed stale specs into `generate`.
 *
 * To make "pull then generate" just work regardless of injection, every
 * filesystem asset resolves to the one source package, located by walking up to
 * the workspace root (the nearest `pnpm-workspace.yaml`) and into
 * `tools/openapi-codegen`. The injected copy is then used only for its compiled
 * code; all data assets come from the canonical source.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "pathe";

function findSourceToolRoot(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  let dir = moduleDir;
  while (!existsSync(resolve(dir, "pnpm-workspace.yaml"))) {
    const parent = dirname(dir);
    if (parent === dir) {
      // Reached the filesystem root without finding a workspace. Fallback for
      // running the package in isolation: assume this module lives under the
      // package's `src/` or bundled `dist/`.
      return resolve(moduleDir, "..");
    }
    dir = parent;
  }
  return resolve(dir, "tools/openapi-codegen");
}

export const TOOL_ROOT = findSourceToolRoot();
export const UPSTREAM_DIR = resolve(TOOL_ROOT, "upstream");
export const OVERLAY_PATH = resolve(TOOL_ROOT, "specs/overlay.openapi.yaml");
export const TEMPLATES_DIR = resolve(TOOL_ROOT, "templates");
export const LOCK_PATH = resolve(TOOL_ROOT, "spec.lock");

export const SPEC_PATHS = {
  capi: resolve(UPSTREAM_DIR, "capi/cdn-v2.openapi.yaml"),
  mapi: resolve(UPSTREAM_DIR, "mapi/management-v1.openapi.yaml"),
  overlay: OVERLAY_PATH,
} as const;
