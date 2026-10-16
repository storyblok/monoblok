import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import path from "pathe";

const require = createRequire(import.meta.url);
const OXFMT_BIN = path.join(path.dirname(require.resolve("oxfmt/package.json")), "bin/oxfmt");

/**
 * Formats a generated file in place with oxfmt. Runs the bin with Node
 * directly: no shell to split paths that contain spaces, and no `pnpm.cmd`
 * shim to resolve on Windows.
 */
export function formatGeneratedFile(filePath: string): void {
  execFileSync(process.execPath, [OXFMT_BIN, filePath], {
    stdio: "inherit",
  });
}
