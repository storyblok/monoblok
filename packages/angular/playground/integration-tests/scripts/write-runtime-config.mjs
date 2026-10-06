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
  // No token means no QA space — e.g. a CI build, or a type-check run,
  // where nobody sourced `.env.qa-engineer-manual`. Skip the file instead of
  // throwing, so `app.config.ts`'s public demo token fallback applies.
  console.warn(
    "[storyblok] Missing STORYBLOK_PREVIEW_TOKEN; skipping runtime config. Source .env.qa-engineer-manual first to use a real QA space.",
  );
  process.exit(0);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `globalThis.__STORYBLOK_RUNTIME_CONFIG__ = ${JSON.stringify({ accessToken })};\n`,
);
