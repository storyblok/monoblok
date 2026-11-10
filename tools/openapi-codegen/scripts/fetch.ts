#!/usr/bin/env -S node --experimental-strip-types --no-warnings=ExperimentalWarning
/**
 * Pins the latest public OpenAPI specs from the Storyblok docs in
 * `spec.lock.json` and regenerates `src/known-types.ts` from them.
 *
 *   pnpm --filter @storyblok/openapi-codegen pull
 */

import { readFileSync } from "node:fs";
import { renderKnownTypes, writeKnownTypes } from "./known-types.ts";
import { OVERLAY_PATH } from "../src/paths.ts";
import {
  cacheSpec,
  download,
  readSpecLock,
  type SpecLock,
  UPSTREAM_SPECS,
  type UpstreamSpec,
  verifySpec,
  writeSpecLock,
} from "../src/specs.ts";

const DOCS_ORIGIN = "https://www.storyblok.com";
const LATEST_URL = `${DOCS_ORIGIN}/docs/openapi-spec/latest.json`;

const SPEC_FILES: Record<UpstreamSpec, string> = {
  capi: "cdn-v2.openapi.yaml",
  mapi: "management-v1.openapi.yaml",
};

interface LatestSpec {
  path: string;
  sha256: string;
}

const utf8 = new TextDecoder("utf-8", { fatal: true });

async function fetchLatestLock(): Promise<SpecLock> {
  const latest = JSON.parse((await download(LATEST_URL)).toString("utf8")) as Record<
    string,
    LatestSpec | undefined
  >;
  const pin = (spec: UpstreamSpec) => {
    const entry = latest[SPEC_FILES[spec]];
    if (!entry) {
      throw new Error(`${LATEST_URL} lists no ${SPEC_FILES[spec]}.`);
    }
    return { url: new URL(entry.path, DOCS_ORIGIN).href, sha256: entry.sha256 };
  };
  return { capi: pin("capi"), mapi: pin("mapi") };
}

function isSameLock(a: SpecLock, b: SpecLock): boolean {
  return UPSTREAM_SPECS.every((spec) => a[spec].sha256 === b[spec].sha256);
}

async function main(): Promise<void> {
  const lock = await fetchLatestLock();
  if (isSameLock(lock, readSpecLock())) {
    console.warn("Specs unchanged.");
    return;
  }

  const [capi, mapi] = await Promise.all(UPSTREAM_SPECS.map((spec) => download(lock[spec].url)));
  const downloads = { capi, mapi } satisfies Record<UpstreamSpec, Buffer>;
  for (const spec of UPSTREAM_SPECS) {
    verifySpec(lock[spec], downloads[spec]);
  }

  // Validate before pinning, so specs that break the aliases leave the lock untouched.
  const knownTypes = renderKnownTypes({
    capi: utf8.decode(downloads.capi),
    mapi: utf8.decode(downloads.mapi),
    overlay: readFileSync(OVERLAY_PATH, "utf8"),
  });

  for (const spec of UPSTREAM_SPECS) {
    cacheSpec(lock[spec], downloads[spec]);
  }
  writeSpecLock(lock);
  writeKnownTypes(knownTypes);
  console.warn("Updated spec.lock.json.");
}

await main();
