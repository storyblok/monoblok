#!/usr/bin/env -S node --experimental-strip-types --no-warnings=ExperimentalWarning
/**
 * Copies the latest public specs from the storyblok/openapi repo into the
 * committed `upstream/{capi,mapi}/` and pins them in spec.lock.
 *
 *   pnpm --filter @storyblok/openapi-codegen pull
 *
 * Keeps the pinned SHA when the specs are unchanged, so upstream commits that
 * do not touch them never move the lock. Requires `gh auth status`.
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "pathe";
import { generateKnownTypes } from "./known-types.ts";
import { hashUpstream, readLock, UPSTREAM_DIR, UPSTREAM_REPO, writeLock } from "../src/lock.ts";

const SPECS = [
  { surface: "capi", source: "public/v2/cdnapi.openapi.yaml", file: "cdn-v2.openapi.yaml" },
  { surface: "mapi", source: "public/v1/mapi.openapi.yaml", file: "management-v1.openapi.yaml" },
] as const;

function ensureGhAuth(): void {
  const result = spawnSync("gh", ["auth", "status"], { stdio: "pipe" });
  if (result.status !== 0) {
    console.error("gh CLI is not authenticated. Run `gh auth login` first.");
    process.exit(1);
  }
}

function run(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(" ")}`);
    process.exit(1);
  }
}

function captureStdout(cmd: string, args: string[]): string {
  const result = spawnSync(cmd, args, { stdio: ["ignore", "pipe", "inherit"] });
  if (result.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(" ")}`);
    process.exit(1);
  }
  return result.stdout.toString().trim();
}

function cloneHead(): { clonePath: string; sha: string } {
  const clonePath = resolve(mkdtempSync(resolve(tmpdir(), "openapi-")), "repo");
  run("gh", ["repo", "clone", UPSTREAM_REPO, clonePath, "--", "--depth", "1"]);
  const sha = captureStdout("git", ["-C", clonePath, "rev-parse", "HEAD"]);
  return { clonePath, sha };
}

function copySpecs(clonePath: string): void {
  rmSync(UPSTREAM_DIR, { recursive: true, force: true });
  mkdirSync(UPSTREAM_DIR, { recursive: true });

  for (const { surface, source, file } of SPECS) {
    const src = resolve(clonePath, source);
    if (!existsSync(src)) {
      throw new Error(`Expected ${surface} spec at ${src} — upstream layout has changed.`);
    }
    const dest = resolve(UPSTREAM_DIR, surface);
    mkdirSync(dest, { recursive: true });
    copyFileSync(src, resolve(dest, file));
  }
}

function main(): void {
  ensureGhAuth();

  const lock = readLock();
  const { clonePath, sha } = cloneHead();
  try {
    copySpecs(clonePath);
  } finally {
    rmSync(dirname(clonePath), { recursive: true, force: true });
  }

  generateKnownTypes();

  const hash = hashUpstream();
  if (lock?.repo === UPSTREAM_REPO && lock.hash === hash) {
    console.warn(`Specs unchanged upstream; spec.lock stays at ${lock.sha}.`);
    return;
  }
  writeLock({ repo: UPSTREAM_REPO, sha, hash });
  console.warn(`Updated ${UPSTREAM_DIR} and spec.lock → ${sha}`);
}

main();
