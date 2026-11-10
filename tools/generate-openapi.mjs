#!/usr/bin/env node
/**
 * Generates the OpenAPI code of every installed consumer; runs on `pnpm install`.
 * A filtered install (`pnpm install --filter`) leaves the other consumers without
 * dependencies, so they are skipped.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CODEGEN_DEPENDENCY = "node_modules/@storyblok/openapi-codegen";

const installedConsumers = readdirSync("packages", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join("packages", entry.name))
  .filter((dir) => existsSync(join(dir, CODEGEN_DEPENDENCY)))
  .map((dir) => JSON.parse(readFileSync(join(dir, "package.json"), "utf8")))
  .filter((manifest) => manifest.scripts?.["generate:openapi"])
  .map((manifest) => manifest.name);

if (installedConsumers.length > 0) {
  execFileSync(
    "nx",
    ["run-many", "-t", "generate:openapi", `--projects=${installedConsumers.join(",")}`],
    { stdio: "inherit" },
  );
}
