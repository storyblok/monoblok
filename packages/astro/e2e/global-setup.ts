import { runAstro, stopAstro, waitForExit } from "./playground-server";

const BUILD_TIMEOUT_MS = 180_000;

/**
 * Builds `playground/test` once, before any spec runs, for the specs that
 * test a production build (`astro preview`). Building here rather than in a
 * spec keeps `astro build` from rewriting the project's generated files
 * while other specs drive the shared dev server.
 */
export default async function globalSetup(): Promise<void> {
  const build = runAstro(["build"]);
  const timeout = setTimeout(() => stopAstro(build), BUILD_TIMEOUT_MS);
  try {
    await waitForExit(build);
  } finally {
    clearTimeout(timeout);
  }
}
