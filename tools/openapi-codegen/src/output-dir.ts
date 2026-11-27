import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "pathe";

/**
 * The subdirectories `generate()` writes under a consumer's `outDir`: one per
 * spec (types, SDK, Zod schemas) plus `types/` for the wrapper templates.
 */
export const GENERATED_SUBDIRS = ["capi", "mapi", "overlay", "types"] as const;

/**
 * Clears the previous run's output so removed types don't linger. Only the
 * subdirectories `generate()` owns are removed: a consumer may keep other
 * generated files in the same `outDir` (e.g. `@storyblok/richtext`'s render
 * map), and those must survive a regeneration.
 */
export function clearGeneratedOutput(outDir: string): void {
  for (const dir of GENERATED_SUBDIRS) {
    rmSync(resolve(outDir, dir), { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });
}
