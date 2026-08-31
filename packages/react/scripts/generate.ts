#!/usr/bin/env -S node --experimental-strip-types --no-warnings=ExperimentalWarning
/**
 * Generates the block-data types for `@storyblok/react` from the pinned
 * OpenAPI overlay spec. Only `BlockContentBase` is requested — the minimal
 * set needed to back `BlockContent`.
 *
 * Re-run after `pnpm --filter @storyblok/openapi-codegen pull[:update]`.
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "@storyblok/openapi-codegen";

const PKG_ROOT = resolve(fileURLToPath(import.meta.url), "../..");

await generate({
  outDir: resolve(PKG_ROOT, "src/generated"),
  include: ["BlockContent"],
});
