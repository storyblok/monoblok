#!/usr/bin/env -S node --experimental-strip-types --no-warnings=ExperimentalWarning
/**
 * Downloads the public OpenAPI specs from the Storyblok docs into the
 * committed `upstream/{capi,mapi}/` and records their hash in spec.lock.
 *
 *   pnpm --filter @storyblok/openapi-codegen pull
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "pathe";
import { generateKnownTypes } from "./known-types.ts";
import { hashUpstream, readLock, UPSTREAM_DIR, writeLock } from "../src/lock.ts";

const SPEC_BASE_URL = "https://www.storyblok.com/docs/openapi-spec";
const SPECS = [
  { surface: "capi", file: "cdn-v2.openapi.yaml" },
  { surface: "mapi", file: "management-v1.openapi.yaml" },
] as const;

async function download(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function main(): Promise<void> {
  // Download everything before touching upstream/, so a failed request leaves it intact.
  const specs = await Promise.all(
    SPECS.map(async ({ surface, file }) => ({
      surface,
      file,
      content: await download(`${SPEC_BASE_URL}/${file}`),
    })),
  );

  rmSync(UPSTREAM_DIR, { recursive: true, force: true });
  for (const { surface, file, content } of specs) {
    const dir = resolve(UPSTREAM_DIR, surface);
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, file), content, "utf8");
  }

  generateKnownTypes();

  const hash = hashUpstream();
  if (readLock()?.hash === hash) {
    console.warn("Specs unchanged; spec.lock stays as is.");
    return;
  }
  writeLock({ hash });
  console.warn(`Updated ${UPSTREAM_DIR} and spec.lock.`);
}

await main();
