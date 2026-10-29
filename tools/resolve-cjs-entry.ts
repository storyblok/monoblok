import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Reads the `require` target of a package export. tsdown writes a plain string when the package has
 * no types for it and `{ types, default }` when it does, so both have to resolve.
 */
const requireTarget = (pkg: unknown, subpath: string): string => {
  const condition = isRecord(pkg) && isRecord(pkg.exports) ? pkg.exports[subpath] : undefined;
  const target = isRecord(condition) ? condition.require : undefined;
  const path = isRecord(target) ? target.default : target;
  if (typeof path !== "string") {
    throw new TypeError(`"${subpath}" has no CommonJS \`require\` entry in package.json exports.`);
  }
  return path;
};

/**
 * Resolves the built CommonJS entry of a package for the `module-format` tests, which load `dist`
 * and not the source.
 *
 * Run them through nx (`pnpm nx test <package>`), which builds first. A bare `vp test`, `test:watch`
 * or `test:ui` uses whatever `dist` is there, so a test can pass against a build made before the
 * plugin was removed.
 */
export const resolveCjsEntry = (pkgRoot: string, subpath = "."): string => {
  const pkg: unknown = JSON.parse(readFileSync(resolve(pkgRoot, "package.json"), "utf8"));
  const name = isRecord(pkg) && typeof pkg.name === "string" ? pkg.name : basename(pkgRoot);
  const entry = resolve(pkgRoot, requireTarget(pkg, subpath));
  if (!existsSync(entry)) {
    throw new Error(`${entry} does not exist. Build it first: pnpm nx build ${name}`);
  }
  return entry;
};
