import type { TsdownPlugin } from "vite-plus/pack";

/** Stable `code` of the warning, so it can be silenced with `node --disable-warning=<code>`. */
export const CJS_DEPRECATION_CODE = "STORYBLOK_CJS_DEPRECATED";

/** Environment variable that silences the warning where the Node flag is not reachable. */
export const CJS_DEPRECATION_SILENCE_ENV = "STORYBLOK_SILENCE_CJS_DEPRECATION";

/** Global that marks the warning as emitted, shared by every Storyblok package in the realm. */
const EMITTED_KEY = "storyblok:cjs-deprecation";

/**
 * Builds the statement that emits the warning. A deprecation notice must never break `require()`, so
 * the whole body is guarded: a runtime without `process`, without `process.env` or with a throwing
 * `env` loads the package as usual, with or without the warning.
 *
 * Deno asks the user before a script reads an environment variable it has no permission for, so the
 * silence variable is only read once Deno reports the permission as granted. Without it the
 * warning is skipped rather than turned into a prompt about a variable the user has never heard of.
 *
 * A single global guard makes it fire once per realm (the main thread, each worker thread and each
 * test context have their own), however many packages, entries or copies get loaded. The warning
 * names the first package that loaded, since the rest of a dependency chain is the same message
 * again.
 */
export const createCjsDeprecationSnippet = (packageName: string): string => {
  const key = JSON.stringify(EMITTED_KEY);
  const message = JSON.stringify(
    `The CommonJS build of "${packageName}" was loaded (through require() or a CommonJS toolchain). CommonJS builds of Storyblok packages are deprecated and will be removed in the next major version; use ESM instead. Set ${CJS_DEPRECATION_SILENCE_ENV}=1 to silence this warning.`,
  );
  return (
    `(function(){try{var k=Symbol.for(${key});` +
    `if(typeof process==="undefined"||!process.emitWarning||globalThis[k])return;` +
    `if(typeof Deno!=="undefined"&&Deno.permissions&&Deno.permissions.querySync&&Deno.permissions.querySync({name:"env",variable:${JSON.stringify(CJS_DEPRECATION_SILENCE_ENV)}}).state!=="granted")return;` +
    `if(process.env&&process.env.${CJS_DEPRECATION_SILENCE_ENV})return;` +
    `globalThis[k]=true;` +
    `process.emitWarning(${message},{type:"DeprecationWarning",code:${JSON.stringify(CJS_DEPRECATION_CODE)}});}catch(e){}})();`
  );
};

/**
 * Emits a `DeprecationWarning` when the CommonJS build of a package is loaded, as decided in
 * ADR-0023.
 *
 * The warning goes in through the `intro` output option of the CommonJS build only, which rolldown
 * places after a hashbang and any directives such as `"use strict"`, where they still count. ESM
 * builds do not need it, UMD builds run in browsers, and the other chunks of an entry are loaded
 * through it, so only entry chunks get it.
 */
export const cjsDeprecation = (): TsdownPlugin => {
  let packageName = "this package";
  return {
    name: "storyblok:cjs-deprecation",
    tsdownConfigResolved(config) {
      packageName = config.pkg?.name ?? packageName;
    },
    outputOptions(options) {
      if (options.format !== "cjs") {
        return null;
      }
      const snippet = createCjsDeprecationSnippet(packageName);
      return { ...options, intro: (chunk) => (chunk.isEntry ? snippet : "") };
    },
  };
};
