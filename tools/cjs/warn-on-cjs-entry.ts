import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { CJS_DEPRECATION_CODE, CJS_DEPRECATION_SILENCE_ENV } from "./cjs-deprecation-plugin.ts";

/**
 * Loads a built CommonJS entry in a fresh Node process and returns whether the package itself
 * emitted the deprecation warning, for the `module-format` tests.
 *
 * It looks for the name of the package, not just the warning: a package that depends on another
 * Storyblok package would otherwise pass on the dependency's warning. The warning is added before
 * anything else in the entry runs, so the package's own comes first and names it.
 *
 * A fresh process matters too: the warning fires once per realm, so the test runner's own
 * `require()` calls could already have used it up. The environment of a developer or CI job must
 * not decide the result, so the variables that silence the warning are dropped.
 */
export const warnsOnCjsEntry = (pkgRoot: string, cjsEntry: string): boolean => {
  const { name }: { name: string } = JSON.parse(
    readFileSync(resolve(pkgRoot, "package.json"), "utf8"),
  );
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  delete env[CJS_DEPRECATION_SILENCE_ENV];
  const { stderr } = spawnSync(process.execPath, ["-e", `require(${JSON.stringify(cjsEntry)})`], {
    encoding: "utf8",
    env,
  });
  return stderr.includes(CJS_DEPRECATION_CODE) && stderr.includes(`build of "${name}"`);
};
