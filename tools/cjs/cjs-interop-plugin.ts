import type { Plugin } from "vite-plus";

/**
 * Rolldown emits `dep = __toESM(dep, 1)` after `var dep = require("dep")` in the CJS output of
 * `"type": "module"` packages. When the helper is shared across chunks the call is
 * `dep = require_runtime.__toESM(dep, 1)`. The `1` (node mode) ignores `__esModule` and makes
 * `dep.default` the whole exports object, which breaks `require()`d dependencies such as `ky` and
 * `storyblok-js-client`. Rewrite it to `__toESM(dep)`.
 *
 * Rolldown has no option for this and treats it as intended (rolldown/rolldown#10308). Remove this
 * once `output.interop` lands (rolldown/rolldown#7704).
 *
 * Bundled CommonJS dependencies (`__toESM(require_dep(), 1)`) are left alone, because the argument
 * is a call rather than an identifier. That keeps the CJS build agreeing with the ESM build for them.
 *
 * Caveat: for an external dependency the two builds agree only while it ships an ESM entry. A
 * CommonJS-only dependency that sets `__esModule` gets `exports.default` here, while the ESM build's
 * default import is `module.exports` (Node semantics). No current dependency is like that, but the
 * plugin runs on every package, so check this before adding one.
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
