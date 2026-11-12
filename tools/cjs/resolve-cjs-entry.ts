import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

/**
 * Resolves the built CommonJS entry of a package for the `module-format` tests, which load `dist`
 * and not the source.
 *
 * Node does the resolving, through the package's own name, so the `require` condition of `exports`
 * is read the way a real consumer's `require()` reads it, whatever its shape (a plain string or
 * `{ types, default }`). It throws `Cannot find module` when `dist` does not exist: build the
 * package first with `pnpm nx build <package>`.
 *
 * Run the tests through nx (`pnpm nx test <package>`), which builds first. A bare `vp test`,
 * `test:watch` or `test:ui` uses whatever `dist` is there, so a test can pass against a build made
 * before the plugin was removed.
 */
export const resolveCjsEntry = (pkgRoot: string, subpath = "."): string => {
  const manifest = resolve(pkgRoot, "package.json");
  const { name }: { name: string } = JSON.parse(readFileSync(manifest, "utf8"));
  return createRequire(manifest).resolve(name + subpath.slice(1));
};
