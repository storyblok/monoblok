#!/usr/bin/env -S node --experimental-strip-types --no-warnings=ExperimentalWarning
/**
 * Generates `@storyblok/live-preview`'s typed public surface from the OpenAPI
 * specs. The tool resolves transitive deps, applies aliases, slices unused
 * types, and stamps the wrapper-template generics into `src/generated/`.
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "@storyblok/openapi-codegen";

const PKG_ROOT = resolve(fileURLToPath(import.meta.url), "../..");

await generate({
  outDir: resolve(PKG_ROOT, "src/generated"),
  include: ["Story", "RootBlock", "Block", "BlockContent"],
});
