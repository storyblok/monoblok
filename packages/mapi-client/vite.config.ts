import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["./src/index.ts"],
    format: ["esm", "cjs"],
    globalName: "StoryblokManagementApiClient",
    outDir: "./dist",
    sourcemap: true,
    clean: true,
    dts: true,
    attw: true,
    exports: true,
    publint: true,
    unbundle: true,
    deps: {
      // `ky` ships ESM-only with no `require` export condition. tsdown's CJS
      // output for a `"type": "module"` package double-wraps a `require`d
      // external ESM default export, turning `ky`'s default export into the
      // whole module namespace instead of the callable function
      // (https://github.com/rolldown/rolldown/issues/10308). Bundling `ky`
      // into the output instead of leaving it external avoids that broken
      // require-of-ESM interop path entirely.
      alwaysBundle: ["ky"],
    },
  },
  test: {
    environment: "node",
  },
});
