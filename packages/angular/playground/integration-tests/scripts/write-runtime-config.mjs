import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve against this file, not the cwd: the script is invoked from the
// package root by `playground:integration-tests:start` and from the repo root
// by hand, and a cwd-relative path silently writes the access token to a
// second, un-gitignored location.
const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDir, "../public/storyblok-runtime-config.js");
const accessToken = process.env.STORYBLOK_PREVIEW_TOKEN;

if (!accessToken) {
  throw new Error("Missing STORYBLOK_PREVIEW_TOKEN. Source .env.qa-engineer-manual first.");
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `globalThis.__STORYBLOK_RUNTIME_CONFIG__ = ${JSON.stringify({ accessToken })};\n`,
);
