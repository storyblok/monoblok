import type { Plugin } from "vite-plus";

/**
 * Rolldown emits `__toESM(require("dep"), 1)` in the CJS output of `"type": "module"` packages. The
 * `1` (node mode) ignores `__esModule` and makes `dep.default` the whole exports object, which breaks
 * `require()`d dependencies such as `ky` and `storyblok-js-client`. Rewrite it to `__toESM(require("dep"))`.
 *
 * Rolldown has no option for this and treats it as intended (rolldown/rolldown#10308). Remove this
 * once `output.interop` lands (rolldown/rolldown#7704).
 *
 * Bundled CommonJS dependencies (`__toESM(require_dep(), 1)`) are left alone, so the CJS build keeps
 * agreeing with the ESM build for them.
 */
const NODE_MODE_INTEROP = /\b(__toESM\([\w$]+), 1\)/g;

export const cjsInterop = (): Plugin => ({
  name: "storyblok:cjs-interop",
  renderChunk(code, _chunk, { format }) {
    if (format !== "cjs" && format !== "umd") {
      return null;
    }
    const result = code.replace(NODE_MODE_INTEROP, "$1)");
    return result === code ? null : { code: result, map: null };
  },
});
