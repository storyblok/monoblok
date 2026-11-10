/**
 * The upstream specs are pinned in `spec.lock.json` by URL and sha256, never
 * committed. `resolveSpecPaths` downloads them into a git-ignored cache, keyed by
 * hash, and refuses any download that doesn't match its pin.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "pathe";
import type { SpecSource } from "./aliases.ts";
import { OVERLAY_PATH, SPEC_CACHE_DIR, SPEC_LOCK_PATH } from "./paths.ts";

export const UPSTREAM_SPECS = ["capi", "mapi"] as const;
export type UpstreamSpec = (typeof UPSTREAM_SPECS)[number];

export interface PinnedSpec {
  url: string;
  sha256: string;
}

export type SpecLock = Record<UpstreamSpec, PinnedSpec>;

export interface SpecStore {
  lockPath: string;
  cacheDir: string;
}

const DEFAULT_STORE: SpecStore = { lockPath: SPEC_LOCK_PATH, cacheDir: SPEC_CACHE_DIR };

const DOWNLOAD_TIMEOUT_MS = 60_000;

export function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Could not download ${url}: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export function readSpecLock(store: SpecStore = DEFAULT_STORE): SpecLock {
  return JSON.parse(readFileSync(store.lockPath, "utf8")) as SpecLock;
}

export function writeSpecLock(lock: SpecLock, store: SpecStore = DEFAULT_STORE): void {
  writeFileSync(store.lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
}

function cachePath(pin: PinnedSpec, store: SpecStore): string {
  return resolve(store.cacheDir, `${pin.sha256}.yaml`);
}

/** Writes through a temporary file, so concurrent generators never read a partial spec. */
export function cacheSpec(
  pin: PinnedSpec,
  content: Uint8Array,
  store: SpecStore = DEFAULT_STORE,
): void {
  const path = cachePath(pin, store);
  const temporaryPath = `${path}.${process.pid}.tmp`;
  mkdirSync(store.cacheDir, { recursive: true });
  writeFileSync(temporaryPath, content);
  renameSync(temporaryPath, path);
}

/** Throws unless `content` is the pinned spec. */
export function verifySpec(pin: PinnedSpec, content: Uint8Array): void {
  const actual = sha256(content);
  if (actual !== pin.sha256) {
    throw new Error(
      `${pin.url} has sha256 ${actual}, but spec.lock.json pins ${pin.sha256}. ` +
        "Versioned spec URLs never change, so the pin or the download is corrupt.",
    );
  }
}

async function ensureCached(pin: PinnedSpec, store: SpecStore): Promise<string> {
  const path = cachePath(pin, store);
  if (existsSync(path) && sha256(readFileSync(path)) === pin.sha256) {
    return path;
  }
  const content = await download(pin.url);
  verifySpec(pin, content);
  cacheSpec(pin, content, store);
  return path;
}

/** Local paths of the pinned upstream specs and the overlay, downloading what isn't cached. */
export async function resolveSpecPaths(
  store: SpecStore = DEFAULT_STORE,
): Promise<Record<SpecSource, string>> {
  const lock = readSpecLock(store);
  const [capi, mapi] = await Promise.all(
    UPSTREAM_SPECS.map((spec) => ensureCached(lock[spec], store)),
  );
  return { capi, mapi, overlay: OVERLAY_PATH };
}
