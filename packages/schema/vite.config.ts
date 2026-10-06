import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      index: "./src/index.ts",
      "field-plugins/index": "./src/field-plugins/index.ts",
      "migrations/index": "./src/migrations/index.ts",
    },
    format: ["esm", "cjs"],
    outDir: "./dist",
    sourcemap: true,
    clean: true,
    dts: true,
    attw: true,
    exports: true,
    publint: true,
    unbundle: true,
  },
  test: {
    environment: "node",
    // The package's own sources plus the `vanilla/` playgrounds, which have no
    // test target of their own and so have nowhere else to run. None of them
    // carries a test today; the pattern stays so one that grows a test is
    // picked up. `playground/migrations` is left out because it runs its own
    // suite, against a toolchain this project does not have: picking its tests
    // up here fails on the first framework component it imports.
    include: ["src/**/*.test.ts", "playground/vanilla/**/*.test.ts"],
    typecheck: {
      enabled: true,
      include: ["src/**/*.test-d.ts", "playground/vanilla/**/*.test-d.ts"],
    },
  },
});
